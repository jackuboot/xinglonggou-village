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
const suggestions = {}

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
  toast.timer = setTimeout(() => el.classList.remove('show'), 2800)
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

function statusLabel(status) {
  const map = {
    submitted: '待审核',
    active: '已生效',
    rejected: '已驳回',
    available: '可购买',
    booked: '已购买',
    open: '待处置',
    acknowledged: '已确认',
  }
  return map[status] || status
}

function renderFarmer() {
  const own = state.produces
  $('farmer-produces').innerHTML = own.length
    ? own
        .map(
          (item) => `
      <div class="item">
        <div class="title">${esc(item.vegetableName)} · ${esc(item.quantityKg)} 公斤</div>
        <div class="meta">${esc(item.groupName)} · 采收 ${esc(item.harvestDate)} · ${esc(statusLabel(item.status))}</div>
      </div>`
        )
        .join('')
    : '<div class="item meta">还没有提交蔬菜</div>'
}

function renderKeeper() {
  const pending = state.produces.filter((item) => item.status === 'submitted')
  $('keeper-pending').innerHTML = pending.length
    ? pending
        .map(
          (item) => `
      <div class="item">
        <div class="title">${esc(item.vegetableName)} · ${esc(item.quantityKg)} 公斤</div>
        <div class="meta">${esc(item.groupName)} · 采收 ${esc(item.harvestDate)}</div>
        <div class="actions">
          <button class="secondary small" data-action="review-ai" data-id="${esc(item.id)}">AI 审核建议</button>
          <button class="small" data-action="review" data-decision="approve" data-id="${esc(item.id)}">通过</button>
          <button class="danger small" data-action="review" data-decision="reject" data-id="${esc(item.id)}">驳回</button>
        </div>
      </div>`
        )
        .join('')
    : '<div class="item meta">没有待审核蔬菜</div>'

  const active = state.produces.filter((item) => item.status === 'active')
  $('keeper-active').innerHTML = active.length
    ? active
        .map(
          (item) => `
      <div class="item">
        <div class="title">${esc(item.vegetableName)} · ${esc(item.quantityKg)} 公斤</div>
        <div class="meta">${esc(item.groupName)} · 已生效</div>
        <div class="actions">
          <button class="small" data-action="batch" data-id="${esc(item.id)}">创建可售批次</button>
        </div>
      </div>`
        )
        .join('')
    : '<div class="item meta">没有已生效蔬菜</div>'

  const bookings = state.bookings.filter((item) => !item.assignedTo)
  $('keeper-bookings').innerHTML = bookings.length
    ? bookings
        .map((item) => {
          const suggestion = suggestions[item.id]
          return `
      <div class="item">
        <div class="title">购买 ${esc(item.id)}</div>
        <div class="meta">批次 ${esc(item.batchId)} · ${esc(statusLabel(item.status))}</div>
        ${
          suggestion
            ? `<div class="meta">AI 建议：${esc(suggestion.assigneeUid || '无可用入库员')}（置信度 ${esc(suggestion.confidence)}）</div>`
            : ''
        }
        <div class="actions">
          <button class="secondary small" data-action="dispatch-ai" data-id="${esc(item.id)}">AI 派单建议</button>
          ${
            suggestion && suggestion.assigneeUid
              ? `<button class="small" data-action="assign" data-id="${esc(item.id)}">确认派给 ${esc(suggestion.assigneeUid)}</button>`
              : ''
          }
        </div>
      </div>`
        })
        .join('')
    : '<div class="item meta">没有待派单购买</div>'
}

function renderConsumer() {
  const available = state.batches.filter((item) => item.status === 'available')
  $('consumer-batches').innerHTML = available.length
    ? available
        .map(
          (item) => `
      <div class="item">
        <div class="title">${esc(item.productName)}</div>
        <div class="meta">批次 ${esc(item.id)} · ${esc(statusLabel(item.status))}</div>
        <div class="actions">
          <button class="secondary small" data-action="trace" data-id="${esc(item.id)}">溯源</button>
          <button class="small" data-action="buy" data-id="${esc(item.id)}">购买</button>
        </div>
      </div>`
        )
        .join('')
    : '<div class="item meta">暂无可购买批次</div>'
}

function renderAuditor() {
  const open = state.alerts.filter((item) => item.status === 'open')
  $('auditor-alerts').innerHTML = open.length
    ? open
        .map(
          (item) => `
      <div class="item ${item.severity === 'critical' ? 'bad' : 'warn'}">
        <div class="title">${esc(item.message)}</div>
        <div class="meta">${esc(item.type)} · 目标 ${esc(item.targetId)} · ${esc(item.severity)}</div>
        <div class="actions">
          <button class="small" data-action="ack" data-id="${esc(item.id)}">确认告警</button>
        </div>
      </div>`
        )
        .join('')
    : '<div class="item meta">没有待处置告警</div>'
}

