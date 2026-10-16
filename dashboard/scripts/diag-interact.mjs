/**
 * 交互验证：移动端视口截图 + 模拟真实用户操作（输入手机号→点击获取验证码）。
 * 前置：chrome --headless=new --remote-debugging-port=9333
 * 运行：node scripts/diag-interact.mjs
 * 产出：scripts/diag-mobile.png（移动端）、scripts/diag-after-click.png（交互后）、diag-interact.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const URL_ = 'http://127.0.0.1:5173/'
const PORT = 9333
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sleep = ms => new Promise(r => setTimeout(r, ms))

let ver = null
try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json() } catch { /* not running */ }
if (!ver) { console.log('no debug chrome on 9333'); process.exit(1) }

const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((ok, err) => { ws.onopen = ok; ws.onerror = err })

let msgId = 0
const pending = new Map()
const logs = []
ws.onmessage = ev => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
  if (m.method === 'Runtime.consoleAPICalled') {
    const args = (m.params.args || []).map(a => a.value ?? a.description ?? a.type).join(' ')
    logs.push(`${m.params.type}: ${args}`)
  }
}
const send = (method, params = {}) => new Promise(resolve => {
  const id = ++msgId
  pending.set(id, resolve)
  ws.send(JSON.stringify({ id, method, params }))
})
const evalSafe = async (expression, ms = 15000) => {
  const r = await Promise.race([
    send('Runtime.evaluate', { expression, returnByValue: true }),
    sleep(ms).then(() => null),
  ])
  return r?.result?.result?.value ?? (r ? null : '(timeout)')
}
const shoot = async (file) => {
  const r = await Promise.race([send('Page.captureScreenshot', { format: 'png' }), sleep(8000).then(() => null)])
  if (r?.result?.data) { fs.writeFileSync(path.join(__dirname, file), Buffer.from(r.result.data, 'base64')); return file }
  return ''
}

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: URL_ })
await sleep(5000)

// [1] 移动端视口（iPhone 14 尺寸）
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await sleep(1200)
const mobileShot = await shoot('diag-mobile.png')
console.log('[1] mobile screenshot:', mobileShot || 'FAILED')
await send('Emulation.clearDeviceMetricsOverride')
await sleep(800)

// [2] 模拟输入手机号（原生 setter + input 事件，触发 Vue v-model）
const filled = await evalSafe(`(() => {
  const el = document.getElementById('phone')
  if (!el) return 'NO_INPUT'
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(el, '13800138000')
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return 'OK'
})()`)
console.log('[2] fill phone:', filled)

// [3] 点击「获取验证码」
const clicked = await evalSafe(`(() => {
  const btn = document.querySelector('.code-btn')
  if (!btn) return 'NO_BTN'
  if (btn.disabled) return 'BTN_DISABLED'
  btn.click()
  return 'CLICKED'
})()`)
console.log('[3] click code-btn:', clicked)
await sleep(6000) // 等 API 往返 + 状态渲染

// [4] 读取交互结果
const result = await evalSafe(`JSON.stringify({
  btnText: document.querySelector('.code-btn')?.textContent?.trim() || '',
  alert: document.querySelector('.alert')?.textContent?.trim() || '',
  loggingBtn: document.querySelector('.login-btn')?.textContent?.trim() || '',
})`)
const afterShot = await shoot('diag-after-click.png')
console.log('[4] after-click shot:', afterShot || 'FAILED')

fs.writeFileSync(path.join(__dirname, 'diag-interact.json'), JSON.stringify({
  mobileShot, afterShot, filled, clicked,
  result: result && result !== '(timeout)' ? JSON.parse(result) : result,
  consoleTail: logs.slice(-10),
}, null, 2))
console.log('[5] result -> scripts/diag-interact.json')

await send('Browser.close').catch(() => {})
await sleep(500)
process.exit(0)
