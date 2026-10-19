/**
 * 业务闭环（与 five-role-loop 的 RBAC/ABAC/审计规则保持一致）：
 * 农户提交 → 入库员审核/建批次 → 消费者溯源/购买 → 调度建议/人工确认
 * → 预警扫描/审计确认 → 管理员全局视图。
 *
 * 写入边界：
 * - AI 审核、AI 调度只给建议，不直接改业务状态；
 * - 所有关键写入都由对应角色的动作触发，并写入事件队列与审计。
 */
const crypto = require('crypto')
const store = require('./store')
const deepseek = require('./deepseek')

const VILLAGE = 'village-xinglonggou'

const ACTORS = {
  farmer: {
    uid: 'farmer-001',
    name: '李桂芳',
    roles: ['farmer'],
    villageId: VILLAGE,
  },
  keeper: {
    uid: 'keeper-001',
    name: '王入库',
    roles: ['keeper'],
    villageId: VILLAGE,
  },
  consumer: {
    uid: 'consumer-001',
    name: '张顾客',
    roles: ['consumer'],
    villageId: 'village-city',
  },
  auditor: {
    uid: 'auditor-001',
    name: '赵审计',
    roles: ['auditor'],
    villageId: 'village-county',
  },
  admin: {
    uid: 'admin-001',
    name: '孙管理员',
    roles: ['admin'],
    villageId: VILLAGE,
  },
}

class DomainError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

function ok(data) {
  return { ok: true, data }
}

function fail(code, message) {
  return { ok: false, error: { code, message } }
}

function nowIso() {
  return new Date().toISOString()
}

function newId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function text(value, name, max = 50) {
  const result = String(value === undefined || value === null ? '' : value).trim()
  if (!result) throw new DomainError('INPUT_INVALID', `${name}不能为空`)
  if (result.length > max) {
    throw new DomainError('INPUT_INVALID', `${name}不能超过 ${max} 个字符`)
  }
  return result
}

function quantity(value) {
  const result = Number(value)
  if (!Number.isFinite(result) || result <= 0 || result > 5000) {
    throw new DomainError('INPUT_INVALID', '数量必须是 0-5000 之间的正数')
  }
  return result
}

function dateText(value) {
  const result = String(value === undefined || value === null ? '' : value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) {
    throw new DomainError('INPUT_INVALID', '采收日期格式应为 YYYY-MM-DD')
  }
  return result
}

function canAccessVillage(actor, villageId) {
  return actor.roles.includes('admin') || actor.villageId === villageId
}

async function audit(actor, type, detail, agentId) {
  const payload = { ...(detail || {}), ...(agentId ? { agentId } : {}) }
  await store.enqueue(`audit.${type}`, {
    type,
    occurredAt: nowIso(),
    actorUid: actor.uid,
    payload,
  })
}

function traceView(batch, produce) {
  return {
    batchId: batch.id,
    productName: batch.productName,
    groupName: produce ? produce.groupName : '未知',
    vegetableName: produce ? produce.vegetableName : '未知',
    quantityKg: produce ? produce.quantityKg : 0,
    harvestDate: produce ? produce.harvestDate : '未知',
    batchStatus: batch.status,
  }
}

async function snapshot() {
  await store.drainQueue(20)
  const [produces, batches, bookings, alerts, auditEvents, queue] = await Promise.all([
    store.list('produce'),
    store.list('batch'),
    store.list('booking'),
    store.list('alert'),
    store.list('audit'),
    store.queueStats(),
  ])
  return {
    produces,
    batches,
    bookings,
    alerts,
    audit: auditEvents.slice(-80),
    stats: {
      produces: produces.length,
      batches: batches.length,
      bookings: bookings.length,
      alerts: alerts.length,
      audit: auditEvents.length,
    },
    ai: {
      deepseekConfigured: deepseek.configured(),
      model: deepseek.model(),
    },
    storage: {
      mode: 'postgres',
      envId: store.ENV_ID,
      entities: 'lc_entities',
      queue: 'lc_events',
    },
    queue,
  }
}

async function submitProduce(body) {
  const actor = ACTORS.farmer
  const produce = {
    id: newId('produce'),
    farmerUid: actor.uid,
    villageId: actor.villageId,
    groupName: text(body.groupName, '村组'),
    vegetableName: text(body.vegetableName, '蔬菜名称'),
    quantityKg: quantity(body.quantityKg),
    harvestDate: dateText(body.harvestDate),
    status: 'submitted',
    submittedAt: nowIso(),
  }
  await store.put('produce', produce.id, produce)
  await audit(actor, 'produce.submitted', { produceId: produce.id })
  return produce
}

