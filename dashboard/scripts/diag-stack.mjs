/**
 * 死循环定位：对卡死页面做两次 Debugger.pause 抓调用栈。
 * 前置：chrome --headless=new --remote-debugging-port=9333
 * 运行：node scripts/diag-stack.mjs [url]
 * 产出：scripts/diag-stacks.json（UTF-8）+ 控制台摘要
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const URL_ = process.argv[2] || 'http://127.0.0.1:5173/'
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
let pausedResolve = null

ws.onmessage = ev => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
  if (m.method === 'Debugger.paused' && pausedResolve) {
    const r = pausedResolve
    pausedResolve = null
    r(m.params)
  }
}
const send = (method, params = {}) => new Promise(resolve => {
  const id = ++msgId
  pending.set(id, resolve)
  ws.send(JSON.stringify({ id, method, params }))
})
const waitPaused = (ms) => Promise.race([
  new Promise(r => { pausedResolve = r }),
  sleep(ms).then(() => null),
])

await send('Page.enable')
await send('Runtime.enable')
await send('Debugger.enable')
console.log('[1] navigate ->', URL_)
await send('Page.navigate', { url: URL_ })
console.log('[2] waiting 9s for potential hang...')
await sleep(9000)

const stacks = []
for (let round = 1; round <= 2; round++) {
  send('Debugger.pause')
  const p = await waitPaused(6000)
  if (!p) { console.log(`[3.${round}] pause TIMEOUT (debugger did not respond)`); stacks.push(null); continue }
  const frames = (p.callFrames || []).map(f => ({
    fn: f.functionName || '(anonymous)',
    url: f.url,
    line: f.location?.lineNumber,
    col: f.location?.columnNumber,
  }))
  stacks.push({ reason: p.reason, frames })
  console.log(`[3.${round}] paused, frames=${frames.length}`)
  await send('Debugger.resume')
  await sleep(1000)
}

fs.writeFileSync(path.join(__dirname, 'diag-stacks.json'), JSON.stringify(stacks, null, 2))
console.log('[4] stacks -> scripts/diag-stacks.json')

// 控制台打印两份栈的前 25 帧（URL+行号是 ASCII，不会乱码）
for (let i = 0; i < stacks.length; i++) {
  const s = stacks[i]
  if (!s) continue
  console.log(`--- stack #${i + 1} (${s.frames.length} frames) ---`)
  for (const f of s.frames.slice(0, 25)) {
    const short = (f.url || '').replace('http://127.0.0.1:5173', '').replace('http://127.0.0.1:9333', '')
    console.log(`    ${f.fn}  @ ${short}:${f.line}:${f.col}`)
  }
}

await send('Browser.close').catch(() => {})
await sleep(500)
process.exit(0)
