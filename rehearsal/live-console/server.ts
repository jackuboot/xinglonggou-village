import 'dotenv/config'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createStore } from '../five-role-loop/src/adapters/in-memory'
import { createRoleGateway } from '../five-role-loop/src/application/role-gateway'
import { runAlertSentinel, runDispatcher } from '../five-role-loop/src/application/active-agents'
import { ALERT_RULE_PACK } from '../five-role-loop/src/application/alert-rules'
import type {
  Actor,
  Alert,
  AuditEvent,
  Batch,
  Booking,
  Produce,
} from '../five-role-loop/src/domain/types'
import { deepSeekConfigured, reviewProduceWithDeepSeek } from './deepseek'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 4310)
const DATA_FILE = path.join(__dirname, 'data', 'state.json')

interface PersistedState {
  produces: Produce[]
  batches: Batch[]
  bookings: Booking[]
  alerts: Alert[]
  audit: AuditEvent[]
}

function loadPersisted(): PersistedState | null {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as PersistedState
  } catch {
    return null
  }
}

function createWorld(persisted: PersistedState | null = null) {
  const store = createStore()
  store.keepers.set('keeper-001', {
    uid: 'keeper-001',
    villageId: 'village-xinglonggou',
  })
  if (persisted) {
    for (const item of persisted.produces) store.produces.set(item.id, item)
    for (const item of persisted.batches) store.batches.set(item.id, item)
    for (const item of persisted.bookings) store.bookings.set(item.id, item)
    for (const item of persisted.alerts) store.alerts.set(item.dedupeKey, item)
    store.audit.push(...persisted.audit)
  }
  const clock = { nowIso: () => new Date().toISOString() }
  const ids = {
    next: (prefix = 'id') => `${prefix}-${crypto.randomUUID().slice(0, 8)}`,
  }
  const gateway = createRoleGateway({ store, clock, ids })

  const actors = {
    farmer: {
      uid: 'farmer-001',
      name: '李桂芳',
      roles: ['farmer'],
      villageId: 'village-xinglonggou',
    } as Actor,
    keeper: {
      uid: 'keeper-001',
      name: '王入库',
      roles: ['keeper'],
      villageId: 'village-xinglonggou',
    } as Actor,
    consumer: {
      uid: 'consumer-001',
      name: '张顾客',
      roles: ['consumer'],
      villageId: 'village-city',
    } as Actor,
    auditor: {
      uid: 'auditor-001',
      name: '赵审计',
      roles: ['auditor'],
      villageId: 'village-county',
    } as Actor,
    admin: {
      uid: 'admin-001',
      name: '孙管理员',
      roles: ['admin'],
      villageId: 'village-xinglonggou',
    } as Actor,
  }

  return { store, gateway, clock, ids, actors }
}

let world = createWorld(loadPersisted())

function persist() {
  const data: PersistedState = {
    produces: [...world.store.produces.values()],
    batches: [...world.store.batches.values()],
    bookings: [...world.store.bookings.values()],
    alerts: [...world.store.alerts.values()],
    audit: world.store.audit,
  }
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}
const app = express()
app.use(express.json())

interface Client {
  res: express.Response
}
const clients = new Set<Client>()

function snapshot() {
  return {
    produces: [...world.store.produces.values()],
    batches: [...world.store.batches.values()],
    bookings: [...world.store.bookings.values()],
    alerts: [...world.store.alerts.values()],
    audit: world.store.audit.slice(-80),
    stats: {
      produces: world.store.produces.size,
      batches: world.store.batches.size,
      bookings: world.store.bookings.size,
      alerts: world.store.alerts.size,
      audit: world.store.audit.length,
    },
    ai: {
      deepseekConfigured: deepSeekConfigured(),
      model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
    },
    alertRules: ALERT_RULE_PACK,
  }
}

function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const client of clients) {
    client.res.write(payload)
  }
}

function broadcastState() {
  broadcast('state', snapshot())
}

function sendResult(
  res: express.Response,
  result: { ok: true; value: unknown } | { ok: false; error: unknown }
) {
  if (!result.ok) {
    res.status(400).json({ ok: false, error: result.error })
    return
  }
  res.json({ ok: true, data: result.value })
}

async function runAction<T>(
  fn: () => Promise<
    { ok: true; value: T } | { ok: false; error: unknown }
  >
) {
  const before = world.store.audit.length
  const result = await fn()
  const events = world.store.audit.slice(before)
  for (const event of events) broadcast('audit', event)
  persist()
  broadcastState()
  return result
}

app.get('/api/state', (_req, res) => {
  res.json(snapshot())
})

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  const client: Client = { res }
  clients.add(client)
  res.write(`event: state\ndata: ${JSON.stringify(snapshot())}\n\n`)
  req.on('close', () => {
    clients.delete(client)
  })
})

