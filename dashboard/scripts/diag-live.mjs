/**
 * 一次性 CDP 诊断：验证 vite dev 页面在真实 Chrome 中是否渲染、卡在哪一步。
 * 前置：先启动 chrome --headless=new --remote-debugging-port=9333
 * 运行：node scripts/diag-live.mjs [url]
 * 产出：scripts/diag-shot.png（截图）+ scripts/diag-report.json（完整报告，UTF-8）
 * 特点：全程硬超时，绝不无限等待；不等 load 事件，直接抓当前画面。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const URL_ = process.argv[2] || 'http://127.0.0.1:5173/'
const PORT = 9333
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sleep = ms => new Promise(r => setTimeout(r, ms))

// [0] 目标服务是否活着（ASCII 摘要，防 GBK 乱码）
try {
  const r = await fetch(URL_)
  const b = await r.text()
  console.log(`[0] fetch ${URL_} -> ${r.status}, ${b.length} bytes, hasAppDiv=${b.includes('id="app"')}`)
} catch (e) {
  console.log(`[0] fetch ${URL_} -> ERR ${e.cause?.code || e.message}`)
  process.exit(1)
}

// [1] 连接调试 Chrome
let ver = null
try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json() } catch { /* not running */ }
if (!ver) { console.log('[1] no debug chrome on 9333'); process.exit(1) }
console.log('[1] chrome:', ver['Browser'])

const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((ok, err) => { ws.onopen = ok; ws.onerror = err })

let msgId = 0
const pending = new Map()
const logs = []
const exceptions = []
const inflight = new Map()
let finishedCount = 0
const failed = []
let loadFired = false
let domFired = false

ws.onmessage = ev => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
  switch (m.method) {
    case 'Runtime.consoleAPICalled': {
      const args = (m.params.args || []).map(a => a.value ?? a.description ?? a.type).join(' ')
      logs.push(`${m.params.type}: ${args}`)
      break
    }
    case 'Runtime.exceptionThrown': {
      const d = m.params.exceptionDetails
      exceptions.push(d.exception?.description || d.text)
      break
    }
    case 'Page.loadEventFired': loadFired = true; break
    case 'Page.domContentEventFired': domFired = true; break
    case 'Network.requestWillBeSent': inflight.set(m.params.requestId, m.params.request.url); break
    case 'Network.loadingFinished': finishedCount++; inflight.delete(m.params.requestId); break
    case 'Network.loadingFailed':
      failed.push(`${m.params.type} ${m.params.errorText} ${inflight.get(m.params.requestId) || m.params.requestId}`)
      inflight.delete(m.params.requestId)
      break
  }
}
const send = (method, params = {}) => new Promise(resolve => {
  const id = ++msgId
  pending.set(id, resolve)
  ws.send(JSON.stringify({ id, method, params }))
})

await send('Page.enable')
await send('Runtime.enable')
await send('Network.enable')
console.log('[2] navigate ->', URL_)
await send('Page.navigate', { url: URL_ })
await sleep(12000)

// [3] 截图：不等 load，直接抓当前画面
const shot = await Promise.race([
  send('Page.captureScreenshot', { format: 'png' }),
  sleep(8000).then(() => null),
])
let shotPath = ''
if (shot?.result?.data) {
  shotPath = path.join(__dirname, 'diag-shot.png')
  fs.writeFileSync(shotPath, Buffer.from(shot.result.data, 'base64'))
  console.log(`[3] screenshot -> diag-shot.png (${fs.statSync(shotPath).size} bytes)`)
} else {
  console.log('[3] screenshot FAILED/timeout')
}

// [4] 主线程可响应性（硬超时 6s，超时=主线程被占死）
const ev = await Promise.race([
  send('Runtime.evaluate', {
    expression: 'JSON.stringify({readyState:document.readyState,url:location.href,title:document.title,appLen:(document.getElementById("app")?.innerHTML||"").length,text:(document.body.innerText||"").replace(/\\s+/g," ").slice(0,300)})',
    returnByValue: true,
  }),
  sleep(6000).then(() => null),
])
const domReport = ev?.result?.result?.value || null
console.log('[4] evaluate:', domReport ? 'RESPONSIVE' : 'TIMEOUT (main thread busy?)')

// [5] 汇总写 UTF-8 报告文件
const report = {
  url: URL_,
  loadFired, domFired,
  mainThreadResponsive: !!domReport,
  dom: domReport ? JSON.parse(domReport) : null,
  network: { inflight: [...inflight.values()], finishedCount, failed },
  consoleMessages: logs,
  exceptions,
  screenshot: shotPath,
}
fs.writeFileSync(path.join(__dirname, 'diag-report.json'), JSON.stringify(report, null, 2))
console.log('[5] loadFired:', loadFired, '/ domFired:', domFired, '/ inflight:', inflight.size, '/ finished:', finishedCount, '/ failed:', failed.length)
console.log('[6] report -> scripts/diag-report.json')

await send('Browser.close').catch(() => {})
await sleep(500)
process.exit(0)
