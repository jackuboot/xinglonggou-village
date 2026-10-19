/**
 * PostgreSQL 存储层：业务实体 + 持久化事件队列。
 *
 * 设计取舍：
 * - 该环境为 CloudBase 个人版，没有独立的 Kafka/TDMQ 实例，因此用
 *   PostgreSQL 事务表实现 outbox/queue 语义：pending → processing → done/failed，
 *   attempts 计数、失败重试、幂等消费；接口与真正的 broker 一致，后续可替换。
 * - 实体用 (kind,id) + jsonb 存储，避免预演阶段过早固化表结构。
 */
const crypto = require('crypto')
const CloudBaseManager = require('@cloudbase/manager-node')

const ENV_ID =
  process.env.SCF_NAMESPACE || process.env.TCB_ENV || process.env.ENV_ID || ''

let manager = null
let schemaPromise = null

function getManager() {
  if (!manager) manager = CloudBaseManager.init({ envId: ENV_ID })
  return manager
}

async function runSql(sql) {
  const common = getManager().commonService('tcb')
  return common.call({ Action: 'ExecutePGSql', Param: { EnvId: ENV_ID, Sql: sql } })
}

function parseValue(value) {
  if (value === null || value === undefined) return value
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function parseRows(res) {
  const rows = (res && res.Rows) || []
  const out = []
  for (const row of rows) {
    if (Array.isArray(row)) {
      out.push(row)
      continue
    }
    try {
      const parsed = JSON.parse(row)
      out.push(Array.isArray(parsed) ? parsed : [parsed])
    } catch {
      out.push([row])
    }
  }
  return out
}

function esc(value) {
  return "'" + String(value).replace(/'/g, "''") + "'"
}

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await runSql(
        'CREATE TABLE IF NOT EXISTS public.lc_entities (' +
          'kind text NOT NULL, ' +
          'id text NOT NULL, ' +
          "data jsonb NOT NULL DEFAULT '{}'::jsonb, " +
          'updated_at timestamptz NOT NULL DEFAULT now(), ' +
          'PRIMARY KEY (kind, id))'
      )
      await runSql(
        'CREATE TABLE IF NOT EXISTS public.lc_events (' +
          'id text PRIMARY KEY, ' +
          'topic text NOT NULL, ' +
          "payload jsonb NOT NULL DEFAULT '{}'::jsonb, " +
          "status text NOT NULL DEFAULT 'pending', " +
          'attempts integer NOT NULL DEFAULT 0, ' +
          'created_at timestamptz NOT NULL DEFAULT now(), ' +
          'processed_at timestamptz, ' +
          'last_error text)'
      )
      await runSql(
        'CREATE INDEX IF NOT EXISTS lc_events_status_idx ' +
          'ON public.lc_events (status, created_at)'
      )
      await seedKeepers()
    })().catch((error) => {
      schemaPromise = null
      throw error
    })
  }
  return schemaPromise
}

async function seedKeepers() {
  const keepers = [
    { uid: 'keeper-001', name: '王入库', villageId: 'village-xinglonggou' },
    { uid: 'keeper-002', name: '刘入库', villageId: 'village-other' },
  ]
  for (const keeper of keepers) {
    await putIfAbsent('keeper', keeper.uid, keeper)
  }
}

async function list(kind) {
  const order =
    kind === 'audit' ? "(data->>'occurredAt') ASC" : 'updated_at ASC'
  const res = await runSql(
    `SELECT data FROM public.lc_entities WHERE kind = ${esc(kind)} ORDER BY ${order}`
  )
  return parseRows(res).map(([data]) => parseValue(data))
}

async function get(kind, id) {
  const res = await runSql(
    `SELECT data FROM public.lc_entities WHERE kind = ${esc(kind)} AND id = ${esc(id)} LIMIT 1`
  )
  const rows = parseRows(res)
  return rows.length ? parseValue(rows[0][0]) : null
}

async function put(kind, id, data) {
  await runSql(
    'INSERT INTO public.lc_entities (kind, id, data, updated_at) VALUES (' +
      `${esc(kind)}, ${esc(id)}, ${esc(JSON.stringify(data))}::jsonb, now()) ` +
      'ON CONFLICT (kind, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()'
  )
}

async function putIfAbsent(kind, id, data) {
  await runSql(
    'INSERT INTO public.lc_entities (kind, id, data, updated_at) VALUES (' +
      `${esc(kind)}, ${esc(id)}, ${esc(JSON.stringify(data))}::jsonb, now()) ` +
      'ON CONFLICT (kind, id) DO NOTHING'
  )
}

