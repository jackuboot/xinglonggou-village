import type {
  Alert,
  AlertSeverity,
  AlertType,
  Batch,
  Booking,
  Produce,
  Role,
} from '../domain/types'

export interface AlertRule {
  readonly id: string
  readonly version: number
  readonly type: AlertType
  readonly domain: 'review' | 'listing' | 'dispatch' | 'quality' | 'compliance'
  readonly title: string
  readonly entity: 'produce' | 'batch' | 'booking'
  readonly warnAfterMinutes: number
  readonly criticalAfterMinutes: number
  readonly ownerRole: Role
  readonly suggestedAction: string
  readonly description: string
}

/**
 * 预警规则包：配置驱动，规则引擎只负责通用评估。
 * 新增业务域时优先新增规则和实体适配，不改扫描流程。
 */
export const ALERT_RULE_PACK: {
  readonly version: string
  readonly rules: readonly AlertRule[]
} = {
  version: '2026-10-19.1',
  rules: [
    {
      id: 'review.stale',
      version: 1,
      type: 'stale_produce',
      domain: 'review',
      title: '货物待审超时',
      entity: 'produce',
      warnAfterMinutes: 120,
      criticalAfterMinutes: 480,
      ownerRole: 'keeper',
      suggestedAction: '尽快完成审核，避免货物一直停在待审。',
      description: '提交后超过 2 小时未审核为需关注，超过 8 小时为高优先级。',
    },
    {
      id: 'listing.no_booking',
      version: 1,
      type: 'unsold_batch',
      domain: 'listing',
      title: '批次上架后长期无订单',
      entity: 'batch',
      warnAfterMinutes: 1440,
      criticalAfterMinutes: 4320,
      ownerRole: 'keeper',
      suggestedAction: '确认是否调整上架信息或下架，避免批次长期无订单。',
      description: '上架后 24 小时无订单为需关注，72 小时为高优先级。',
    },
    {
      id: 'dispatch.unassigned',
      version: 1,
      type: 'unassigned_booking',
      domain: 'dispatch',
      title: '订单生成后未派单',
      entity: 'booking',
      warnAfterMinutes: 60,
      criticalAfterMinutes: 240,
      ownerRole: 'keeper',
      suggestedAction: '尽快确认履约人，避免订单一直无人处理。',
      description: '下单后 1 小时未派单为需关注，4 小时为高优先级。',
    },
  ],
}

