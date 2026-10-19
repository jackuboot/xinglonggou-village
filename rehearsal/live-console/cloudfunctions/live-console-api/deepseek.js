/**
 * DeepSeek 审核建议（OpenAI 兼容接口）。
 * 未配置密钥、超时、HTTP 错误或输出不合法时明确回退规则，不伪装成模型结果。
 * 配置在调用时读取，修改云函数环境变量后无需改代码。
 */
function apiKey() {
  return (process.env.DEEPSEEK_API_KEY || '').trim()
}

function baseUrl() {
  return (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(
    /\/$/,
    ''
  )
}

function model() {
  return process.env.DEEPSEEK_MODEL || 'deepseek-chat'
}

function configured() {
  return apiKey().length > 0
}

function fallback(produce, note) {
  const suspicious = Number(produce.quantityKg) > 500
  return {
    produceId: produce.id,
    recommendation: suspicious ? 'reject' : 'approve',
    confidence: suspicious ? 0.82 : 0.9,
    reasons: suspicious
      ? ['申报数量超过 500 公斤，请核对采收记录', note]
      : ['字段完整、数量在常见范围', note],
    source: 'fallback',
    model: 'rule-based',
    requiresHumanDecision: true,
  }
}

async function reviewProduce(produce) {
  if (!configured()) {
    return fallback(produce, 'DeepSeek 未配置，使用规则兜底')
  }

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
  }).format(new Date())
  const prompt = [
    '你是乡村入库审核助手。根据蔬菜申报信息给出审核建议。',
    '只输出 JSON，格式：{"recommendation":"approve"|"reject","confidence":0-1,"reasons":["..."]}。',
    '关注：数量是否异常（超过 500 公斤需核对）、采收日期是否晚于今天、信息是否明显缺失。',
    '日期判断规则：只与下面给出的“今天”比较；采收日期等于或早于今天均为正常，晚于今天才视为未来日期；不要用训练数据推断当前日期。',
    '判定规则（必须遵守）：',
    '1) 数量 > 500 公斤 → reject，并提示人工核对；',
    '2) 采收日期晚于今天 → reject；',
    '3) 申报品类不是蔬菜（如茶叶、水果、粮食、畜禽） → reject，并说明品类不符；',
    '4) 其余情况可 approve；信息缺失只写入理由，不编造检测结论。',
    '不得编造未提供的检测结果。',
    `今天（系统日期，最高优先级）：${today}`,
    '申报信息：' +
      JSON.stringify({
        vegetableName: produce.vegetableName,
        quantityKg: produce.quantityKg,
        harvestDate: produce.harvestDate,
        groupName: produce.groupName,
      }),
  ].join('\n')

  try {
    const response = await fetch(`${baseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({
        model: model(),
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: '你是严谨的农业入库审核助手。' },
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      return fallback(produce, `DeepSeek HTTP ${response.status}，使用规则兜底`)
    }

    const payload = await response.json()
    const content =
      payload && payload.choices && payload.choices[0] && payload.choices[0].message
        ? payload.choices[0].message.content
        : ''
    if (!content) return fallback(produce, 'DeepSeek 空响应，使用规则兜底')

    const parsed = JSON.parse(content)
    if (
      !parsed ||
      (parsed.recommendation !== 'approve' && parsed.recommendation !== 'reject') ||
      !Array.isArray(parsed.reasons)
    ) {
      return fallback(produce, 'DeepSeek 输出格式不合法，使用规则兜底')
    }

    return {
      produceId: produce.id,
      recommendation: parsed.recommendation,
      confidence:
        typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.7,
      reasons: parsed.reasons.slice(0, 4).map(String),
      source: 'deepseek',
      model: model(),
      requiresHumanDecision: true,
    }
  } catch (error) {
    return fallback(
      produce,
      `DeepSeek 调用失败（${(error && error.message) || error}），使用规则兜底`
    )
  }
}

module.exports = { configured, reviewProduce, model }
