const BASE =
  process.env.LC_CLOUD_API ||
  'https://bigfish-2026-d4gixfnab6e09d0f2-1253692163.ap-shanghai.app.tcloudbase.com/api'

async function call(path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json()
  if (payload.ok === false) {
    throw new Error(`${payload.error.code}: ${payload.error.message}`)
  }
  return payload
}

let state = await call('/state')
console.log('cloud ai:', JSON.stringify(state.ai))

let pending = state.produces.find((item) => item.status === 'submitted')
if (!pending) {
  const submitted = await call('/farmer/submit', {
    groupName: '3组',
    vegetableName: '高山云雾茶',
    quantityKg: 600,
    harvestDate: '2026-10-18',
  })
  pending = submitted.data
  console.log('submitted for AI review:', pending.id, pending.quantityKg, '公斤')
}

const started = Date.now()
const suggestion = await call('/keeper/review-ai', { produceId: pending.id })
console.log(
  'suggestion:',
  JSON.stringify(
    {
      produceId: suggestion.data.produceId,
      source: suggestion.data.source,
      model: suggestion.data.model,
      recommendation: suggestion.data.recommendation,
      confidence: suggestion.data.confidence,
      summary: suggestion.data.summary,
      approveReasons: suggestion.data.approveReasons,
      rejectReasons: suggestion.data.rejectReasons,
      requiresHumanDecision: suggestion.data.requiresHumanDecision,
      elapsedMs: Date.now() - started,
    },
    null,
    2
  )
)

state = await call('/state')
const lastAudit = state.audit.filter((event) => event.type === 'review.suggested').slice(-1)[0]
console.log('audit:', JSON.stringify(lastAudit, null, 2))
console.log('queue:', JSON.stringify(state.queue))

if (suggestion.data.source !== 'deepseek') {
  console.error('未命中真实 DeepSeek，仍为兜底路径')
  process.exitCode = 1
}