function renderAdmin() {
  const stats = state.stats || {}
  $('admin-stats').innerHTML = `
    <div class="stat"><b>${esc(stats.produces ?? 0)}</b><span>蔬菜批次</span></div>
    <div class="stat"><b>${esc(stats.batches ?? 0)}</b><span>可售批次</span></div>
    <div class="stat"><b>${esc(stats.bookings ?? 0)}</b><span>购买</span></div>
    <div class="stat"><b>${esc(stats.alerts ?? 0)}</b><span>告警</span></div>
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
            (event) => `
        <div class="item compact">
          <div class="meta">${esc(event.topic)} · ${esc(event.status)} · 第 ${esc(event.attempts)} 次</div>
        </div>`
          )
          .join('')
      : '<div class="item compact"><div class="meta">暂无队列事件</div></div>'
  $('admin-audit').innerHTML = state.audit
    .slice(-6)
    .reverse()
    .map(
      (event) => `
      <div class="item compact">
        <div class="meta">${esc(event.type)} · ${esc(event.actorUid)}</div>
      </div>`
    )
    .join('')
}

function renderFeed() {
  $('event-feed').innerHTML = state.audit
    .slice(-40)
    .reverse()
    .map((event) => {
      const payload = event.payload || {}
      const agent = payload.agentId ? `<span class="ai">AI:${esc(payload.agentId)}</span> ` : ''
      return `<li>
        <span class="type">${esc(event.type)}</span>
        <span class="actor">${esc(event.actorUid)}</span>
        <span class="payload">${agent}${esc(JSON.stringify(payload))}</span>
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

function render() {
  renderAiStatus()
  renderFarmer()
  renderKeeper()
  renderConsumer()
  renderAuditor()
  renderAdmin()
  renderFeed()
}

async function refresh() {
  const response = await fetch(apiUrl('/api/state'))
  const payload = await response.json()
  if (!response.ok || payload.ok === false) {
    const error = payload.error || {}
    throw new Error(error.message || error.code || `HTTP ${response.status}`)
  }
  state = payload
  render()
}

let pollTimer = null
let refreshing = false

function startPolling() {
  if (pollTimer) return
  $('feed-mode').textContent =
    '云端轮询（1.5 秒）· 业务动作、AI 建议、越权拒绝都会出现在这里'
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

document.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]')
  if (!button) return
  const action = button.dataset.action
  const id = button.dataset.id
  try {
    if (action === 'review-ai') {
      const suggestion = await api('/api/keeper/review-ai', { produceId: id })
      toast(
        `建议 ${suggestion.recommendation} · 置信度 ${suggestion.confidence} · ${
          suggestion.source === 'deepseek' ? 'DeepSeek' : '规则兜底'
        }：${suggestion.reasons.join('；')}`
      )
    } else if (action === 'review') {
      await api('/api/keeper/review', {
        produceId: id,
        decision: button.dataset.decision,
      })
      toast('审核结果已保存')
    } else if (action === 'batch') {
      await api('/api/keeper/batch', { produceId: id })
      toast('已创建可售批次')
    } else if (action === 'trace') {
      const trace = await api('/api/consumer/trace', { batchId: id })
      $('trace-result').textContent = JSON.stringify(trace, null, 2)
      toast('已获取公开溯源信息')
    } else if (action === 'buy') {
      await api('/api/consumer/buy', { batchId: id })
      toast('购买成功，等待派单')
    } else if (action === 'dispatch-ai') {
      const suggestion = await api('/api/keeper/dispatch-ai', { bookingId: id })
      suggestions[id] = suggestion
      toast(
        suggestion.assigneeUid
          ? `建议派给 ${suggestion.assigneeUid}（置信度 ${suggestion.confidence}）`
          : suggestion.reason
      )
      renderKeeper()
    } else if (action === 'assign') {
      const suggestion = suggestions[id]
      if (!suggestion?.assigneeUid) {
        toast('没有可用入库员，无法派单', true)
        return
      }
      await api('/api/keeper/assign', {
        bookingId: id,
        assigneeUid: suggestion.assigneeUid,
      })
      delete suggestions[id]
      toast('派单已确认')
    } else if (action === 'ack') {
      await api('/api/auditor/ack', { alertId: id })
      toast('告警已确认')
    }
  } catch (error) {
    toast(error.message, true)
  } finally {
    refresh().catch(() => {})
  }
})

$('produce-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = new FormData(event.currentTarget)
  try {
    await api('/api/farmer/submit', {
      groupName: form.get('groupName'),
      vegetableName: form.get('vegetableName'),
      quantityKg: Number(form.get('quantityKg')),
      harvestDate: form.get('harvestDate'),
    })
    toast('蔬菜批次已提交')
  } catch (error) {
    toast(error.message, true)
  } finally {
    refresh().catch(() => {})
  }
})

$('scan-alerts').addEventListener('click', async () => {
  try {
    const result = await api('/api/admin/scan', {})
    toast(`预警扫描完成：新增 ${result.created.length} 条，待处置 ${result.open.length} 条`)
  } catch (error) {
    toast(error.message, true)
  } finally {
    refresh().catch(() => {})
  }
})

$('drain-queue').addEventListener('click', async () => {
  try {
    const result = await api('/api/worker/drain', {})
    toast(`事件队列消费完成：本次 ${result.drained ?? 0} 条`)
  } catch (error) {
    toast(error.message, true)
  } finally {
    refresh().catch(() => {})
  }
})

$('reset').addEventListener('click', async () => {
  try {
    await api('/api/reset', {})
    Object.keys(suggestions).forEach((key) => delete suggestions[key])
    $('trace-result').textContent = '点击“溯源”查看公开信息'
    toast('演示数据已重置')
  } catch (error) {
    toast(error.message, true)
  } finally {
    refresh().catch(() => {})
  }
})

if (useSse && typeof EventSource !== 'undefined') {
  $('feed-mode').textContent =
    'SSE 推送 · 业务动作、AI 建议、越权拒绝都会出现在这里'
  const events = new EventSource(apiUrl('/events'))
  events.addEventListener('state', (event) => {
    state = JSON.parse(event.data)
    render()
  })
  events.onerror = () => {
    events.close()
    startPolling()
    toast('实时连接中断，已切换为轮询', true)
  }
} else {
  startPolling()
}

refresh().catch((error) => toast(error.message, true))
