const $ = (id) => document.getElementById(id)
const API_BASE = (window.LC_API_BASE || '').replace(/\/$/, '')
const useSse = !API_BASE

function apiUrl(path) {
  return `${API_BASE}${path}`
}

let state = {
  produces: [],
  batches: [],
  bookings: [],
  alerts: [],
  audit: [],
  stats: {},
  ai: { deepseekConfigured: false, model: '' },
}

let selectedGoodsId = null
let goodsFilter = 'all'
let goodSuggestions = {}
const autoReviewing = new Set()
const autoReviewAttempted = new Set()
let busy = false
let submitFormOpen = false
let formInitialized = false

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'review', label: '待审核' },
  { key: 'inspection', label: '待质检' },
  { key: 'inbound', label: '待上架' },
  { key: 'listed', label: '待下单' },
  { key: 'ordered', label: '已下单' },
  { key: 'done', label: '已派单' },
  { key: 'rejected', label: '已驳回' },
]

const STATIONS = {
  origin: {
    id: 'origin',
    name: '提交港',
    location: '3组田间',
    caps: ['收货', '贴码'],
  },
  review: {
    id: 'review',
    name: '审核站',
    location: '村委',
    caps: ['AI审核', '人工拍板'],
    humanGate: true,
  },
  inspection: {
    id: 'inspection',
    name: '质检/维修站',
    location: '乡镇农技站',
    caps: ['数量核验', '品类核验', '质量抽检'],
    humanGate: true,
    branch: true,
  },
  warehouse: {
    id: 'warehouse',
    name: '入库站',
    location: '兴隆沟保鲜库',
    caps: ['称重', '入库', '冷藏'],
  },
  listing: {
    id: 'listing',
    name: '上架站',
    location: '村电商服务站',
    caps: ['批次', '定价', '溯源码'],
  },
  market: {
    id: 'market',
    name: '交易港',
    location: '线上',
    caps: ['溯源', '下单'],
  },
  fulfillment: {
    id: 'fulfillment',
    name: '履约站',
    location: '村配送点',
    caps: ['派单', '配送'],
  },
  audit: {
    id: 'audit',
    name: '审计灯塔',
    location: '县审计',
    caps: ['留痕', '预警'],
  },
}

const MAIN_STATIONS = [
  'origin',
  'review',
  'warehouse',
  'listing',
  'market',
  'fulfillment',
  'audit',
]

const STATION_RANK = {
  origin: 0,
  review: 1,
  warehouse: 2,
  listing: 3,
  market: 4,
  fulfillment: 5,
  audit: 6,
}

const PRICE_PER_KG = {
  大白菜: 3.6,
  时令蔬菜: 5,
  高山云雾茶: 128,
  土豆: 2.8,
  萝卜: 2.5,
}

const STATUS_LABELS = {
  submitted: '待审核',
  active: '已生效',
  rejected: '已驳回',
  available: '可售',
  booked: '已下单',
  open: '待处置',
  acknowledged: '已确认',
}

function statusLabel(value) {
  return STATUS_LABELS[value] || value
}

const ROLE_LABELS = {
  farmer: '农户',
  keeper: '入库员',
  consumer: '消费者',
  auditor: '审计员',
  admin: '管理员',
}

function roleLabel(role) {
  return ROLE_LABELS[role] || role
}

