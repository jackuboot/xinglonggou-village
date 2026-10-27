/**
 * DeepSeek 审核建议（OpenAI 兼容接口）。
 * 未配置密钥、超时、HTTP 错误或输出不合法时明确回退规则，不伪装成模型结果。
 * 输出同时包含“支持通过”和“支持驳回”的理由，最终由入库员拍板。
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

function todayText() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
  }).format(new Date())
}

function fallback(produce, note) {
  const today = todayText()
  const oversized = Number(produce.quantityKg) > 500
  const future = String(produce.harvestDate) > today
  const reject = oversized || future

  const approveReasons = [
    '村组、蔬菜名称、数量、采收日期字段齐全',
    ...(oversized ? [] : ['申报数量不超过 500 公斤']),
    ...(future
      ? []
      : [`采收日期 ${produce.harvestDate} 不晚于今天 ${today}`]),
  ]
  const rejectReasons = [
    ...(oversized ? ['申报数量超过 500 公斤，请核对采收记录'] : []),
    ...(future ? [`采收日期 ${produce.harvestDate} 晚于今天 ${today}`] : []),
    ...(!oversized && !future ? ['未提供检测结果，建议入库前抽检'] : []),
    note,
  ]

  return {
    produceId: produce.id,
    recommendation: reject ? 'reject' : 'approve',
    confidence: reject ? 0.82 : 0.9,
    summary: reject
      ? '存在需要人工核对的风险点，建议驳回后再核实'
      : '关键字段与数量/日期正常，可进入人工复核',
    approveReasons,
    rejectReasons,
    source: 'fallback',
    model: 'rule-based',
    requiresHumanDecision: true,
  }
}

async function reviewProduce(produce) {
  if (!configured()) {
    return fallback(produce, 'DeepSeek 未配置，使用规则兜底')
  }

  const today = todayText()
  const prompt = [
    '你是乡村入库审核助手。根据蔬菜申报信息给出审核建议。',
    '只输出 JSON，格式：{"recommendation":"approve"|"reject","confidence":0-1,"summary":"一句话结论","approveReasons":["支持通过的理由"],"rejectReasons":["支持驳回的理由或风险"]}。',
    '要求：无论最终结论是通过还是驳回，都必须分别给出 approveReasons 与 rejectReasons；某一侧没有理由时输出空数组，不要只给结论。',
    '最终只推荐一个结论：推荐通过时，approveReasons 是主要依据，rejectReasons 只作为反方参考；推荐驳回时反之。不得输出模棱两可的结论。',
    '理由必须基于申报信息，不得编造检测结果。',
    '关注：数量是否异常（超过 500 公斤需核对）、采收日期是否晚于今天、信息是否明显缺失。',
    '日期判断规则：只与下面给出的“今天”比较；采收日期等于或早于今天均为正常，晚于今天才视为未来日期；不要用训练数据推断当前日期。',
    '判定规则（必须遵守）：',
    '1) 数量 > 500 公斤 → reject，并提示人工核对；',
    '2) 采收日期晚于今天 → reject；',
    '3) 申报品类不是蔬菜（如茶叶、水果、粮食、畜禽） → reject，并说明品类不符；',
    '4) 其余情况可 approve；信息缺失只写入理由，不编造检测结论。',
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
      !Array.isArray(parsed.approveReasons) ||
      !Array.isArray(parsed.rejectReasons)
    ) {
      return fallback(produce, 'DeepSeek 输出格式不合法，使用规则兜底')
    }

    const approveReasons = parsed.approveReasons.map(String).slice(0, 6)
    const rejectReasons = parsed.rejectReasons.map(String).slice(0, 6)
    if (!approveReasons.length && !rejectReasons.length) {
      return fallback(produce, 'DeepSeek 未给出理由，使用规则兜底')
    }

    return {
      produceId: produce.id,
      recommendation: parsed.recommendation,
      confidence:
        typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.7,
      summary:
        typeof parsed.summary === 'string' && parsed.summary.trim()
          ? parsed.summary.trim()
          : parsed.recommendation === 'approve'
            ? '信息基本完整，可进入人工复核'
            : '存在风险点，建议人工核实',
      approveReasons,
      rejectReasons,
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
