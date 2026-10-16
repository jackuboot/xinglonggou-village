/**
 * 设置系统首位超级管理员（部署端脚本，无需进入控制台）。
 *
 * 用法：node scripts/set-super-admin.mjs 13800138000
 *
 * 原理：通过 tcb CLI 调用云函数 roles-admin 的 bootstrap action——
 * 该 action 仅接受「无用户上下文」的部署端调用（前端登录用户调用会被拒绝），
 * 且仅当系统尚无管理员时生效；按手机号在用户目录中定位账号并授予 admin。
 * 提示：目标手机号需先在工作台登录过一次（自动注册后才能在用户目录中查到）。
 */
import { execFileSync } from 'node:child_process'

const ENV_ID = 'bigfish-2026-d4gixfnab6e09d0f2'
const cliJs = 'C:/Program Files/nodejs/node_modules/@cloudbase/cli/bin/tcb'

const phone = String(process.argv[2] || '').trim().replace(/^\+86/, '')
if (!/^1\d{10}$/.test(phone)) {
  console.error('[X] 请提供 11 位大陆手机号，例如：node scripts/set-super-admin.mjs 13800138000')
  process.exit(1)
}

/** 从 CLI 输出中提取「返回结果：{...}」的完整 JSON（逐字符做括号配对） */
function extractJson(text) {
  const idx = text.indexOf('返回结果')
  if (idx < 0) return null
  const start = text.indexOf('{', idx)
  if (start < 0) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
    } else if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1))
        } catch (e) {
          return null
        }
      }
    }
  }
  return null
}

let out = ''
try {
  out = execFileSync(
    process.execPath,
    [cliJs, 'fn', 'invoke', 'roles-admin', '-e', ENV_ID, '--params', JSON.stringify({ action: 'bootstrap', phone })],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  )
} catch (e) {
  out = String((e && e.stdout) || '') + '\n' + String((e && e.stderr) || '')
}

const res = extractJson(out)
if (!res) {
  console.error('[X] 未能解析云函数返回。CLI 原始输出（节选）：')
  console.error(out.slice(0, 1500))
  process.exit(1)
}

if (res.ok) {
  console.log(`[OK] 已将手机号 ${phone} 设为超级管理员（UID: ${res.data.uid}）`)
  console.log('[i] 该账号登录工作台后，在「选择工作台」页即可看到「管理后台」入口。')
  process.exit(0)
}

console.error(`[X] 设置失败：${res.message || res.code}`)
console.error('[i] 常见情况：① 该手机号尚未登录过工作台（请先登录一次再重试）；② 系统已有管理员（请到管理后台操作）。')
process.exit(1)
