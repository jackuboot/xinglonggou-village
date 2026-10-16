/** 本地 dev 服务可用性检查：node scripts/check-local.mjs */
const targets = [
  'http://localhost:5173/',
  'http://127.0.0.1:5173/',
]
for (const u of targets) {
  try {
    const r = await fetch(u)
    const b = await r.text()
    console.log(`[${r.status}] ${u}  len=${b.length}  hasAppDiv=${b.includes('id="app"')}  hasVite=${b.includes('/@vite/client')}`)
  } catch (e) {
    console.log(`[ERR] ${u}  ${e.cause?.code || e.message}`)
  }
}
process.exit(0)
