/**
 * 用户角色授权管理云函数（roles-admin）
 *
 * 设计原则：
 * - 数据存储于环境自带的 PostgreSQL（PG 模式），表 user_roles 由本函数自动创建维护，
 *   且未对 anon / authenticated 授权，前端无法直接访问；读写全部经本函数
 * - 所有授权写操作只经过本云函数（SQL 管理员通道 ExecutePGSql），且校验调用者身份
 * - 身份只信云函数上下文的 TCB_UUID（客户端传参一律不可信）
 *
 * actions:
 *  - me       : 返回调用者本人的授权（前端唯一读取通道，无需管理员身份）
 *  - status   : 系统状态（total / hasAdmin / isAdmin / firstRun / hasUid）
 *  - bootstrap: 生成首位超级管理员——仅部署端（CLI 无用户上下文）调用：
 *               按手机号查询用户 UID 后授予 admin，且仅当系统尚无管理员时生效
 *  - list     : [admin] 列出全部授权记录
 *  - grant    : [admin] upsert 授权记录 { uid, roles, name }
 *  - revoke   : [admin] 删除授权记录 { uid }
 */
const cloudbase = require('@cloudbase/node-sdk')

const ENV_ID = process.env.SCF_NAMESPACE || ''
const TABLE = 'user_roles'

/** 可授权的角色标识（与前端 roles.js 保持一致；consumer 为默认角色无需授权） */
const GRANTABLE_ROLES = ['farmer', 'keeper', 'auditor', 'admin']

const ok = (data) => ({ ok: true, data })
const fail = (code, message) => ({ ok: false, code, message })

/** SQL 字符串转义（单引号加倍），所有拼接值必须经过 */
const esc = (v) => "'" + String(v).replace(/'/g, "''") + "'"

/**
 * 管理端 SDK（@cloudbase/manager-node）：
 * 云函数环境自动读取环境变量凭据；SCF_NAMESPACE 即环境 ID。
 */
let managerInstance = null
function getManager() {
  if (!managerInstance) {
    const CloudBaseManager = require('@cloudbase/manager-node')
    managerInstance = CloudBaseManager.init({ envId: ENV_ID })
  }
  return managerInstance
}

/** 执行一条 SQL（PostgreSQL 管控通道，以管理员身份执行） */
async function runSql(sql) {
  const common = getManager().commonService('tcb')
  return common.call({ Action: 'ExecutePGSql', Param: { EnvId: ENV_ID, Sql: sql } })
}

/** ExecutePGSql 的 Rows 为「行 JSON 数组字符串」的数组，解析为行数组 */
function parseRows(res) {
  const rows = (res && res.Rows) || []
  const out = []
  for (const r of rows) {
    try {
      const arr = JSON.parse(r)
      if (Array.isArray(arr)) out.push(arr)
    } catch (e) {
      /* 单行解析失败则跳过 */
    }
  }
  return out
}

/** jsonb 列值 → 角色数组 */
function toRoles(v) {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      return Array.isArray(p) ? p : []
    } catch (e) {
      return []
    }
  }
  return []
}

/** 确保数据表存在（幂等；首次写入前调用） */
async function ensureTable() {
  await runSql(
    `CREATE TABLE IF NOT EXISTS public.${TABLE} (` +
      `uid text PRIMARY KEY, ` +
      `roles jsonb NOT NULL DEFAULT '[]'::jsonb, ` +
      `name text NOT NULL DEFAULT '', ` +
      `created_at timestamptz NOT NULL DEFAULT now(), ` +
      `updated_at timestamptz NOT NULL DEFAULT now())`
  )
}

/**
 * 读取全量授权记录（按更新时间倒序）。
 * 表尚未创建（42P01）时按空处理——首次 status 调用发生在初始化之前。
 */
async function readAll(limit = 200) {
  let res
  try {
    res = await runSql(
      `SELECT uid, roles, name, ` +
        `to_char(updated_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD"T"HH24:MI:SS') AS updated_at ` +
        `FROM public.${TABLE} ORDER BY updated_at DESC LIMIT ${limit}`
    )
  } catch (e) {
    const msg = String((e && e.message) || e)
    if (/does not exist|42P01|不存在/i.test(msg)) return []
    throw e
  }
  return parseRows(res).map(([uid, roles, name, updatedAt]) => ({
    _id: uid,
    roles: toRoles(roles),
    name: name || '',
    updatedAt: updatedAt || null,
  }))
}

function isAdminDoc(doc) {
  return !!(doc && Array.isArray(doc.roles) && doc.roles.includes('admin'))
}