async function count(kind) {
  const res = await runSql(
    `SELECT count(*) FROM public.lc_entities WHERE kind = ${esc(kind)}`
  )
  const rows = parseRows(res)
  return rows.length ? Number(rows[0][0]) : 0
}

async function enqueue(topic, payload) {
  const id = `evt-${crypto.randomUUID().slice(0, 12)}`
  await runSql(
    'INSERT INTO public.lc_events (id, topic, payload) VALUES (' +
      `${esc(id)}, ${esc(topic)}, ${esc(JSON.stringify(payload))}::jsonb)`
  )
  return id
}

async function recoverStale() {
  await runSql(
    "UPDATE public.lc_events SET status = 'pending' " +
      "WHERE status = 'processing' AND attempts < 5 " +
      "AND created_at < now() - interval '2 minutes'"
  )
}

async function claimPending(limit) {
  const res = await runSql(
    'SELECT id, topic, payload, attempts FROM public.lc_events ' +
      `WHERE status = 'pending' ORDER BY created_at ASC LIMIT ${Number(limit) || 20}`
  )
  return parseRows(res).map(([id, topic, payload, attempts]) => ({
    id: String(id),
    topic: String(topic),
    payload: parseValue(payload),
    attempts: Number(attempts) || 0,
  }))
}

async function markProcessing(id) {
  await runSql(
    "UPDATE public.lc_events SET status = 'processing', attempts = attempts + 1 " +
      `WHERE id = ${esc(id)} AND status = 'pending'`
  )
}

async function markDone(id) {
  await runSql(
    "UPDATE public.lc_events SET status = 'done', processed_at = now(), last_error = NULL " +
      `WHERE id = ${esc(id)}`
  )
}

async function markFailed(id, error) {
  await runSql(
    "UPDATE public.lc_events SET status = 'failed', last_error = " +
      `${esc(String(error && error.message ? error.message : error).slice(0, 500))} ` +
      `WHERE id = ${esc(id)}`
  )
}

async function markRetry(id, error) {
  await runSql(
    "UPDATE public.lc_events SET status = 'pending', last_error = " +
      `${esc(String(error && error.message ? error.message : error).slice(0, 500))} ` +
      `WHERE id = ${esc(id)}`
  )
}

/**
 * 幂等消费者：审计事件按 `audit-<eventId>` 落库，
 * 同一事件至少投递一次也不会产生重复审计。
 */
async function drainQueue(limit = 20) {
  await recoverStale()
  const pending = await claimPending(limit)
  for (const event of pending) {
    await markProcessing(event.id)
    try {
      if (event.topic.startsWith('audit.')) {
        const audit = event.payload || {}
        const id = `audit-${event.id}`
        await put('audit', id, { id, ...audit })
      }
      await markDone(event.id)
    } catch (error) {
      if (event.attempts + 1 >= 5) {
        await markFailed(event.id, error)
      } else {
        await markRetry(event.id, error)
      }
    }
  }
  return pending.length
}

async function queueStats() {
  const countsRes = await runSql(
    'SELECT status, count(*) FROM public.lc_events GROUP BY status'
  )
  const counts = { pending: 0, processing: 0, done: 0, failed: 0 }
  for (const [status, value] of parseRows(countsRes)) {
    if (status in counts) counts[status] = Number(value)
  }
  const recentRes = await runSql(
    'SELECT id, topic, status, attempts, ' +
      "to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD\"T\"HH24:MI:SS') " +
      'FROM public.lc_events ORDER BY created_at DESC LIMIT 8'
  )
  const recent = parseRows(recentRes).map(
    ([id, topic, status, attempts, createdAt]) => ({
      id,
      topic,
      status,
      attempts: Number(attempts),
      createdAt,
    })
  )
  return {
    ...counts,
    total: counts.pending + counts.processing + counts.done + counts.failed,
    recent,
  }
}

async function resetAll() {
  await runSql("DELETE FROM public.lc_entities WHERE kind <> 'keeper'")
  await runSql('DELETE FROM public.lc_events')
}

module.exports = {
  ENV_ID,
  ensureSchema,
  seedKeepers,
  list,
  get,
  put,
  putIfAbsent,
  count,
  enqueue,
  drainQueue,
  queueStats,
  resetAll,
}
