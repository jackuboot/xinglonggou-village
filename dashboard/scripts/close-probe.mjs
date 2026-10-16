/** 关闭探测用的 headless Chrome（CDP Browser.close），不影响用户自己的浏览器 */
let v = null
try { v = await (await fetch('http://127.0.0.1:9333/json/version')).json() } catch { /* 无调试浏览器在跑 */ }
if (!v) { console.log('no debug browser running'); process.exit(0) }
const ws = new WebSocket(v.webSocketDebuggerUrl)
ws.onopen = () => {
  ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }))
  setTimeout(() => { console.log('Browser.close sent'); process.exit(0) }, 1500)
}
ws.onerror = () => { console.log('ws error'); process.exit(0) }
