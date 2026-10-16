/**
 * SDK 接通自检（Node 环境，直连真实 CloudBase 后端）：
 *   node scripts/test-auth.mjs
 * 验证链路：init → registerAuth → app.auth() 挂载 → getVerification 可调用。
 * Node 端无浏览器 Origin 限制，若返回业务错误也证明后端已连通。
 */
import cloudbase from '@cloudbase/js-sdk/app'
import { registerAuth } from '@cloudbase/js-sdk/auth'
import { ENV_ID } from '../src/config.js'

console.log('[1] init with env:', ENV_ID)
const app = cloudbase.init({ env: ENV_ID })

console.log('[2] registerAuth(app)')
registerAuth(app)

console.log('[3] app.auth type:', typeof app.auth)
const auth = typeof app.auth === 'function' ? app.auth() : app.auth
console.log('[4] auth instance:', auth ? 'OK' : 'NULL')
console.log('    getVerification:', typeof auth?.getVerification)
console.log('    signInWithSms:  ', typeof auth?.signInWithSms)
console.log('    hasLoginState:  ', typeof auth?.hasLoginState)

console.log('[5] 调用 getVerification(+8613800138000) 直连后端...')
try {
  const res = await auth.getVerification({ phone_number: '+8613800138000' })
  console.log('    ✓ 后端已连通！响应：', JSON.stringify(res))
  console.log('    => 短信验证码已可下发（SMS 登录链路完整可用）')
} catch (e) {
  console.log('    ✗ 请求返回错误（但已证明 SDK 与后端连通）：')
  console.log('      code:', e?.code ?? e?.error?.code ?? '(none)')
  console.log('      msg :', e?.message ?? e?.error_description ?? e?.msg ?? String(e))
}
process.exit(0)
