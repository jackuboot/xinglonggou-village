/**
 * CloudBase SDK 初始化（v3 形态：cloudbase 单例 + app.auth / app.database 交叉属性）。
 * 全局仅此一处初始化，其余模块统一从本文件导入 auth / db / callFunction。
 */
import cloudbase from '@cloudbase/js-sdk/app'
import { registerAuth } from '@cloudbase/js-sdk/auth'
import { registerDatabase } from '@cloudbase/js-sdk/database'
import { registerFunctions } from '@cloudbase/js-sdk/functions'
import { ENV_ID } from './config'

let app = null
let auth = null
let db = null
let initError = ''

try {
  app = cloudbase.init({ env: ENV_ID })
  // 组件注册：dev（无 tree-shaking）下 SDK 模块副作用已自动注册；
  // 生产构建会摇掉该副作用，需要手动注册。按需注册避免重复注册告警。
  if (typeof app.auth !== 'function') {
    registerAuth(app)
  }
  if (typeof app.database !== 'function') {
    registerDatabase(app)
  }
  if (typeof app.callFunction !== 'function') {
    registerFunctions(app)
  }
  // app.auth / app.database 为函数形式（v1 风格），调用返回实例
  auth = typeof app.auth === 'function' ? app.auth() : app.auth
  db = typeof app.database === 'function' ? app.database() : app.database
} catch (e) {
  initError = (e && e.message) ? e.message : String(e)
  console.error('[cloudbase] SDK 初始化失败：', e)
}

/**
 * 调用云函数（带登录态）。
 * 返回云函数业务响应对象（约定 { ok: true, data } / { ok: false, code, message }）；
 * 传输层失败（网络、鉴权等）直接抛异常。
 */
async function callFunction(name, data) {
  if (!app || typeof app.callFunction !== 'function') {
    throw new Error(initError || 'SDK 未初始化，无法调用云函数')
  }
  const resp = await app.callFunction({ name, data })
  if (resp && resp.code) {
    // 传输层错误码（非业务码）
    throw Object.assign(new Error(resp.message || '云函数调用失败'), { code: resp.code, requestId: resp.requestId })
  }
  return resp ? resp.result : null
}

export { auth, db, callFunction, initError }