async function handle(event = {}, context = {}) {
  const action = String(event.action || 'status')

  // 调用者身份：只信云函数上下文
  let uid = ''
  try {
    const ctx = cloudbase.getCloudbaseContext(context)
    uid = (ctx && (ctx.TCB_UUID || ctx.TCB_CUSTOM_USER_ID)) || ''
  } catch (e) {
    uid = ''
  }

  // ---------- me：返回调用者本人的授权（前端读取通道） ----------
  if (action === 'me') {
    const docs = await readAll()
    const doc = uid ? docs.find((d) => d._id === uid) || null : null
    return ok({
      uid,
      roles: doc ? doc.roles : [],
      name: doc ? doc.name : '',
    })
  }

  // ---------- status：系统状态（无需权限，供界面展示） ----------
  if (action === 'status') {
    const docs = await readAll()
    const hasAdmin = docs.some(isAdminDoc)
    const callerDoc = uid ? docs.find((d) => d._id === uid) || null : null
    return ok({
      total: docs.length,
      hasAdmin,
      isAdmin: isAdminDoc(callerDoc),
      firstRun: !hasAdmin,
      hasUid: !!uid,
    })
  }

  // ---------- bootstrap：生成首位超级管理员（仅部署端调用） ----------
  if (action === 'bootstrap') {
    // 准入一：必须是无用户上下文的调用（CLI/部署端）。
    // 前端 callFunction 必携带登录态（uid 非空），一律拒绝——防止应用中自封管理员。
    if (uid) return fail(403, 'bootstrap 仅允许在部署端通过 CLI 执行')
    const phone = String(event.phone || '').trim().replace(/^\+86/, '')
    if (!/^1\d{10}$/.test(phone)) return fail(400, '手机号格式不正确（需 11 位大陆手机号）')

    // 准入二：仅当系统尚无任何管理员（一次性引导）
    const docs = await readAll(500)
    if (docs.some(isAdminDoc)) {
      return fail(409, '系统已存在管理员：bootstrap 仅用于首次初始化，后续调整请在管理后台的「用户授权管理」中操作')
    }

    // 手机号 → 用户 UID（管理端用户目录；须用纯 11 位号码）
    let user = null
    try {
      const res = await getManager().user.describeUserList({ phone, pageSize: 10 })
      const list = (res && res.Data && res.Data.UserList) || []
      user = list.find((x) => x.Phone === phone) || null
    } catch (e) {
      return fail(502, `查询用户失败：${(e && e.message) || e}`)
    }
    if (!user || !user.Uid) {
      return fail(404, '该手机号尚未在系统中注册：请先用该手机号登录一次工作台，然后重新运行设置命令')
    }

    await ensureTable()
    await runSql(
      `INSERT INTO public.${TABLE} (uid, roles, name) VALUES (${esc(user.Uid)}, ${esc(JSON.stringify(['admin']))}::jsonb, ${esc('超级管理员')}) ` +
        `ON CONFLICT (uid) DO UPDATE SET roles = EXCLUDED.roles, name = EXCLUDED.name, updated_at = now()`
    )
    return ok({ uid: user.Uid, phone, granted: true })
  }

  // ---------- 以下操作必须管理员 ----------
  if (!uid) return fail(401, '无法识别当前用户，请先在工作台登录')
  const docs = await readAll()
  const callerDoc = docs.find((d) => d._id === uid) || null
  if (!isAdminDoc(callerDoc)) return fail(403, '需要管理员权限')

  if (action === 'list') {
    const users = docs.map((d) => ({
      uid: d._id,
      roles: d.roles,
      name: d.name,
      updatedAt: d.updatedAt,
    }))
    return ok({ total: users.length, users })
  }

  if (action === 'grant') {
    const targetUid = String(event.uid || '').trim()
    if (targetUid.length < 6 || targetUid.length > 64) return fail(400, '用户 UID 格式不正确')

    const roles = Array.isArray(event.roles)
      ? GRANTABLE_ROLES.filter((r) => event.roles.includes(r))
      : []
    if (!roles.length) return fail(400, '请至少选择一个角色')

    // 允许给自己追加角色（如管理员体验各工作台），但必须保留自己的 admin：
    // 防止误操作把自己锁在管理后台之外（系统再无管理员可授权）
    if (targetUid === uid && !roles.includes('admin')) {
      return fail(400, '不能移除自己的管理员身份（可以追加其他角色）')
    }

    const name = String(event.name || '').trim().slice(0, 40)
    const existing = docs.find((d) => d._id === targetUid) || null
    await ensureTable()
    if (existing) {
      await runSql(
        `UPDATE public.${TABLE} SET roles = ${esc(JSON.stringify(roles))}::jsonb` +
          (name ? `, name = ${esc(name)}` : '') +
          `, updated_at = now() WHERE uid = ${esc(targetUid)}`
      )
    } else {
      await runSql(
        `INSERT INTO public.${TABLE} (uid, roles, name) VALUES (${esc(targetUid)}, ${esc(JSON.stringify(roles))}::jsonb, ${esc(name)})`
      )
    }
    return ok({ uid: targetUid, roles, created: !existing })
  }

  if (action === 'revoke') {
    const targetUid = String(event.uid || '').trim()
    if (!targetUid) return fail(400, '缺少用户 UID')
    if (targetUid === uid) return fail(400, '不能撤销自己的授权')
    await runSql(`DELETE FROM public.${TABLE} WHERE uid = ${esc(targetUid)}`)
    return ok({ uid: targetUid, removed: true })
  }

  return fail(400, `未知操作: ${action}`)
}

/**
 * 入口：全局异常兜底——任何未捕获异常都以业务错误返回（前端 toast 可读），
 * 不再以 FUNCTION_INVOCATION_FAILED 形式裸抛，便于排查。
 */
exports.main = async (event = {}, context = {}) => {
  try {
    return await handle(event, context)
  } catch (e) {
    return fail(500, `服务异常：${(e && e.message) || e}`)
  }
}