async function reviewProduce(actor, body) {
  const produceId = text(body.produceId, '蔬菜批次 ID', 80)
  const decision = String(body.decision || '')
  if (decision !== 'approve' && decision !== 'reject') {
    throw new DomainError('INPUT_INVALID', '审核结论必须是 approve 或 reject')
  }
  const produce = await store.get('produce', produceId)
  if (!produce) throw new DomainError('PRODUCE_NOT_FOUND', '蔬菜批次不存在')
  if (!canAccessVillage(actor, produce.villageId)) {
    await audit(actor, 'access.denied', {
      tool: 'produce.review',
      reason: 'village',
    })
    throw new DomainError('VILLAGE_DENIED', '不能审核其他村的蔬菜批次')
  }
  if (produce.status !== 'submitted') {
    throw new DomainError('PRODUCE_INVALID_STATUS', '当前状态不可审核')
  }
  const next = {
    ...produce,
    status: decision === 'approve' ? 'active' : 'rejected',
  }
  await store.put('produce', next.id, next)
  await audit(
    actor,
    decision === 'approve' ? 'produce.approved' : 'produce.rejected',
    { produceId: next.id }
  )
  return next
}

async function suggestReview(body) {
  const actor = ACTORS.keeper
  const produceId = text(body.produceId, '蔬菜批次 ID', 80)
  const produce = await store.get('produce', produceId)
  if (!produce) throw new DomainError('PRODUCE_NOT_FOUND', '蔬菜批次不存在')
  if (!canAccessVillage(actor, produce.villageId)) {
    await audit(actor, 'access.denied', {
      tool: 'review.suggest',
      reason: 'village',
    })
    throw new DomainError('VILLAGE_DENIED', '不能查看其他村的蔬菜批次')
  }
  if (produce.status !== 'submitted') {
    throw new DomainError('INVALID_STATUS', '只对待审批次给建议')
  }
  const suggestion = await deepseek.reviewProduce(produce)
  await audit(
    actor,
    'review.suggested',
    {
      produceId: produce.id,
      recommendation: suggestion.recommendation,
      confidence: suggestion.confidence,
      source: suggestion.source,
    },
    suggestion.source === 'deepseek' ? 'deepseek-review-agent' : 'rule-review-agent'
  )
  return suggestion
}

async function createBatch(actor, body) {
  const produceId = text(body.produceId, '蔬菜批次 ID', 80)
  const produce = await store.get('produce', produceId)
  if (!produce) throw new DomainError('PRODUCE_NOT_FOUND', '蔬菜批次不存在')
  if (!canAccessVillage(actor, produce.villageId)) {
    await audit(actor, 'access.denied', { tool: 'batch.create', reason: 'village' })
    throw new DomainError('VILLAGE_DENIED', '不能为其他村创建批次')
  }
  if (produce.status !== 'active') {
    throw new DomainError('PRODUCE_INVALID_STATUS', '蔬菜批次未生效')
  }
  const batch = {
    id: newId('batch'),
    produceId: produce.id,
    villageId: produce.villageId,
    productName: text(
      body.productName || produce.vegetableName || '时令蔬菜',
      '产品名称'
    ),
    status: 'available',
    createdBy: actor.uid,
    createdAt: nowIso(),
  }
  await store.put('batch', batch.id, batch)
  await audit(actor, 'batch.created', { batchId: batch.id })
  return batch
}

async function trace(body) {
  const batchId = text(body.batchId, '批次 ID', 80)
  const batch = await store.get('batch', batchId)
  if (!batch) throw new DomainError('BATCH_NOT_FOUND', '批次不存在')
  const produce = await store.get('produce', batch.produceId)
  return traceView(batch, produce)
}

async function buy(body) {
  const actor = ACTORS.consumer
  const batchId = text(body.batchId, '批次 ID', 80)
  const batch = await store.get('batch', batchId)
  if (!batch) throw new DomainError('BATCH_NOT_FOUND', '批次不存在')
  const booking = {
    id: newId('booking'),
    batchId: batch.id,
    consumerUid: actor.uid,
    status: 'booked',
    createdAt: nowIso(),
  }
  await store.put('booking', booking.id, booking)
  await audit(actor, 'booking.created', { bookingId: booking.id, batchId: batch.id })
  return booking
}

async function suggestDispatch(actor, body) {
  const bookingId = text(body.bookingId, '预约 ID', 80)
  const booking = await store.get('booking', bookingId)
  if (!booking) throw new DomainError('INPUT_INVALID', '预约不存在')
  const batch = await store.get('batch', booking.batchId)
  if (!batch) throw new DomainError('BATCH_NOT_FOUND', '批次不存在')
  const keepers = await store.list('keeper')
  const keeper = keepers.find((item) => item.villageId === batch.villageId)
  const suggestion = {
    bookingId: booking.id,
    assigneeUid: keeper ? keeper.uid : null,
    confidence: keeper ? 0.86 : 0,
    reason: keeper
      ? '本村入库员可承接履约'
      : '本村暂无可用入库员，建议升级人工',
    requiresHumanDecision: true,
  }
  await audit(
    actor,
    'dispatch.suggested',
    { bookingId: booking.id, assigneeUid: suggestion.assigneeUid },
    'dispatch-agent'
  )
  return suggestion
}