export function formatDuration(minutes: number): string {
  const value = Math.max(0, Math.round(minutes))
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

function parseTime(value: string): number {
  const time = Date.parse(value)
  return Number.isNaN(time) ? Date.now() : time
}

interface EntitySnapshot {
  readonly id: string
  readonly timestamp: string
  readonly label: string
}

function entitiesFor(
  rule: AlertRule,
  input: AlertEngineInput
): EntitySnapshot[] {
  if (rule.entity === 'produce') {
    return input.produces
      .filter((item) => item.status === 'submitted')
      .map((item) => ({
        id: item.id,
        timestamp: item.submittedAt,
        label: `${item.vegetableName} ${item.quantityKg} 公斤`,
      }))
  }
  if (rule.entity === 'batch') {
    return input.batches
      .filter(
        (batch) => !input.bookings.some((booking) => booking.batchId === batch.id)
      )
      .map((batch) => {
        const produce = input.produces.find((item) => item.id === batch.produceId)
        return {
          id: batch.id,
          timestamp: batch.createdAt,
          label: produce ? `${produce.vegetableName} 批次` : '批次',
        }
      })
  }
  return input.bookings
    .filter((booking) => !booking.assignedTo)
    .map((booking) => ({
      id: booking.id,
      timestamp: booking.createdAt,
      label: '订单',
    }))
}

export interface AlertEngineInput {
  readonly produces: readonly Produce[]
  readonly batches: readonly Batch[]
  readonly bookings: readonly Booking[]
  readonly alerts: readonly Alert[]
  readonly asOf: string
  readonly nowIso: string
  readonly nextId: (prefix?: string) => string
}

export interface AlertEscalation {
  readonly alert: Alert
  readonly from: AlertSeverity
  readonly to: AlertSeverity
}

export interface AlertEngineResult {
  readonly created: readonly Alert[]
  readonly updated: readonly Alert[]
  readonly escalated: readonly AlertEscalation[]
  readonly resolved: readonly Alert[]
  readonly open: readonly Alert[]
  readonly evaluated: number
}

/**
 * 通用规则评估器：输入业务实体、已有告警和评估时间，
 * 输出创建 / 更新 / 升级 / 自动解除，不直接写存储。
 */
export function evaluateAlerts(input: AlertEngineInput): AlertEngineResult {
  const asOfMs = parseTime(input.asOf)
  const byKey = new Map(input.alerts.map((alert) => [alert.dedupeKey, alert]))
  const matched = new Set<string>()
  const created: Alert[] = []
  const updated: Alert[] = []
  const escalated: AlertEscalation[] = []
  const resolved: Alert[] = []
  let evaluated = 0

  for (const rule of ALERT_RULE_PACK.rules) {
    for (const entity of entitiesFor(rule, input)) {
      evaluated += 1
      const ageMinutes = Math.max(
        0,
        Math.floor((asOfMs - parseTime(entity.timestamp)) / 60000)
      )
      if (ageMinutes < rule.warnAfterMinutes) continue

      const severity: AlertSeverity =
        ageMinutes >= rule.criticalAfterMinutes ? 'critical' : 'warn'
      const dedupeKey = `${rule.type}:${entity.id}`
      const thresholdMinutes =
        severity === 'critical'
          ? rule.criticalAfterMinutes
          : rule.warnAfterMinutes
      const message = `${entity.label}：${rule.title}，已持续 ${formatDuration(
        ageMinutes
      )}`
      matched.add(dedupeKey)

      const existing = byKey.get(dedupeKey)
      if (!existing || existing.status === 'resolved') {
        const alert: Alert = {
          id: input.nextId('alert'),
          type: rule.type,
          severity,
          targetId: entity.id,
          message,
          status: 'open',
          dedupeKey,
          createdAt: input.nowIso,
          ruleId: rule.id,
          ruleVersion: rule.version,
          ageMinutes,
          thresholdMinutes,
          observedAt: entity.timestamp,
          asOf: input.asOf,
          suggestedAction: rule.suggestedAction,
          ownerRole: rule.ownerRole,
        }
        byKey.set(dedupeKey, alert)
        created.push(alert)
        continue
      }

      const base: Alert = {
        ...existing,
        severity,
        message,
        ageMinutes,
        thresholdMinutes,
        observedAt: entity.timestamp,
        asOf: input.asOf,
        ruleId: rule.id,
        ruleVersion: rule.version,
        suggestedAction: rule.suggestedAction,
        ownerRole: rule.ownerRole,
      }

      if (existing.status === 'acknowledged' && severity === 'critical') {
        const reopened: Alert = { ...base, status: 'open' }
        byKey.set(dedupeKey, reopened)
        updated.push(reopened)
        escalated.push({
          alert: reopened,
          from: existing.severity,
          to: severity,
        })
      } else {
        byKey.set(dedupeKey, base)
        updated.push(base)
        if (existing.status === 'open' && severity === 'critical' && existing.severity !== 'critical') {
          escalated.push({ alert: base, from: existing.severity, to: severity })
        }
      }
    }
  }

  const ruleTypes = new Set(ALERT_RULE_PACK.rules.map((rule) => rule.type))
  for (const alert of input.alerts) {
    if (alert.status === 'resolved' || matched.has(alert.dedupeKey)) continue
    if (!ruleTypes.has(alert.type)) continue
    const next: Alert = {
      ...alert,
      status: 'resolved',
      resolvedAt: input.nowIso,
      resolvedReason: 'condition_cleared',
      asOf: input.asOf,
    }
    byKey.set(alert.dedupeKey, next)
    resolved.push(next)
  }

  return {
    created,
    updated,
    escalated,
    resolved,
    open: [...byKey.values()].filter((alert) => alert.status === 'open'),
    evaluated,
  }
}
