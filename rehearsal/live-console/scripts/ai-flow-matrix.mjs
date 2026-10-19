/**
 * AI 审核场景矩阵：验证真实模型在流程分叉上的表现。
 * 默认打本地 http://127.0.0.1:4310；可用 LC_API 指向云端 /api。
 * 用法：npm run test:ai
 */
const BASE = (process.env.LC_API || 'http://127.0.0.1:4310/api').replace(
  /\/$/,
  ''
)

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
}).format(new Date())

const scenarios = [
  {
    name: '正常蔬菜',
    expect: 'approve',
    input: {
      groupName: 'AI测试组',
      vegetableName: '大白菜',
      quantityKg: 120,
      harvestDate: today,
    },
  },
  {
    name: '超量申报',
    expect: 'reject',
    input: {
      groupName: 'AI测试组',
      vegetableName: '时令蔬菜',
      quantityKg: 600,
      harvestDate: today,
    },
  },
  {
    name: '品类不符',
    expect: 'reject',
    input: {
      groupName: 'AI测试组',
      vegetableName: '高山云雾茶',
      quantityKg: 5,
      harvestDate: today,
    },
  },
  {
    name: '未来采收日期',
    expect: 'reject',
    input: {
      groupName: 'AI测试组',
      vegetableName: '大白菜',
      quantityKg: 50,
      harvestDate: '2099-12-31',
    },
  },
]

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

console.log(`base: ${BASE}`)
console.log(`today: ${today}`)
console.log('')

const results = []
for (const scenario of scenarios) {
  const submitted = await call('/farmer/submit', scenario.input)
  const started = Date.now()
  const suggestion = await call('/keeper/review-ai', {
    produceId: submitted.data.id,
  })
  const result = {
    name: scenario.name,
    expected: scenario.expect,
    actual: suggestion.data.recommendation,
    source: suggestion.data.source,
    model: suggestion.data.model,
    confidence: suggestion.data.confidence,
    elapsedMs: Date.now() - started,
    reasons: suggestion.data.reasons,
  }
  results.push(result)
  console.log(
    `${result.name}: ${result.actual} (expected ${result.expected}) ` +
      `| ${result.source}/${result.model} | ${result.elapsedMs}ms | ${result.confidence}`
  )
  console.log(`  ${result.reasons.join('；')}`)
  console.log('')
}

const state = await call('/state')
const deepseekAudits = state.audit.filter(
  (event) => event.payload && event.payload.agentId === 'deepseek-review-agent'
)
const mismatches = results.filter((item) => item.actual !== item.expected)

console.log('summary:')
console.log(
  JSON.stringify(
    {
      scenarios: results.length,
      deepseekCalls: results.filter((item) => item.source === 'deepseek').length,
      mismatches: mismatches.map((item) => item.name),
      auditEventsWithAgentId: deepseekAudits.length,
      queue: state.queue
        ? {
            done: state.queue.done,
            pending: state.queue.pending,
            failed: state.queue.failed,
          }
        : 'local mode',
    },
    null,
    2
  )
)

if (mismatches.length || results.some((item) => item.source !== 'deepseek')) {
  process.exitCode = 1
}
