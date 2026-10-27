/**
 * 生成一组干净的货物流转演示数据：
 * 1) 已派单：土豆 200kg（审核通过 → 自动入库/上架 → 下单 → 自动派单）
 * 2) 待审核：大白菜 150kg（AI 建议已生成，等待人工拍板）
 * 3) 待质检：高山云雾茶 5kg（AI 建议驳回，货物改道质检站，等待人工拍板）
 *
 * 默认打云端；本地用 LC_API=http://127.0.0.1:4310/api npm run seed:demo
 */
const BASE = (
  process.env.LC_API ||
  'https://bigfish-2026-d4gixfnab6e09d0f2-1253692163.ap-shanghai.app.tcloudbase.com/api'
).replace(/\/$/, '')

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
}).format(new Date())

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
  return payload.data
}

async function getState() {
  const response = await fetch(`${BASE}/state`)
  return response.json()
}

async function submit(vegetableName, quantityKg, groupName = '3组') {
  return call('/farmer/submit', {
    groupName,
    vegetableName,
    quantityKg,
    harvestDate: today,
  })
}

async function reviewAi(produceId) {
  return call('/keeper/review-ai', { produceId })
}

async function review(produceId, decision) {
  return call('/keeper/review', { produceId, decision })
}

console.log(`base: ${BASE}`)
console.log(`today: ${today}`)
console.log('')

await call('/reset', {})

// 1) 已派单
const done = await submit('土豆', 200)
const doneSuggestion = await reviewAi(done.id)
console.log(
  `completed AI: ${doneSuggestion.recommendation} (${doneSuggestion.source})`
)
await review(done.id, 'approve')
const doneBatch = await call('/keeper/batch', { produceId: done.id })
const doneBooking = await call('/consumer/buy', { batchId: doneBatch.id })
const doneDispatch = await call('/keeper/dispatch-ai', {
  bookingId: doneBooking.id,
})
if (doneDispatch.assigneeUid) {
  await call('/keeper/assign', {
    bookingId: doneBooking.id,
    assigneeUid: doneDispatch.assigneeUid,
  })
}
console.log(`completed goods: ${done.id} -> batch ${doneBatch.id}`)

// 2) 待审核（保留 AI 建议，等待人工拍板）
const pending = await submit('大白菜', 150)
const pendingSuggestion = await reviewAi(pending.id)
console.log(
  `pending AI: ${pendingSuggestion.recommendation} (${pendingSuggestion.source}) -> ${pending.id}`
)

// 3) 待质检（异常改道）
const inspection = await submit('高山云雾茶', 5)
const inspectionSuggestion = await reviewAi(inspection.id)
console.log(
  `inspection AI: ${inspectionSuggestion.recommendation} (${inspectionSuggestion.source}) -> ${inspection.id}`
)

const state = await getState()
console.log('')
console.log('summary:')
console.log(
  JSON.stringify(
    {
      produces: state.produces.map((item) => ({
        id: item.id,
        name: item.vegetableName,
        kg: item.quantityKg,
        status: item.status,
      })),
      batches: state.batches.length,
      bookings: state.bookings.length,
      alerts: state.alerts.length,
      audit: state.audit.length,
      queue: state.queue
        ? {
            done: state.queue.done,
            pending: state.queue.pending,
            failed: state.queue.failed,
          }
        : 'local',
    },
    null,
    2
  )
)
