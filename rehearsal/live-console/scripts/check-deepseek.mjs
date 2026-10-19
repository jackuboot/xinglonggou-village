import 'dotenv/config'

const key = (process.env.DEEPSEEK_API_KEY || '').trim()
const base = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(
  /\/$/,
  ''
)
const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

if (!key) {
  console.error('DEEPSEEK_API_KEY 未配置：请在 .env 或云函数环境变量中设置后重试')
  process.exit(1)
}

const response = await fetch(`${base}/chat/completions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
  },
  body: JSON.stringify({
    model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: '只输出 JSON：{"ok":true,"model":"<你的模型名>"}',
      },
    ],
  }),
  signal: AbortSignal.timeout(20000),
})

console.log('HTTP', response.status)
const payload = await response.json()
console.log(JSON.stringify(payload, null, 2))
process.exit(response.ok ? 0 : 1)