app.post('/api/farmer/submit', async (req, res, next) => {
  try {
    const result = await runAction(() =>
      world.gateway.invoke(world.actors.farmer, 'produce.submit', req.body)
    )
    sendResult(res, result)
  } catch (error) {
    next(error)
  }
})

app.post('/api/keeper/review', async (req, res, next) => {
  try {
    const result = await runAction(() =>
      world.gateway.invoke(world.actors.keeper, 'produce.review', req.body)
    )
    sendResult(res, result)
  } catch (error) {
    next(error)
  }
})

app.post('/api/keeper/review-ai', async (req, res, next) => {
  try {
    const produceId = String(req.body?.produceId ?? '')
    const produce = world.store.produces.get(produceId)
    if (!produce) {
      res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '蔬菜批次不存在' } })
      return
    }
    if (produce.status !== 'submitted') {
      res.status(400).json({ ok: false, error: { code: 'INVALID_STATUS', message: '只对待审批次给建议' } })
      return
    }

    const suggestion = await reviewProduceWithDeepSeek(produce)
    const auditEvent = {
      id: world.ids.next('audit'),
      type: 'review.suggested',
      occurredAt: world.clock.nowIso(),
      actorUid: world.actors.keeper.uid,
      payload: {
        produceId: produce.id,
        recommendation: suggestion.recommendation,
        agentId:
          suggestion.source === 'deepseek' ? 'deepseek-review-agent' : 'rule-review-agent',
        source: suggestion.source,
        confidence: suggestion.confidence,
        summary: suggestion.summary,
        approveReasons: suggestion.approveReasons,
        rejectReasons: suggestion.rejectReasons,
      },
    }
    world.store.audit.push(auditEvent)
    broadcast('audit', auditEvent)
    persist()
    broadcastState()
    res.json({ ok: true, data: suggestion })
  } catch (error) {
    next(error)
  }
})

app.post('/api/keeper/batch', async (req, res, next) => {
  try {
    const produceId = String(req.body?.produceId ?? '')
    const produce = world.store.produces.get(produceId)
    const productName =
      String(req.body?.productName ?? '') || produce?.vegetableName || '时令蔬菜'
    const result = await runAction(() =>
      world.gateway.invoke(world.actors.keeper, 'batch.create', {
        produceId,
        productName,
      })
    )
    sendResult(res, result)
  } catch (error) {
    next(error)
  }
})

app.post('/api/consumer/trace', async (req, res, next) => {
  try {
    const result = await runAction(() =>
      world.gateway.invoke(world.actors.consumer, 'trace.query', req.body)
    )
    sendResult(res, result)
  } catch (error) {
    next(error)
  }
})

app.post('/api/consumer/buy', async (req, res, next) => {
  try {
    const result = await runAction(() =>
      world.gateway.invoke(world.actors.consumer, 'booking.create', req.body)
    )
    sendResult(res, result)
  } catch (error) {
    next(error)
  }
})

app.post('/api/keeper/dispatch-ai', async (req, res, next) => {
  try {
    const bookingId = String(req.body?.bookingId ?? '')
    const result = await runAction(() =>
      runDispatcher(world.actors.keeper, bookingId, world.gateway)
    )
    sendResult(res, result)
  } catch (error) {
    next(error)
  }
})

app.post('/api/keeper/assign', async (req, res, next) => {
  try {
    const result = await runAction(() =>
      world.gateway.invoke(world.actors.keeper, 'dispatch.assign', req.body)
    )
    sendResult(res, result)
  } catch (error) {
    next(error)
  }
})

app.post('/api/admin/scan', async (req, res, next) => {
  try {
    const asOf =
      typeof req.body?.asOf === 'string' ? req.body.asOf : undefined
    const result = await runAction(() =>
      runAlertSentinel(world.actors.admin, world.gateway, asOf)
    )
    sendResult(res, result)
  } catch (error) {
    next(error)
  }
})

app.post('/api/auditor/ack', async (req, res, next) => {
  try {
    const result = await runAction(() =>
      world.gateway.invoke(world.actors.auditor, 'alert.ack', req.body)
    )
    sendResult(res, result)
  } catch (error) {
    next(error)
  }
})

app.post('/api/worker/drain', (_req, res) => {
  res.json({
    ok: true,
    data: {
      drained: 0,
      note: '本地模式使用进程内 SSE；CloudBase 模式使用 PostgreSQL 事件队列',
    },
  })
})

app.post('/api/reset', (_req, res) => {
  world = createWorld()
  persist()
  broadcastState()
  res.json({ ok: true })
})

app.use(express.static(path.join(__dirname, 'public')))

app.use(
  (
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: error.message } })
  }
)

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Live console: http://127.0.0.1:${PORT}`)
  console.log(
    deepSeekConfigured()
      ? 'DeepSeek: configured'
      : 'DeepSeek: not configured (fallback to rules)'
  )
})
