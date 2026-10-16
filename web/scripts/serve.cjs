/**
 * 官网本地预览服务器（零依赖，服务 dist/ 目录）：
 *   node scripts/serve.cjs          → http://localhost:8080
 *   node scripts/serve.cjs 9000     → 指定端口
 * 仅用于本地开发预览；线上仍部署到 CloudBase 静态托管（deploy.ps1）。
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', 'dist')
const PORT = Number(process.argv[2]) || 8080

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  let filePath = path.normalize(path.join(ROOT, urlPath))
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden') }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html')
  }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 Not Found: ' + urlPath) }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' })
    res.end(data)
    console.log(`[serve] ${req.method} ${urlPath} 200`)
  })
}).listen(PORT, '127.0.0.1', () => {
  console.log(`[serve] 官网本地预览: http://localhost:${PORT}/  (root: dist/)`)
})
