/**
 * 认证层：手机号短信验证码登录（CloudBase 身份验证）+ 角色加载。
 * 流程：sendCode() 发送验证码 → 用户输入 → login() 携带验证码登录。
 * 登录态由 SDK 自动持久化（localStorage），刷新页面后自动恢复。
 * 登录成功后经云函数 roles-admin 加载角色授权（见 db.js / roles.js）。
 */
import { reactive } from 'vue'
import { auth, initError } from '../cloudbase'
import { getGrantedRoles } from '../db'
import { effectiveRoles } from '../roles'

const state = reactive({
  ready: false,       // SDK 登录态是否已恢复（路由守卫等待此标记）
  loggedIn: false,
  user: null,         // 用户信息（含手机号、uid 等）
  roles: [],          // 有效角色（含隐式消费者），如 ['farmer', 'consumer']
  rolesLoaded: false, // 角色是否已加载完成（无论成功失败都会置 true）
})

/** 从任意登录态/用户对象中稳健提取手机号（SDK 不同接口字段名不一致） */
function phoneOf(u) {
  if (!u) return ''
  return u.phoneNumber || u.phone_number
    || (u.user && (u.user.phoneNumber || u.user.phone_number))
    || ''
}

/** 从用户对象中稳健提取 uid（SDK 不同接口字段名不一致） */
function uidOf(u) {
  if (!u) return ''
  return u.uid || u.user_id || u.sub || u.userId
    || (u.user && (u.user.uid || u.user.user_id))
    || ''
}

/**
 * 经云函数加载角色授权并换算为有效角色（含隐式消费者）。
 * ⚠️ 只能在 SDK 回调链之外调用（启动恢复、登录成功后），原因见 applyLoginState 注释。
 */
async function loadRoles() {
  try {
    const granted = await getGrantedRoles()
    state.roles = effectiveRoles(granted)
  } catch (e) {
    state.roles = effectiveRoles([]) // 兜底最低权限：仅消费者
  } finally {
    state.rolesLoaded = true
  }
}

async function refreshUser() {
  try {
    const info = await auth.getCurrentUser()
    if (info) {
      state.user = info
      state.loggedIn = true
      await loadRoles()
    } else {
      state.user = null
      state.loggedIn = false
      state.roles = []
    }
  } catch (e) {
    /* 拉取用户信息失败不阻断使用，保留当前登录态 */
  } finally {
    state.rolesLoaded = true
  }
}

/**
 * 处理 SDK 登录态事件。payload 有三种形态：
 * - null：未登录
 * - 事件对象 { name:'loginStateChanged', data:{ eventType } }：sign_in / sign_out / credentials_error
 * - 登录态对象：已登录会话恢复（无 eventType 字段）
 *
 * ⚠️ 重要（规避 SDK v3.10.2 缺陷）：本回调运行在 SDK 事件派发链内部，
 * 绝不能在此调用 getCurrentUser()/getLoginState() 等凭据读取 API——
 * 读取会重入 SDK 事件派发，形成永不停止的微任务事件环，直接卡死页面主线程
 * （已在真实 Chrome 中复现并定位）。用户信息刷新一律放在回调链之外的
 * refreshUser() 中（启动时、登录成功后）。
 */
function applyLoginState(payload) {
  state.ready = true
  if (!payload) {
    state.loggedIn = false
    state.user = null
    return
  }
  const type = payload.data && payload.data.eventType
  if (type === 'sign_out' || type === 'credentials_error') {
    state.loggedIn = false
    state.user = null
  } else if (type === 'sign_in') {
    state.loggedIn = true
  } else if (!type) {
    // 无 eventType 的登录态对象：会话已恢复
    state.loggedIn = true
  }
  // 含 eventType 的未知事件：仅标记 ready，不改变登录状态
}

if (auth) {
  try {
    const loginState = auth.hasLoginState() // 同步读取，安全
    state.ready = true
    if (loginState) {
      state.loggedIn = true
      refreshUser() // 回调链之外的读取时机：启动时恢复用户信息
    }
  } catch (e) {
    state.ready = true
  }
  try {
    auth.onLoginStateChanged(payload => applyLoginState(payload))
  } catch (e) {
    /* 订阅失败不影响登录主流程 */
  }
} else {
  state.ready = true
}

/** 将 SDK 报错翻译为可操作的中文提示 */
function friendlyError(e) {
  const raw = String((e && (e.message || e.msg || e.error_description)) || e || '未知错误')
  if (/身份源|登录方式|开启.{0,6}手机号|未启用.{0,6}登录/.test(raw)) {
    return '短信登录尚未开启：请在腾讯云开发控制台「环境 → 身份验证 → 身份源/登录方式」中开启「手机号验证码登录」，开通后即可正常登录。'
  }
  if (/DailyLimit|daily limit|超限/i.test(raw)) {
    return '该手机号今日验证码发送次数已达上限，请明天再试或更换手机号。'
  }
  if (/frequency|too many|频繁/i.test(raw)) {
    return '发送过于频繁，请稍候约 60 秒后再试。'
  }
  if (/domain|域名|origin/i.test(raw)) {
    return '当前访问域名未加入环境安全域名：请在腾讯云开发控制台「环境 → 安全配置 → Web 安全域名」中添加本站域名。'
  }
  if (/sms|短信/i.test(raw)) {
    return '短信服务不可用：请确认控制台「身份验证 → 登录方式」已开启短信验证码登录，且短信服务已开通。'
  }
  if (/verification|验证码/i.test(raw)) {
    return '验证码无效或已过期，请重新获取。'
  }
  return raw
}

/** 发送短信验证码，返回 { verification_id, is_user }（登录时需原样传回） */
async function sendCode(phoneE164) {
  if (!auth) throw new Error(initError || 'CloudBase 未初始化')
  return auth.getVerification({ phone_number: phoneE164 })
}

/** 验证码登录（首次登录自动注册） */
async function login(phoneE164, code, verificationInfo) {
  if (!auth) throw new Error(initError || 'CloudBase 未初始化')
  await auth.signInWithSms({
    verificationInfo,
    verificationCode: code,
    phoneNum: phoneE164,
  })
  await refreshUser()
}

async function logout() {
  if (!auth) return
  await auth.signOut()
  state.user = null
  state.loggedIn = false
  state.roles = []
}

/** 138****0000 形式的脱敏展示 */
function maskPhone(p) {
  const s = String(p || '')
  const m = s.match(/^(\+?\d{2,3})?(\d{3})\d{4}(\d{4})$/)
  return m ? `${m[1] || ''}${m[2]}****${m[3]}` : (s || '已登录')
}

export function useAuth() {
  return { state, sendCode, login, logout, friendlyError, maskPhone, phoneOf, uidOf, loadRoles }
}
