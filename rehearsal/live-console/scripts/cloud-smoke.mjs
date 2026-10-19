const BASE =
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

const reset = await call('/reset', {})
console.log('reset:', reset.ok)

const submitted = await call('/farmer/submit', {
  groupName: '3组',
  vegetableName: '高山云雾茶',
  quantityKg: 5,
  harvestDate: '2026-10-18',
})
const produce = submitted.data
console.log('submit:', produce.id, produce.vegetableName, produce.status)

let state = await call('/state')
console.log(
  'after submit:',
  JSON.stringify({
    produceStatus: state.produces[0]?.status,
    audit: state.audit.map((event) => event.type),
    queue: state.queue,
  })
)

const suggestion = await call('/keeper/review-ai', { produceId: produce.id })
console.log(
  'review-ai:',
  JSON.stringify({
    source: suggestion.data.source,
    recommendation: suggestion.data.recommendation,
    confidence: suggestion.data.confidence,
    reasons: suggestion.data.reasons,
  })
)

const reviewed = await call('/keeper/review', {
  produceId: produce.id,
  decision: 'approve',
})
console.log('review:', reviewed.data.status)

const batch = await call('/keeper/batch', {
  produceId: produce.id,
  productName: '兴隆沟高山云雾茶',
})
console.log('batch:', batch.data.id, batch.data.status)

const trace = await call('/consumer/trace', { batchId: batch.data.id })
console.log('trace fields:', Object.keys(trace.data).join(','))
console.log(
  'trace has farmerUid:',
  Object.prototype.hasOwnProperty.call(trace.data, 'farmerUid')
)

const booking = await call('/consumer/buy', { batchId: batch.data.id })
console.log('booking:', booking.data.id, booking.data.status)

const dispatch = await call('/keeper/dispatch-ai', {
  bookingId: booking.data.id,
})
console.log('dispatch-ai:', JSON.stringify(dispatch.data))

const assigned = await call('/keeper/assign', {
  bookingId: booking.data.id,
  assigneeUid: dispatch.data.assigneeUid,
})
console.log('assigned:', assigned.data.assignedTo)

const scan = await call('/admin/scan', {})
console.log(
  'scan:',
  JSON.stringify({
    created: scan.data.created.length,
    open: scan.data.open.length,
    types: scan.data.created.map((item) => item.type),
  })
)

const openAlert = scan.data.open.find((item) => item.status === 'open')
if (openAlert) {
  const ack = await call('/auditor/ack', { alertId: openAlert.id })
  console.log('ack:', ack.data.id, ack.data.status)
}

state = await call('/state')
console.log(
  'final:',
  JSON.stringify({
    stats: state.stats,
    auditTypes: state.audit.map((event) => event.type),
    queue: {
      pending: state.queue.pending,
      processing: state.queue.processing,
      done: state.queue.done,
      failed: state.queue.failed,
    },
    storage: state.storage,
    ai: state.ai,
  })
)