function formatDuration(minutes) {
  const value = Math.max(0, Math.round(Number(minutes) || 0))
  if (value < 60) return `${value} 分钟`
  if (value < 1440) {
    const hours = Math.floor(value / 60)
    const rest = value % 60
    return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`
  }
  const days = Math.floor(value / 1440)
  const hours = Math.floor((value % 1440) / 60)
  return hours ? `${days} 天 ${hours} 小时` : `${days} 天`
}

const EVENT_LABELS = {
  'produce.submitted': '货物提交',
  'review.suggested': 'AI审核建议',
  'produce.approved': '审核通过',
  'produce.rejected': '审核驳回',
  'batch.created': '批次生成',
  'booking.created': '消费者下单',
  'dispatch.suggested': 'AI派单建议',
  'dispatch.assigned': '派单确认',
  'alert.scanned': '预警扫描',
  'alert.raised': '预警触发',
  'alert.escalated': '预警升级',
  'alert.resolved': '预警解除',
  'alert.acknowledged': '告警确认',
  'access.denied': '越权拒绝',
}

function eventLabel(type) {
  return EVENT_LABELS[type] || type
}

function auditText(event) {
  const payload = event.payload || {}
  if (event.type === 'produce.submitted') return '农户提交货物'
  if (event.type === 'review.suggested') {
    return `AI 建议${payload.recommendation === 'approve' ? '通过' : '驳回'} · 置信度 ${payload.confidence}`
  }
  if (event.type === 'produce.approved') return '入库员确认通过'
  if (event.type === 'produce.rejected') return '入库员确认驳回'
  if (event.type === 'batch.created') return '系统生成上架批次'
  if (event.type === 'booking.created') return '消费者下单'
  if (event.type === 'dispatch.suggested') {
    return payload.assigneeUid
      ? `AI 建议派单给 ${payload.assigneeUid}`
      : 'AI 未找到可用履约人'
  }
  if (event.type === 'dispatch.assigned') {
    return `确认派单给 ${payload.assigneeUid}`
  }
  if (event.type === 'alert.scanned') {
    return `预警扫描：新增 ${payload.created ?? 0}，更新 ${
      payload.updated ?? 0
    }，解除 ${payload.resolved ?? 0}`
  }
  if (event.type === 'alert.raised') {
    return `规则「${ruleLabel(payload.ruleId)}」触发 · ${severityLabel(
      payload.severity
    )}`
  }
  if (event.type === 'alert.escalated') {
    return `规则「${ruleLabel(payload.ruleId)}」升级：${severityLabel(
      payload.from
    )} → ${severityLabel(payload.to)}`
  }
  if (event.type === 'alert.resolved') {
    return `规则「${ruleLabel(payload.ruleId)}」自动解除`
  }
  if (event.type === 'alert.acknowledged') return '审计员确认告警'
  if (event.type === 'access.denied') return '越权调用被拒绝'
  return JSON.stringify(payload)
}

const ALERT_META = {
  stale_produce: {
    label: '待审超时',
    hint: '入库员尽快审核，避免货物一直停在待审。',
  },
  unsold_batch: {
    label: '批次滞销',
    hint: '入库员确认是否调整上架信息或下架，避免批次长期无订单。',
  },
  unassigned_booking: {
    label: '订单未派单',
    hint: '履约站尽快确认承接人，避免订单一直无人处理。',
  },
}

function alertView(alert) {
  const meta = ALERT_META[alert.type] || {
    label: '需要处理',
    hint: '请人工确认后处理。',
  }
  let produce = null
  let detail = alert.message || '有一条预警需要处理'

  if (alert.type === 'unsold_batch') {
    const batch = state.batches.find((item) => item.id === alert.targetId)
    produce = batch
      ? state.produces.find((item) => item.id === batch.produceId) || null
      : null
    detail = produce
      ? `${produce.vegetableName} · 批次 ${batchCode(batch)} 上架后仍无订单`
      : '有批次上架后仍无订单'
  } else if (alert.type === 'stale_produce') {
    produce = state.produces.find((item) => item.id === alert.targetId) || null
    detail = produce
      ? `${produce.vegetableName} · ${produce.quantityKg} 公斤提交后尚未审核`
      : '有货物提交后尚未审核'
  } else if (alert.type === 'unassigned_booking') {
    const booking = state.bookings.find((item) => item.id === alert.targetId)
    const batch = booking
      ? state.batches.find((item) => item.id === booking.batchId)
      : null
    produce = batch
      ? state.produces.find((item) => item.id === batch.produceId) || null
      : null
    detail = booking
      ? `${produce ? produce.vegetableName + ' · ' : ''}订单 ${orderCode(
          booking
        )} 已下单但尚未派单`
      : '有订单已下单但尚未派单'
  }

  const evaluatedAt = alert.asOf || alert.createdAt
  const simulated = Boolean(
    alert.asOf &&
      Math.abs(Date.parse(alert.asOf) - Date.parse(alert.createdAt)) > 60000
  )
  return {
    label: meta.label,
    hint: meta.hint,
    detail,
    produce,
    severityLabel: alert.severity === 'critical' ? '高优先级' : '需关注',
    time: formatTime(evaluatedAt),
    timeLabel: simulated ? '模拟评估' : '评估',
    ageMinutes: alert.ageMinutes,
    thresholdMinutes: alert.thresholdMinutes,
    ruleTitle: ruleForType(alert.type)?.title || '',
  }
}

function ruleForType(type) {
  return state.alertRules?.rules?.find((rule) => rule.type === type)
}

function ruleLabel(ruleId) {
  if (!ruleId) return '旧版预警规则'
  const rule = state.alertRules?.rules?.find((item) => item.id === ruleId)
  return rule?.title || '预警规则'
}

function severityLabel(value) {
  return value === 'critical' ? '高优先级' : '需关注'
}

function alertIsRelevant(alert) {
  let entityTime = null
  let condition = false

  if (alert.type === 'stale_produce') {
    const produce = state.produces.find((item) => item.id === alert.targetId)
    condition = Boolean(produce && produce.status === 'submitted')
    entityTime = produce?.submittedAt || null
  } else if (alert.type === 'unsold_batch') {
    const batch = state.batches.find((item) => item.id === alert.targetId)
    condition = Boolean(
      batch && !state.bookings.some((item) => item.batchId === batch.id)
    )
    entityTime = batch?.createdAt || null
  } else if (alert.type === 'unassigned_booking') {
    const booking = state.bookings.find((item) => item.id === alert.targetId)
    condition = Boolean(booking && !booking.assignedTo)
    entityTime = booking?.createdAt || null
  } else {
    return true
  }

  if (!condition) return false
  const rule = ruleForType(alert.type)
  if (!rule) return true
  const age =
    typeof alert.ageMinutes === 'number'
      ? alert.ageMinutes
      : entityTime
        ? Math.max(
            0,
            Math.floor((Date.now() - Date.parse(entityTime)) / 60000)
          )
        : 0
  return age >= rule.warnAfterMinutes
}

function openAlertCount() {
  return state.alerts.filter(
    (alert) => alert.status === 'open' && alertIsRelevant(alert)
  ).length
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function toast(message, isError = false) {
  const el = $('toast')
  el.textContent = message
  el.classList.toggle('error', isError)
  el.classList.add('show')
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => el.classList.remove('show'), 3200)
}

async function api(path, body) {
  const response = await fetch(apiUrl(path), {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json()
  if (!response.ok || payload.ok === false) {
    const error = payload.error || {}
    throw new Error(error.message || error.code || `HTTP ${response.status}`)
  }
  return payload.data
}

function formatTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function shortCode(id, prefix) {
  return String(id).replace(new RegExp(`^${prefix}-`), '').slice(0, 6).toUpperCase()
}

function goodsCode(produce) {
  return `XLG-${shortCode(produce.id, 'produce')}`
}

function inboundCode(produce) {
  return `RK-${shortCode(produce.id, 'produce')}`
}

function batchCode(batch) {
  return `PC-${shortCode(batch.id, 'batch')}`
}

function traceCode(batch) {
  return `SY-${shortCode(batch.id, 'batch')}`
}

function orderCode(booking) {
  return `DD-${shortCode(booking.id, 'booking')}`
}

function suggestedPrice(produce) {
  return PRICE_PER_KG[produce.vegetableName] ?? 6
}

function produceProfile(produce, suggestion) {
  const name = String(produce.vegetableName || '')
  const nonVegetable = /茶|果|粮|肉|禽|蛋|奶/.test(name)
  return {
    category: nonVegetable ? '非蔬菜（需核对品类）' : '蔬菜',
    storage: nonVegetable ? '按品类另行储存' : '0–4°C 冷藏，避免挤压',
    risk: suggestion
      ? suggestion.recommendation === 'reject'
        ? '存在风险，等待人工确认'
        : '暂无阻断性风险'
      : '待 AI 审核',
  }
}

function todayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
  }).format(new Date())
}

function anomalyFlags(journey) {
  const produce = journey.produce
  const flags = []
  if (Number(produce.quantityKg) > 500) flags.push('数量超过 500 公斤')
  if (String(produce.harvestDate) > todayIso()) flags.push('采收日期晚于今天')
  if (/茶|果|粮|肉|禽|蛋|奶/.test(String(produce.vegetableName || ''))) {
    flags.push('品类可能不是蔬菜')
  }
  if (journey.suggestion?.recommendation === 'reject') flags.push('AI 建议驳回')
  return flags
}

function cargoPosition(journey) {
  const flags = anomalyFlags(journey)
  const produce = journey.produce
  const rejected = produce.status === 'rejected'
  const gate = flags.length ? 'inspection' : 'review'
  if (rejected) {
    return {
      currentId: gate,
      currentRank: 1,
      nextId: null,
      stateText: '旅程终止',
    }
  }
  if (produce.status === 'submitted') {
    return {
      currentId: gate,
      currentRank: 1,
      nextId: 'warehouse',
      stateText: '等待人工拍板',
    }
  }
  if (!journey.batch) {
    return {
      currentId: 'warehouse',
      currentRank: 2,
      nextId: 'listing',
      stateText: '自动入库处理中',
    }
  }
  if (!journey.booking) {
    return {
      currentId: 'market',
      currentRank: 4,
      nextId: 'fulfillment',
      stateText: '已上架，等待消费者',
    }
  }
  if (!journey.booking.assignedTo) {
    return {
      currentId: 'fulfillment',
      currentRank: 5,
      nextId: 'audit',
      stateText: '订单已生成，等待派单',
    }
  }
  return {
    currentId: 'audit',
    currentRank: 6,
    nextId: null,
    stateText: '已派单，审计留痕中',
  }
}

function stationVisualState(stationId, journey, position, flags) {
  const rejected = journey.produce.status === 'rejected'
  if (stationId === position.currentId) return rejected ? 'rejected' : 'current'
  if (stationId === position.nextId) return 'next'
  if (stationId === 'inspection') {
    if (!flags.length) return 'branch'
    return 'passed'
  }
  if (stationId === 'review' && position.currentId === 'inspection') {
    return 'skipped'
  }
  const rank = STATION_RANK[stationId]
  if (rank === undefined) return 'future'
  if (rank < position.currentRank) return 'passed'
  return 'future'
}

function stationNode(station, stateClass, badges) {
  return `<div class="map-station ${stateClass}">
    <div class="station-top">
      <span class="station-name">${esc(station.name)}</span>
      ${badges
        .filter(Boolean)
        .map((badge) => `<span class="station-badge">${esc(badge)}</span>`)
        .join('')}
    </div>
    <div class="station-loc">${esc(station.location)}</div>
    <div class="station-caps">${station.caps
      .map((cap) => `<span>${esc(cap)}</span>`)
      .join('')}</div>
  </div>`
}

function renderWorldMap(journey) {
  const flags = anomalyFlags(journey)
  const position = cargoPosition(journey)
  const rejected = journey.produce.status === 'rejected'
  const main = MAIN_STATIONS.map((id, index) => {
    const state = stationVisualState(id, journey, position, flags)
    const badges = []
    if (id === position.currentId) {
      badges.push(rejected ? '已终止' : '货物在此')
    }
    if (id === position.nextId) badges.push('下一站')
    if (state === 'skipped') badges.push('异常改道')
    return `${index ? '<span class="map-arrow">→</span>' : ''}${stationNode(
      STATIONS[id],
      state,
      badges
    )}`
  }).join('')

  const inspectionState = stationVisualState(
    'inspection',
    journey,
    position,
    flags
  )
  const inspectionBadges = []
  if (position.currentId === 'inspection') {
    inspectionBadges.push(rejected ? '已终止' : '货物在此')
  }
  if (flags.length && inspectionState === 'passed') {
    inspectionBadges.push('已处理')
  }

  return `<section class="world-map">
    <div class="map-head">
      <h3>世界地图</h3>
      <span>货物携带这张站点能力表，自检后选择下一站</span>
    </div>
    <div class="map-route">${main}</div>
    <div class="map-branch">
      <span class="branch-lead">异常改道</span>
      ${stationNode(STATIONS.inspection, inspectionState, inspectionBadges)}
    </div>
  </section>`
}

function autonomyLog(journey) {
  const { produce, suggestion, approval, rejection, batch, booking, assignment } =
    journey
  const flags = anomalyFlags(journey)
  const position = cargoPosition(journey)
  const suggestionEvent = [...state.audit]
    .reverse()
    .find(
      (event) =>
        event.type === 'review.suggested' &&
        event.payload &&
        event.payload.produceId === produce.id
    )
  const entries = [
    {
      time: produce.submittedAt,
      text: `我从${produce.groupName}出发，装载 ${produce.vegetableName} ${produce.quantityKg} 公斤。`,
    },
    {
      time: produce.submittedAt,
      text: flags.length
        ? `自检发现：${flags.join('；')}。我申请改道最近的质检/维修站。`
        : '自检通过：品类、数量、采收日期正常。我申请进入审核站。',
    },
  ]
  if (suggestion) {
    entries.push({
      time: suggestionEvent?.occurredAt || produce.submittedAt,
      text: `站点返回 AI 建议：${
        suggestion.recommendation === 'approve' ? '通过' : '驳回'
      }，置信度 ${suggestion.confidence}。${
        produce.status === 'submitted' ? '等待人工拍板。' : '已完成人工确认。'
      }`,
    })
  }
  if (approval) {
    entries.push({
      time: approval.occurredAt,
      text: '人工确认通过；我更新为已生效，自动前往入库站。',
    })
  }
  if (rejection) {
    entries.push({
      time: rejection.occurredAt,
      text: '人工确认驳回；我的旅程终止。',
    })
  }
  if (batch) {
    entries.push({
      time: batch.createdAt,
      text: `入库站完成称重/冷藏；上架站生成批次 ${batchCode(
        batch
      )}、溯源码 ${traceCode(batch)}。我前往交易港等待买家。`,
    })
  }
  if (booking) {
    entries.push({
      time: booking.createdAt,
      text: `交易港收到订单 ${orderCode(
        booking
      )}；我携带订单前往履约站。`,
    })
  }
  if (assignment) {
    entries.push({
      time: assignment.occurredAt,
      text: `履约站确认由 ${booking.assignedTo} 承接；我进入审计灯塔留痕。`,
    })
  }
  if (!rejection) {
    entries.push({
      time: null,
      text: `当前停在${STATIONS[position.currentId].name}；目的地：${
        position.nextId ? STATIONS[position.nextId].name : '旅程终点'
      }。`,
    })
  }
  return entries
}

function renderAutonomyLog(journey) {
  const entries = autonomyLog(journey)
  return `<section class="autonomy">
    <div class="map-head">
      <h3>货物自治日志</h3>
      <span>模拟：货物如何判断自己该去哪</span>
    </div>
    <ol class="autonomy-log">${entries
      .map(
        (entry) => `<li>
          <span class="log-time">${entry.time ? esc(formatTime(entry.time)) : '现在'}</span>
          <span>${esc(entry.text)}</span>
        </li>`
      )
      .join('')}</ol>
  </section>`
}

function shelfFor(batch) {
  const value = Number.parseInt(String(batch.id).slice(-2), 16)
  const number = Number.isFinite(value) ? (value % 20) + 1 : 1
  return `A-${String(number).padStart(2, '0')}`
}

function findAuditSuggestion(produceId) {
  const event = [...state.audit]
    .reverse()
    .find(
      (item) =>
        item.type === 'review.suggested' &&
        item.payload &&
        item.payload.produceId === produceId
    )
  if (!event) return null
  const payload = event.payload || {}
  if (
    !Array.isArray(payload.approveReasons) &&
    !Array.isArray(payload.rejectReasons)
  ) {
    return null
  }
  const isDeepSeek = String(payload.agentId || '').includes('deepseek')
  return {
    produceId,
    recommendation: payload.recommendation,
    confidence: payload.confidence,
    summary: payload.summary || '',
    approveReasons: payload.approveReasons || [],
    rejectReasons: payload.rejectReasons || [],
    source: isDeepSeek ? 'deepseek' : 'fallback',
    model: isDeepSeek ? 'deepseek-chat' : 'rule-based',
    requiresHumanDecision: true,
  }
}

function journeyOf(produce) {
  const batch = state.batches.find((item) => item.produceId === produce.id) || null
  const booking = batch
    ? state.bookings.find((item) => item.batchId === batch.id) || null
    : null
  const suggestion =
    goodSuggestions[produce.id] || findAuditSuggestion(produce.id)
  const approval =
    [...state.audit]
      .reverse()
      .find(
        (item) =>
          item.type === 'produce.approved' &&
          item.payload &&
          item.payload.produceId === produce.id
      ) || null
  const rejection =
    [...state.audit]
      .reverse()
      .find(
        (item) =>
          item.type === 'produce.rejected' &&
          item.payload &&
          item.payload.produceId === produce.id
      ) || null
  const assignment =
    booking && booking.assignedTo
      ? [...state.audit]
          .reverse()
          .find(
            (item) =>
              item.type === 'dispatch.assigned' &&
              item.payload &&
              item.payload.bookingId === booking.id
          ) || null
      : null

  const relatedAudit = state.audit.filter((event) => {
    const payload = event.payload || {}
    return (
      payload.produceId === produce.id ||
      (batch && payload.batchId === batch.id) ||
      (booking && payload.bookingId === booking.id)
    )
  })
  const relatedAlerts = state.alerts.filter((alert) =>
    [produce.id, batch && batch.id, booking && booking.id]
      .filter(Boolean)
      .includes(alert.targetId)
  )

  return {
    produce,
    batch,
    booking,
    suggestion,
    approval,
    rejection,
    assignment,
    relatedAudit,
    relatedAlerts,
    price: suggestedPrice(produce),
  }
}

function stageMeta(journey) {
  if (journey.produce.status === 'rejected') {
    return { key: 'rejected', label: '已驳回', cls: 'bad' }
  }
  if (journey.booking && journey.booking.assignedTo) {
    return { key: 'done', label: '已派单', cls: 'ok' }
  }
  if (journey.booking) {
    return { key: 'ordered', label: '已下单', cls: 'info' }
  }
  if (journey.batch) {
    return { key: 'listed', label: '已上架', cls: 'info' }
  }
  if (journey.produce.status === 'active') {
    return { key: 'inbound', label: '已入库', cls: 'warn' }
  }
  if (anomalyFlags(journey).length) {
    return { key: 'inspection', label: '待质检', cls: 'hot' }
  }
  return { key: 'review', label: '待审核', cls: 'hot' }
}

function nextAction(journey) {
  const meta = stageMeta(journey)
  if (meta.key === 'rejected') return '流程已终止，可重新提交货物'
  if (meta.key === 'done') {
    return `已派给 ${journey.booking.assignedTo}，等待履约与审计`
  }
  if (meta.key === 'ordered') return 'AI 自动派单'
  if (meta.key === 'listed') return '消费者下单'
  if (meta.key === 'inbound') return '系统生成上架批次'
  if (meta.key === 'inspection') return '质检/维修站人工核验'
  return '入库员审核 AI 建议'
}

function stepState(journey, stepId) {
  const rejected = journey.produce.status === 'rejected'
  const approved =
    journey.produce.status === 'active' || Boolean(journey.batch)
  if (stepId === 'submit') return 'done'
  if (stepId === 'review') {
    return rejected ? 'rejected' : approved ? 'done' : 'current'
  }
  if (stepId === 'inbound') {
    return rejected ? 'future' : approved ? 'done' : 'future'
  }
  if (stepId === 'listing') {
    if (rejected) return 'future'
    if (journey.batch) return 'done'
    return approved ? 'current' : 'future'
  }
  if (stepId === 'order') {
    if (journey.booking) return 'done'
    return journey.batch ? 'current' : 'future'
  }
  if (stepId === 'done') {
    if (journey.booking && journey.booking.assignedTo) return 'done'
    return journey.booking ? 'current' : 'future'
  }
  return 'future'
}

function allGoods() {
  const order = {
    inspection: 0,
    review: 0,
    inbound: 1,
    listed: 2,
    ordered: 3,
    done: 4,
    rejected: 5,
  }
  return state.produces
    .map((produce) => {
      const journey = journeyOf(produce)
      return { produce, journey, meta: stageMeta(journey) }
    })
    .sort((a, b) => {
      const byStage = order[a.meta.key] - order[b.meta.key]
      if (byStage !== 0) return byStage
      return String(b.produce.submittedAt).localeCompare(
        String(a.produce.submittedAt)
      )
    })
}

function filteredGoods() {
  const all = allGoods()
  if (goodsFilter === 'all') return all
  return all.filter((item) => item.meta.key === goodsFilter)
}

function ensureSelection() {
  const all = allGoods()
  if (!all.length) {
    selectedGoodsId = null
    return
  }
  const filtered = filteredGoods()
  if (!filtered.some((item) => item.produce.id === selectedGoodsId)) {
    selectedGoodsId = filtered[0]?.produce.id ?? null
  }
}

function artifactGrid(rows) {
  return `<div class="artifact-grid">${rows
    .map(
      ([label, value]) =>
        `<div class="artifact"><span>${esc(label)}</span><b>${esc(value)}</b></div>`
    )
    .join('')}</div>`
}

function auditRows(events) {
  if (!events.length) return '<div class="placeholder">暂无审计事件</div>'
  return `<div class="audit-list">${events
    .slice(-8)
    .reverse()
    .map((event) => {
      const payload = event.payload || {}
      const agent = payload.agentId ? ` · ${payload.agentId}` : ''
      return `<div class="audit-row">
        <span class="type" title="${esc(event.type)}">${esc(eventLabel(event.type))}</span>
        <span class="actor">${esc(event.actorUid)}</span>
        <span class="detail">${esc(auditText(event) + agent)}</span>
      </div>`
    })
    .join('')}</div>`
}

function suggestionBody(suggestion, options = {}) {
  const approve = suggestion.recommendation === 'approve'
  const primary = approve ? suggestion.approveReasons : suggestion.rejectReasons
  const opposite = approve ? suggestion.rejectReasons : suggestion.approveReasons
  const primaryLabel = approve ? '建议通过的理由' : '建议驳回的理由'
  const oppositeLabel = approve
    ? '反方参考：支持驳回的理由'
    : '反方参考：支持通过的理由'
  return `
    <div class="verdict-row">
      <strong class="${approve ? 'approve' : 'reject'}">${approve ? '建议通过' : '建议驳回'}</strong>
      <span class="sub">${esc(suggestion.source === 'deepseek' ? 'DeepSeek' : '规则兜底')} · 置信度 ${esc(suggestion.confidence)}</span>
    </div>
    ${suggestion.summary ? `<p class="review-summary">${esc(suggestion.summary)}</p>` : ''}
    <div class="reason-block ${approve ? 'approve' : 'reject'}">
      <h4>${primaryLabel}</h4>
      <ul>${(primary && primary.length ? primary : ['无']).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
    </div>
    ${
      opposite && opposite.length
        ? `<details class="opposite">
            <summary>${oppositeLabel}（${opposite.length} 条）</summary>
            <ul>${opposite.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
          </details>`
        : '<div class="placeholder">反方参考：无</div>'
    }
    ${options.actions ? `<div class="review-actions">${options.actions}</div>` : ''}
    ${options.note ? `<div class="review-note">${options.note}</div>` : ''}
  `
}

function stepCard(number, title, tag, body, stateClass) {
  return `<article class="step-card ${stateClass}">
    <div class="step-marker">${number}</div>
    <div class="step-body">
      <div class="step-title">${title} ${tag}</div>
      ${body}
    </div>
  </article>`
}

function renderSummary() {
  const all = allGoods()
  const counts = { all: all.length }
  for (const item of all) {
    counts[item.meta.key] = (counts[item.meta.key] || 0) + 1
  }
  $('summary').innerHTML = FILTERS.map(
    (filter) => `<button class="chip ${goodsFilter === filter.key ? 'active' : ''}" data-filter="${filter.key}">
      ${filter.label} <b>${counts[filter.key] || 0}</b>
    </button>`
  ).join('')
}

function renderGoodsList() {
  const list = filteredGoods()
  if (!list.length) {
    $('goods-list').innerHTML =
      '<div class="placeholder">当前筛选下没有货物。</div>'
    return
  }
  $('goods-list').innerHTML = list
    .map(({ produce, journey, meta }) => {
      const active = produce.id === selectedGoodsId ? 'active' : ''
      return `<button class="goods-item ${active}" data-goods="${esc(produce.id)}">
        <div class="goods-top">
          <span class="goods-code">${esc(goodsCode(produce))}</span>
          <span class="stage-badge ${meta.cls}">${esc(meta.label)}</span>
        </div>
        <span class="goods-name">${esc(produce.vegetableName)} · ${esc(produce.quantityKg)} 公斤</span>
        <span class="goods-meta">${esc(produce.groupName)} · 采收 ${esc(produce.harvestDate)}</span>
        <span class="goods-next">下一步：${esc(nextAction(journey))}</span>
      </button>`
    })
    .join('')
}

function renderSubmitCard(journey) {
  const { produce, suggestion } = journey
  const profile = produceProfile(produce, suggestion)
  return stepCard(
    1,
    '提交港 · 货物档案',
    '<span class="tag human">农户提交</span> <span class="tag auto">系统预生成</span>',
    artifactGrid([
      ['货物码', goodsCode(produce)],
      ['村组', produce.groupName],
      ['品种', produce.vegetableName],
      ['数量', `${produce.quantityKg} 公斤`],
      ['采收日期', produce.harvestDate],
      ['提交时间', formatTime(produce.submittedAt)],
      ['品类判断', profile.category],
      ['存储建议', profile.storage],
      ['风险提示', profile.risk],
    ]),
    'done'
  )
}

function renderReviewCard(journey) {
  const { produce, suggestion, approval, rejection } = journey
  const flags = anomalyFlags(journey)
  const stationTitle = flags.length
    ? '质检/维修站 · 人工核验'
    : '审核站 · 人工审核'
  const stationTag = flags.length
    ? '<span class="tag ai">质检站</span>'
    : '<span class="tag ai">审核站</span>'
  const stateClass = stepState(journey, 'review')

  if (produce.status === 'rejected') {
    const overridden = Boolean(
      suggestion && suggestion.recommendation === 'approve'
    )
    const reasons = overridden ? [] : suggestion?.rejectReasons || []
    return stepCard(
      2,
      stationTitle,
      stationTag + '<span class="tag human">人工确认</span>',
      `<div class="verdict-row">
        <strong class="reject">${overridden ? '人工改判：驳回' : '人工确认：驳回'}</strong>
        <span class="sub">${esc(formatTime(rejection?.occurredAt))}</span>
      </div>
      ${
        overridden
          ? '<div class="placeholder">AI 原本建议通过，人工改判为驳回。</div>'
          : reasons.length
            ? `<div class="reason-block reject"><h4>驳回理由</h4><ul>${reasons
                .map((item) => `<li>${esc(item)}</li>`)
                .join('')}</ul></div>`
            : '<div class="placeholder">未记录驳回理由。</div>'
      }`,
      'rejected'
    )
  }

  if (produce.status === 'active' || journey.batch) {
    const overridden = Boolean(
      suggestion && suggestion.recommendation !== 'approve'
    )
    const reasons = suggestion
      ? (overridden ? suggestion.rejectReasons : suggestion.approveReasons) || []
      : []
    const decisionBody = `
      <div class="verdict-row">
        <strong class="approve">${overridden ? '人工改判：通过' : '人工确认：通过'}</strong>
        <span class="sub">${esc(formatTime(approval?.occurredAt))}</span>
      </div>
      ${
        suggestion
          ? `${
              overridden
                ? '<div class="placeholder">AI 原本建议驳回，人工选择通过。</div>'
                : `<p class="review-summary">${esc(suggestion.summary || '')}</p>`
            }
             ${
               reasons.length
                 ? `<div class="reason-block approve"><h4>${
                     overridden ? 'AI 原建议驳回的理由' : 'AI 建议通过的理由'
                   }</h4><ul>${reasons
                     .map((item) => `<li>${esc(item)}</li>`)
                     .join('')}</ul></div>`
                 : ''
             }`
          : '<div class="placeholder">人工审核通过（未使用 AI 建议）。</div>'
      }`
    return stepCard(2, stationTitle, stationTag + '<span class="tag human">人工确认</span>', decisionBody, 'done')
  }

  if (autoReviewing.has(produce.id)) {
    return stepCard(
      2,
      stationTitle,
      stationTag,
      '<div class="placeholder">AI 正在读取货物信息、生成审核建议…</div>',
      'current'
    )
  }

  if (!suggestion) {
    const body = `
      <div class="placeholder">还没有 AI 审核建议。可以重试生成，也可以直接人工审核。</div>
      <div class="review-actions">
        <button class="secondary" data-action="retry-review" data-id="${esc(produce.id)}">生成 AI 建议</button>
        <button data-action="goods-approve" data-id="${esc(produce.id)}">通过，自动入库上架</button>
        <button class="danger" data-action="goods-reject" data-id="${esc(produce.id)}">驳回</button>
      </div>
      <div class="review-note">人工确认后，系统自动生成入库单、上架批次和溯源数据。</div>
    `
    return stepCard(
      2,
      stationTitle,
      stationTag + '<span class="tag human">待拍板</span>',
      body,
      'current'
    )
  }

  const actions = `
    <button data-action="goods-approve" data-id="${esc(produce.id)}">通过，自动入库上架</button>
    <button class="danger" data-action="goods-reject" data-id="${esc(produce.id)}">驳回</button>
    <button class="secondary" data-action="retry-review" data-id="${esc(produce.id)}">重新生成</button>
  `
  const body = suggestionBody(suggestion, {
    actions,
    note: '人工确认后，系统自动生成入库单、上架批次和溯源数据。',
  })
  return stepCard(2, stationTitle, stationTag, body, 'current')
}

function renderInboundCard(journey) {
  const { produce, approval, suggestion } = journey
  const stateClass = stepState(journey, 'inbound')
  if (produce.status === 'rejected') {
    return stepCard(
      3,
      '入库站 · 入库单',
      '<span class="tag auto">系统自动</span>',
      '<div class="placeholder">流程已终止，不生成入库单。</div>',
      'future'
    )
  }
  if (produce.status !== 'active' && !journey.batch) {
    return stepCard(
      3,
      '入库站 · 入库单',
      '<span class="tag auto">系统自动</span>',
      '<div class="placeholder">审核通过后，系统自动生成入库单。</div>',
      'future'
    )
  }
  const body = artifactGrid([
    ['入库单号', inboundCode(produce)],
    ['仓库', '兴隆沟村保鲜库'],
    ['入库重量', `${produce.quantityKg} 公斤`],
    ['入库时间', formatTime(approval?.occurredAt || produce.submittedAt)],
    ['操作人', approval?.actorUid || 'keeper-001'],
    ['质检提示', suggestion?.summary || '外观正常，建议入库前抽检'],
  ])
  return stepCard(3, '入库站 · 入库单', '<span class="tag auto">系统自动</span>', body, stateClass)
}

function renderListingCard(journey) {
  const { produce, batch } = journey
  if (produce.status === 'rejected') {
    return stepCard(
      4,
      '上架站 · 上架批次',
      '<span class="tag auto">系统自动</span>',
      '<div class="placeholder">流程已终止，不生成上架批次。</div>',
      'future'
    )
  }
  if (!batch) {
    const canRetry = produce.status === 'active'
    const body = `
      <div class="placeholder">${canRetry ? '系统正在生成上架批次…' : '审核通过后，系统自动生成上架批次。'}</div>
      ${
        canRetry
          ? `<div class="review-actions"><button class="secondary" data-action="goods-list-batch" data-id="${esc(produce.id)}">重试生成上架批次</button></div>`
          : ''
      }
    `
    return stepCard(
      4,
      '上架站 · 上架批次',
      '<span class="tag auto">系统自动</span>',
      body,
      canRetry ? 'current' : 'future'
    )
  }
  const body = artifactGrid([
    ['批次号', batchCode(batch)],
    ['产品名', batch.productName],
    ['上架库位', shelfFor(batch)],
    ['建议售价', `¥${journey.price}/公斤`],
    ['溯源码', traceCode(batch)],
    ['上架时间', formatTime(batch.createdAt)],
  ])
  return stepCard(4, '上架站 · 上架批次', '<span class="tag auto">系统自动</span>', body, 'done')
}

function renderOrderCard(journey) {
  const { produce, batch, booking } = journey
  if (!batch) {
    return stepCard(
      5,
      '交易港 · 溯源与订单',
      '<span class="tag order">消费者</span>',
      '<div class="placeholder">上架后可查看公开溯源信息并下单。</div>',
      'future'
    )
  }
  const trace = artifactGrid([
    ['批次', batchCode(batch)],
    ['产品', batch.productName],
    ['村组', produce.groupName],
    ['品种', produce.vegetableName],
    ['数量', `${produce.quantityKg} 公斤`],
    ['采收', produce.harvestDate],
    ['溯源码', traceCode(batch)],
    ['批次状态', statusLabel(batch.status)],
  ])
  if (!booking) {
    const body = `${trace}
      <div class="review-actions">
        <button data-action="goods-order" data-id="${esc(batch.id)}">模拟消费者下单</button>
      </div>
      <div class="review-note">消费者下单后，系统自动生成订单并触发 AI 派单。</div>`
    return stepCard(5, '交易港 · 溯源与订单', '<span class="tag order">消费者</span>', body, 'current')
  }
  const amount = (Number(produce.quantityKg) * journey.price).toFixed(2)
  const order = artifactGrid([
    ['订单号', orderCode(booking)],
    ['买家', booking.consumerUid],
    ['数量', `${produce.quantityKg} 公斤`],
    ['金额', `¥${amount}`],
    ['下单时间', formatTime(booking.createdAt)],
    ['履约人', booking.assignedTo || '待派单'],
  ])
  const body = `${trace}<h3>订单数据</h3>${order}`
  return stepCard(5, '交易港 · 溯源与订单', '<span class="tag order">消费者</span>', body, 'done')
}

function renderAuditCard(journey) {
  const { booking, assignment, relatedAudit, relatedAlerts } = journey
  const openAlerts = relatedAlerts.filter(
    (alert) => alert.status === 'open' && alertIsRelevant(alert)
  )
  const alerts = openAlerts.length
    ? `<h3>待处理告警</h3>${openAlerts
        .map((alert) => {
          const view = alertView(alert)
          const timing = [
            view.ageMinutes != null
              ? `已持续 ${formatDuration(view.ageMinutes)}`
              : '',
            view.thresholdMinutes != null
              ? `观察期 ${formatDuration(view.thresholdMinutes)}`
              : '',
          ]
            .filter(Boolean)
            .join(' · ')
          return `<div class="item ${alert.severity === 'critical' ? 'bad' : 'warn'}">
            <div class="alert-top">
              <div class="title">${esc(view.detail)}</div>
              <span class="alert-severity">${esc(view.severityLabel)}</span>
            </div>
            <div class="meta">${esc(view.label)}${timing ? ' · ' + esc(timing) : ''}</div>
          </div>`
        })
        .join('')}`
    : ''
  if (!booking) {
    const body = relatedAudit.length
      ? `<div class="placeholder">订单生成后记录履约；以下是该货物目前的审计留痕。</div>${auditRows(
          relatedAudit
        )}${alerts}`
      : `<div class="placeholder">订单生成后记录履约与审计。</div>${alerts}`
    return stepCard(
      6,
      '履约站 / 审计灯塔',
      '<span class="tag audit">审计留痕</span>',
      body,
      relatedAudit.length ? 'current' : 'future'
    )
  }
  const dispatch = assignment
    ? artifactGrid([
        ['履约人', booking.assignedTo],
        ['派单时间', formatTime(assignment.occurredAt)],
        ['派单方式', 'AI 建议 + 自动确认'],
        ['订单状态', statusLabel(booking.status)],
      ])
    : `<div class="placeholder">订单已生成，等待 AI 派单。</div>
       <div class="review-actions"><button class="secondary" data-action="goods-auto-dispatch" data-id="${esc(
         booking.id
       )}">重试自动派单</button></div>`
  const body = `${dispatch}<h3>审计留痕</h3>${auditRows(relatedAudit)}${alerts}`
  return stepCard(
    6,
    '履约站 / 审计灯塔',
    '<span class="tag audit">审计留痕</span>',
    body,
    booking.assignedTo ? 'done' : 'current'
  )
}