async function assignDispatch(actor, body) {
  const bookingId = text(body.bookingId, '预约 ID', 80)
  const assigneeUid = text(body.assigneeUid, '履约人 UID', 80)
  const booking = await store.get('booking', bookingId)
  if (!booking) throw new DomainError('INPUT_INVALID', '预约不存在')
  const batch = await store.get('batch', booking.batchId)
  if (!batch) throw new DomainError('BATCH_NOT_FOUND', '批次不存在')
  const keepers = await store.list('keeper')
  const keeper = keepers.find((item) => item.uid === assigneeUid)
  if (!keeper || keeper.villageId !== batch.villageId) {
    await audit(actor, 'access.denied', {
      tool: 'dispatch.assign',
      reason: 'village',
    })
    throw new DomainError('VILLAGE_DENIED', '只能分配本村入库员')
  }
  const next = { ...booking, assignedTo: keeper.uid }
  await store.put('booking', next.id, next)
  await audit(actor, 'dispatch.assigned', {
    bookingId: next.id,
    assigneeUid: keeper.uid,
  })
  return next
}

async function scanAlerts() {
  const actor = ACTORS.admin
  const [produces, batches, bookings, existing] = await Promise.all([
    store.list('produce'),
    store.list('batch'),
    store.list('booking'),
    store.list('alert'),
  ])
  const dedupe = new Set(existing.map((item) => item.dedupeKey))
  const created = []

  async function raise(type, targetId, message, severity) {
    const dedupeKey = `${type}:${targetId}`
    if (dedupe.has(dedupeKey)) return
    dedupe.add(dedupeKey)
    const alert = {
      id: newId('alert'),
      type,
      severity,
      targetId,
      message,
      status: 'open',
      dedupeKey,
      createdAt: nowIso(),
    }
    await store.put('alert', alert.id, alert)
    created.push(alert)
  }

  const bookedBatches = new Set(bookings.map((item) => item.batchId))
  for (const produce of produces) {
    if (produce.status === 'submitted') {
      await raise(
        'stale_produce',
        produce.id,
        '蔬菜批次提交后尚未审核',
        'warn'
      )
    }
  }
  for (const batch of batches) {
    if (!bookedBatches.has(batch.id)) {
      await raise('unsold_batch', batch.id, '批次上架后暂无预约', 'critical')
    }
  }
  for (const booking of bookings) {
    if (!booking.assignedTo) {
      await raise(
        'unassigned_booking',
        booking.id,
        '预约尚未分配履约人',
        'critical'
      )
    }
  }

  await audit(actor, 'alert.scanned', {
    created: created.length,
    open: existing.length + created.length,
  })
  return {
    created,
    open: [...existing, ...created],
  }
}

async function ackAlert(body) {
  const actor = ACTORS.auditor
  const alertId = text(body.alertId, '告警 ID', 80)
  const alerts = await store.list('alert')
  const alert = alerts.find((item) => item.id === alertId)
  if (!alert) throw new DomainError('INPUT_INVALID', '告警不存在')
  const next = { ...alert, status: 'acknowledged' }
  await store.put('alert', next.id, next)
  await audit(actor, 'alert.acknowledged', { alertId: next.id })
  return next
}

async function reset() {
  await store.resetAll()
  await store.seedKeepers()
  return { reset: true }
}

async function dispatchAction(action, body = {}) {
  await store.ensureSchema()
  if (action === 'state') return snapshot()
  if (action === 'worker.drain') {
    const drained = await store.drainQueue(50)
    return ok({ drained, queue: await store.queueStats() })
  }
  if (action === 'farmer.submit') {
    const data = await submitProduce(body)
    await store.drainQueue(20)
    return ok(data)
  }
  if (action === 'keeper.review') {
    const data = await reviewProduce(ACTORS.keeper, body)
    await store.drainQueue(20)
    return ok(data)
  }
  if (action === 'keeper.review-ai') {
    const data = await suggestReview(body)
    await store.drainQueue(20)
    return ok(data)
  }
  if (action === 'keeper.batch') {
    const data = await createBatch(ACTORS.keeper, body)
    await store.drainQueue(20)
    return ok(data)
  }
  if (action === 'consumer.trace') {
    return ok(await trace(body))
  }
  if (action === 'consumer.buy') {
    const data = await buy(body)
    await store.drainQueue(20)
    return ok(data)
  }
  if (action === 'keeper.dispatch-ai') {
    const data = await suggestDispatch(ACTORS.keeper, body)
    await store.drainQueue(20)
    return ok(data)
  }
  if (action === 'keeper.assign') {
    const data = await assignDispatch(ACTORS.keeper, body)
    await store.drainQueue(20)
    return ok(data)
  }
  if (action === 'admin.scan') {
    const data = await scanAlerts()
    await store.drainQueue(20)
    return ok(data)
  }
  if (action === 'auditor.ack') {
    const data = await ackAlert(body)
    await store.drainQueue(20)
    return ok(data)
  }
  if (action === 'reset') {
    return ok(await reset())
  }
  throw new DomainError('ACTION_NOT_FOUND', `未知动作：${action}`)
}

async function handle(action, body) {
  try {
    return await dispatchAction(String(action || 'state'), body || {})
  } catch (error) {
    if (error instanceof DomainError) return fail(error.code, error.message)
    return fail('SERVER_ERROR', (error && error.message) || String(error))
  }
}

module.exports = { handle, ACTORS }
