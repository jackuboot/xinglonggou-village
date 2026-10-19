/**
 * CloudBase 云函数入口：同时支持
 * 1) HTTP 访问（--httpFn）：/api/state、/api/farmer/submit ...
 * 2) tcb fn invoke：{ "action": "state" | "farmer.submit" | ... }
 */
const { handle } = require('./domain')

const ACTIONS = {
  '/farmer/submit': 'farmer.submit',
  '/keeper/review': 'keeper.review',
  '/keeper/review-ai': 'keeper.review-ai',
  '/keeper/batch': 'keeper.batch',
  '/consumer/trace': 'consumer.trace',
  '/consumer/buy': 'consumer.buy',
  '/keeper/dispatch-ai': 'keeper.dispatch-ai',
  '/keeper/assign': 'keeper.assign',
  '/admin/scan': 'admin.scan',
  '/auditor/ack': 'auditor.ack',
  '/worker/drain': 'worker.drain',
  '/reset': 'reset',
}

const STATUS_BY_CODE = {
  AUTH_DENIED: 403,
  VILLAGE_DENIED: 403,
  INPUT_INVALID: 400,
  INVALID_STATUS: 400,
  PRODUCE_INVALID_STATUS: 400,
  PRODUCE_NOT_FOUND: 404,
  BATCH_NOT_FOUND: 404,
  ACTION_NOT_FOUND: 404,
  SERVER_ERROR: 500,
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
}

function httpResponse(statusCode, payload) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(payload),
    isBase64Encoded: false,
  }
}

function normalizePath(rawPath) {
  let path = String(rawPath || '/').split('?')[0]
  path = path.replace(/^\/api(?=\/|$)/, '')
  path = path.replace(/^\/live-console-api(?=\/|$)/, '')
  path = path.replace(/\/+$/, '')
  return path || '/'
}

function readBody(event) {
  if (!event.body) return {}
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw || '{}')
  } catch {
    return null
  }
}

function statusFor(result) {
  if (!result || result.ok) return 200
  return STATUS_BY_CODE[result.error && result.error.code] || 400
}

exports.main = async (event = {}, context = {}) => {
  const isHttp = Boolean(event.httpMethod || event.requestContext)
  const method = String(
    event.httpMethod ||
      (event.requestContext && event.requestContext.http
        ? event.requestContext.http.method
        : 'GET')
  ).toUpperCase()

  if (!isHttp) {
    const action = String(event.action || 'state')
    const result = await handle(action, event)
    if (action === 'state' && result && result.produces) return result
    return result
  }

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  }

  const body = readBody(event)
  if (body === null) {
    return httpResponse(400, {
      ok: false,
      error: { code: 'INPUT_INVALID', message: '请求体不是合法 JSON' },
    })
  }

  const path = normalizePath(
    event.path || event.rawPath || (event.requestContext && event.requestContext.path)
  )

  if (path === '/health') {
    return httpResponse(200, { ok: true, data: { service: 'live-console-api' } })
  }

  const action = method === 'GET' && path === '/state' ? 'state' : ACTIONS[path] || body.action
  if (!action) {
    return httpResponse(404, {
      ok: false,
      error: { code: 'ACTION_NOT_FOUND', message: `未知路径：${path}` },
    })
  }

  const result = await handle(action, body)
  if (action === 'state' && result && result.produces) {
    return httpResponse(200, result)
  }
  return httpResponse(statusFor(result), result)
}