function renderDetail() {
  const produce = state.produces.find((item) => item.id === selectedGoodsId)
  if (!produce) {
    $('goods-detail').innerHTML = `<div class="detail-empty">
      <div>${state.produces.length ? '当前筛选下没有货物' : '还没有货物'}</div>
      <div class="sub">${state.produces.length ? '切换上方筛选，或新增一件货物。' : '提交一件蔬菜，系统会自动生成货物档案、审核建议和后续单据。'}</div>
      <button data-action="open-submit">提交货物</button>
    </div>`
    return
  }
  const journey = journeyOf(produce)
  const meta = stageMeta(journey)
  const position = cargoPosition(journey)
  const flags = anomalyFlags(journey)
  const currentStation = STATIONS[position.currentId]
  const nextStation = position.nextId ? STATIONS[position.nextId] : null
  const documents = [
    '货物档案',
    ...(journey.suggestion ? ['AI审核建议'] : []),
    ...(produce.status === 'active' || journey.batch ? ['入库单'] : []),
    ...(journey.batch ? ['上架批次', '溯源码'] : []),
    ...(journey.booking ? ['订单'] : []),
    '审计留痕',
  ]
  const cargoStrip = `<div class="cargo-strip">
    <div><span>货物船</span><b>${esc(goodsCode(produce))}</b></div>
    <div><span>当前位置</span><b>${esc(currentStation.name)} · ${esc(currentStation.location)}</b></div>
    <div><span>目的地</span><b>${esc(nextStation ? nextStation.name : '旅程终点')}</b></div>
    <div><span>状态</span><b>${esc(position.stateText)}</b></div>
    <div class="cargo-docs"><span>已携带</span>${documents
      .map((item) => `<span class="doc-chip">${esc(item)}</span>`)
      .join('')}</div>
    ${
      flags.length
        ? `<div class="cargo-flags"><span>自检异常</span><b>${esc(
            flags.join('；')
          )}</b></div>`
        : ''
    }
  </div>`

  $('goods-detail').innerHTML = `
    <div class="detail-head">
      <div>
        <div class="kicker">货物码 ${esc(goodsCode(produce))}</div>
        <h2>${esc(produce.vegetableName)} · ${esc(produce.quantityKg)} 公斤</h2>
        <div class="sub">${esc(produce.groupName)} · 采收 ${esc(produce.harvestDate)} · 当前：${esc(meta.label)}</div>
      </div>
      <span class="stage-badge ${meta.cls}">${esc(meta.label)}</span>
    </div>
    ${cargoStrip}
    <div class="next-callout">
      <span>下一步</span>
      <strong>${esc(nextAction(journey))}</strong>
    </div>
    ${renderWorldMap(journey)}
    ${renderAutonomyLog(journey)}
    <div class="timeline">
      ${renderSubmitCard(journey)}
      ${renderReviewCard(journey)}
      ${renderInboundCard(journey)}
      ${renderListingCard(journey)}
      ${renderOrderCard(journey)}
      ${renderAuditCard(journey)}
    </div>
  `
}

function renderAuditor() {
  const open = state.alerts.filter(
    (item) => item.status === 'open' && alertIsRelevant(item)
  )
  if (!open.length) {
    $('auditor-alerts').innerHTML =
      '<div class="item"><div class="meta">没有待处置告警。可把扫描时间切到 24 小时后，验证观察期规则。</div></div>'
    return
  }
  $('auditor-alerts').innerHTML = open
    .map((alert) => {
      const view = alertView(alert)
      const timing = [
        view.ageMinutes != null
          ? `已持续 ${formatDuration(view.ageMinutes)}`
          : '',
        view.thresholdMinutes != null
          ? `观察期 ${formatDuration(view.thresholdMinutes)}`
          : '',
      ]
        .filter(Boolean)
        .join(' · ')
      return `<div class="item ${alert.severity === 'critical' ? 'bad' : 'warn'}">
        <div class="alert-top">
          <div class="title">${esc(view.detail)}</div>
          <span class="alert-severity">${esc(view.severityLabel)}</span>
        </div>
        <div class="meta">${esc(view.label)} · ${esc(view.timeLabel)} ${esc(view.time)}${timing ? ' · ' + esc(timing) : ''}</div>
        <div class="meta">建议：${esc(view.hint)}</div>
        <div class="actions">
          ${
            view.produce
              ? `<button class="secondary small" data-goods="${esc(
                  view.produce.id
                )}">查看这件货物</button>`
              : ''
          }
          <button class="small" data-action="ack" data-id="${esc(alert.id)}">确认并关闭</button>
        </div>
      </div>`
    })
    .join('')
}

function renderRules() {
  const pack = state.alertRules
  const summary = $('alert-rule-summary')
  const list = $('alert-rule-list')
  if (!pack || !Array.isArray(pack.rules) || !pack.rules.length) {
    summary.textContent = '预警规则（未加载）'
    list.innerHTML = ''
    return
  }
  summary.textContent = `预警规则 v${pack.version} · ${pack.rules.length} 条`
  list.innerHTML = pack.rules
    .map(
      (rule) => `<div class="rule-item">
        <div class="rule-title">${esc(rule.title)} <span class="tag auto">v${esc(
          rule.version
        )}</span></div>
        <div class="meta">${esc(rule.description)}</div>
        <div class="meta">责任角色：${esc(roleLabel(rule.ownerRole))} · 建议：${esc(
          rule.suggestedAction
        )}</div>
      </div>`
    )
    .join('')
}

function renderAdmin() {
  const stats = state.stats || {}
  const alerts = openAlertCount()
  $('admin-stats').innerHTML = `
    <div class="stat"><b>${esc(stats.produces ?? 0)}</b><span>货物</span></div>
    <div class="stat"><b>${esc(stats.batches ?? 0)}</b><span>上架批次</span></div>
    <div class="stat"><b>${esc(stats.bookings ?? 0)}</b><span>订单</span></div>
    <div class="stat"><b>${esc(alerts)}</b><span>待处置告警</span></div>
  `
  const queue = state.queue
  const storage = state.storage
  $('admin-infra').innerHTML =
    queue && storage
      ? `存储 <b>${esc(storage.mode)}</b> · 队列 <b>${esc(queue.done ?? 0)}</b> done / ` +
        `<b>${esc(queue.pending ?? 0)}</b> pending / <b>${esc(queue.failed ?? 0)}</b> failed`
      : '本地模式 · JSON 持久化 + 进程内事件推送'
  $('admin-queue').innerHTML =
    queue && queue.recent && queue.recent.length
      ? queue.recent
          .slice(0, 5)
          .map(
            (event) => `<div class="item compact">
              <div class="meta">${esc(event.topic)} · ${esc(event.status)} · 第 ${esc(event.attempts)} 次</div>
            </div>`
          )
          .join('')
      : '<div class="item compact"><div class="meta">暂无队列事件</div></div>'
}

function renderFeed() {
  $('event-feed').innerHTML = state.audit
    .slice(-40)
    .reverse()
    .map((event) => {
      const payload = event.payload || {}
      const agent = payload.agentId
        ? `<span class="ai">AI:${esc(payload.agentId)}</span> `
        : ''
      const detail =
        event.type === 'review.suggested'
          ? (() => {
              const approve = payload.recommendation === 'approve'
              const primary = approve
                ? (payload.approveReasons || []).length
                : (payload.rejectReasons || []).length
              const opposite = approve
                ? (payload.rejectReasons || []).length
                : (payload.approveReasons || []).length
              return `建议 ${approve ? '通过' : '驳回'} · 置信度 ${esc(
                payload.confidence ?? '-'
              )} · 建议理由 ${esc(primary)} 条 · 反方参考 ${esc(opposite)} 条`
            })()
          : esc(auditText(event))
      return `<li>
        <span class="type" title="${esc(event.type)}">${esc(eventLabel(event.type))}</span>
        <span class="actor">${esc(event.actorUid)}</span>
        <span class="payload">${agent}${detail}</span>
      </li>`
    })
    .join('')
}

function renderAiStatus() {
  const badge = $('ai-status')
  if (state.ai?.deepseekConfigured) {
    badge.textContent = `DeepSeek 已配置 · ${state.ai.model}`
    badge.className = 'badge ok'
  } else {
    badge.textContent = 'DeepSeek 未配置 · 规则兜底'
    badge.className = 'badge fallback'
  }
}

function renderSubmitForm() {
  $('produce-form').hidden = !submitFormOpen
  $('toggle-submit').textContent = submitFormOpen ? '收起' : '新增货物'
}

function render() {
  ensureSelection()
  renderSummary()
  renderGoodsList()
  renderDetail()
  renderSubmitForm()
  renderAuditor()
  renderRules()
  renderAdmin()
  renderFeed()
  renderAiStatus()
}

function maybeAutoReview() {
  if (busy) return
  const produce = state.produces.find((item) => item.id === selectedGoodsId)
  if (!produce || produce.status !== 'submitted') return
  if (goodSuggestions[produce.id] || findAuditSuggestion(produce.id)) return
  if (autoReviewAttempted.has(produce.id) || autoReviewing.has(produce.id)) return
  ensureSuggestion(false)
}

async function ensureSuggestion(force = false) {
  const produce = state.produces.find((item) => item.id === selectedGoodsId)
  if (!produce || produce.status !== 'submitted') return
  if (
    !force &&
    (goodSuggestions[produce.id] || findAuditSuggestion(produce.id))
  ) {
    return
  }
  if (autoReviewing.has(produce.id)) return
  autoReviewing.add(produce.id)
  autoReviewAttempted.add(produce.id)
  renderDetail()
  try {
    const suggestion = await api('/api/keeper/review-ai', {
      produceId: produce.id,
    })
    goodSuggestions[produce.id] = suggestion
    await refresh()
  } catch (error) {
    toast(`AI 审核建议生成失败：${error.message}`, true)
  } finally {
    autoReviewing.delete(produce.id)
    renderDetail()
  }
}

function selectGoods(id) {
  if (!state.produces.some((item) => item.id === id)) return
  selectedGoodsId = id
  render()
  maybeAutoReview()
}

function setFilter(key) {
  goodsFilter = key
  ensureSelection()
  render()
  maybeAutoReview()
}

async function refresh() {
  const response = await fetch(apiUrl('/api/state'))
  const payload = await response.json()
  if (!response.ok || payload.ok === false) {
    const error = payload.error || {}
    throw new Error(error.message || error.code || `HTTP ${response.status}`)
  }
  state = payload
  if (!formInitialized) {
    formInitialized = true
    submitFormOpen = state.produces.length === 0
  }
  render()
  maybeAutoReview()
}

async function approveGoods(produceId) {
  if (busy) return
  busy = true
  try {
    await api('/api/keeper/review', {
      produceId,
      decision: 'approve',
    })
    await api('/api/keeper/batch', { produceId })
    await refresh()
    toast('审核通过：已自动生成入库单与上架批次')
  } catch (error) {
    toast(error.message, true)
  } finally {
    busy = false
    render()
  }
}

async function rejectGoods(produceId) {
  if (busy) return
  busy = true
  try {
    await api('/api/keeper/review', {
      produceId,
      decision: 'reject',
    })
    await refresh()
    toast('已驳回，该货物流程终止')
  } catch (error) {
    toast(error.message, true)
  } finally {
    busy = false
    render()
  }
}

async function listBatch(produceId) {
  if (busy) return
  busy = true
  try {
    await api('/api/keeper/batch', { produceId })
    await refresh()
    toast('上架批次已生成')
  } catch (error) {
    toast(error.message, true)
  } finally {
    busy = false
    render()
  }
}

async function orderGoods(batchId) {
  if (busy) return
  busy = true
  try {
    const booking = await api('/api/consumer/buy', { batchId })
    let assignee = null
    try {
      const suggestion = await api('/api/keeper/dispatch-ai', {
        bookingId: booking.id,
      })
      if (suggestion.assigneeUid) {
        await api('/api/keeper/assign', {
          bookingId: booking.id,
          assigneeUid: suggestion.assigneeUid,
        })
        assignee = suggestion.assigneeUid
      }
    } catch (error) {
      toast(`订单已生成，但自动派单失败：${error.message}`, true)
    }
    await refresh()
    toast(
      assignee
        ? `订单已生成，AI 已自动派单给 ${assignee}`
        : '订单已生成，等待人工派单'
    )
  } catch (error) {
    toast(error.message, true)
  } finally {
    busy = false
    render()
  }
}

async function autoDispatch(bookingId) {
  if (busy) return
  busy = true
  try {
    const suggestion = await api('/api/keeper/dispatch-ai', { bookingId })
    if (suggestion.assigneeUid) {
      await api('/api/keeper/assign', {
        bookingId,
        assigneeUid: suggestion.assigneeUid,
      })
      toast(`已自动派单给 ${suggestion.assigneeUid}`)
    } else {
      toast('本村暂无可用入库员', true)
    }
    await refresh()
  } catch (error) {
    toast(error.message, true)
  } finally {
    busy = false
    render()
  }
}

document.addEventListener('click', async (event) => {
  const goodsButton = event.target.closest('button[data-goods]')
  if (goodsButton) {
    selectGoods(goodsButton.dataset.goods)
    document
      .querySelector('.goods-detail')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }
  const filterButton = event.target.closest('button[data-filter]')
  if (filterButton) {
    setFilter(filterButton.dataset.filter)
    return
  }
  const actionButton = event.target.closest('button[data-action]')
  if (!actionButton) return
  const action = actionButton.dataset.action
  const id = actionButton.dataset.id

  if (action === 'open-submit') {
    submitFormOpen = true
    renderSubmitForm()
    document
      .querySelector('#produce-form input[name="vegetableName"]')
      ?.focus()
    return
  }
  if (action === 'goods-approve') {
    await approveGoods(id)
    return
  }
  if (action === 'goods-reject') {
    await rejectGoods(id)
    return
  }
  if (action === 'goods-list-batch') {
    await listBatch(id)
    return
  }
  if (action === 'goods-order') {
    await orderGoods(id)
    return
  }
  if (action === 'goods-auto-dispatch') {
    await autoDispatch(id)
    return
  }
  if (action === 'retry-review') {
    autoReviewAttempted.delete(id)
    await ensureSuggestion(true)
    return
  }
  if (action === 'ack') {
    try {
      await api('/api/auditor/ack', { alertId: id })
      await refresh()
      toast('告警已确认')
    } catch (error) {
      toast(error.message, true)
    }
  }
})

$('toggle-submit').addEventListener('click', () => {
  submitFormOpen = !submitFormOpen
  renderSubmitForm()
  if (submitFormOpen) {
    document
      .querySelector('#produce-form input[name="vegetableName"]')
      ?.focus()
  }
})

$('produce-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = new FormData(event.currentTarget)
  try {
    const produce = await api('/api/farmer/submit', {
      groupName: form.get('groupName'),
      vegetableName: form.get('vegetableName'),
      quantityKg: Number(form.get('quantityKg')),
      harvestDate: form.get('harvestDate'),
    })
    selectedGoodsId = produce.id
    goodsFilter = 'all'
    submitFormOpen = false
    await refresh()
    toast('货物已提交，AI 正在生成审核建议')
  } catch (error) {
    toast(error.message, true)
  }
})

$('scan-alerts').addEventListener('click', async () => {
  try {
    const offset = Number($('scan-offset').value) || 0
    const asOf = offset
      ? new Date(Date.now() + offset * 60000).toISOString()
      : undefined
    const result = await api('/api/admin/scan', asOf ? { asOf } : {})
    await refresh()
    toast(
      `按${offset ? '模拟时间 ' + formatTime(asOf) : '当前时间'}扫描：新增 ${
        result.created.length
      } 条，更新 ${result.updated?.length ?? 0} 条，解除 ${
        result.resolved?.length ?? 0
      } 条；当前待处置 ${openAlertCount()} 条`
    )
  } catch (error) {
    toast(error.message, true)
  }
})

$('drain-queue').addEventListener('click', async () => {
  try {
    const result = await api('/api/worker/drain', {})
    await refresh()
    toast(`事件队列消费完成：本次 ${result.drained ?? 0} 条`)
  } catch (error) {
    toast(error.message, true)
  }
})

$('reset').addEventListener('click', async () => {
  try {
    await api('/api/reset', {})
    selectedGoodsId = null
    goodsFilter = 'all'
    goodSuggestions = {}
    autoReviewAttempted.clear()
    autoReviewing.clear()
    submitFormOpen = true
    formInitialized = true
    await refresh()
    toast('演示数据已重置')
  } catch (error) {
    toast(error.message, true)
  }
})

let pollTimer = null
let refreshing = false

if (useSse && typeof EventSource !== 'undefined') {
  $('feed-mode').textContent =
    'SSE 推送 · 业务动作、AI 建议、审计留痕都会出现在这里'
  const events = new EventSource(apiUrl('/events'))
  events.addEventListener('state', (event) => {
    state = JSON.parse(event.data)
    render()
    maybeAutoReview()
  })
  events.onerror = () => {
    events.close()
    startPolling()
    toast('实时连接中断，已切换为轮询', true)
  }
} else {
  startPolling()
}

function startPolling() {
  if (pollTimer) return
  $('feed-mode').textContent =
    '云端轮询（1.5 秒）· 业务动作、AI 建议、审计留痕都会出现在这里'
  pollTimer = setInterval(async () => {
    if (refreshing) return
    refreshing = true
    try {
      await refresh()
    } catch {
      /* 下一轮重试 */
    } finally {
      refreshing = false
    }
  }, 1500)
}

refresh().catch((error) => toast(error.message, true))
