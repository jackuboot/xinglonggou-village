import type { Actor } from '../domain/types'
import type { DomainError } from '../domain/errors'
import type { Result } from '../domain/result'
import type { RoleGateway } from './role-gateway'

export interface ReviewSuggestion {
  readonly produceId: string
  readonly recommendation: 'approve' | 'reject'
  readonly confidence: number
  readonly reasons: readonly string[]
  readonly requiresHumanDecision: true
}

export interface DispatchSuggestion {
  readonly bookingId: string
  readonly assigneeUid: string | null
  readonly confidence: number
  readonly reason: string
  readonly requiresHumanDecision: true
}

export interface AlertScanResult {
  readonly created: readonly unknown[]
  readonly updated?: readonly unknown[]
  readonly escalated?: readonly unknown[]
  readonly resolved?: readonly unknown[]
  readonly open: readonly unknown[]
  readonly asOf?: string
  readonly ruleVersion?: string
}

/**
 * 审核 Agent：只生成建议，不写业务状态。
 * 人工确认仍走 produce.review。
 */
export async function runReviewAgent(
  actor: Actor,
  produceId: string,
  gateway: RoleGateway
): Promise<Result<ReviewSuggestion, DomainError>> {
  const result = await gateway.invoke(
    actor,
    'review.suggest',
    { produceId },
    { agentId: 'review-agent' }
  )
  if (!result.ok) return result
  return { ok: true, value: result.value as ReviewSuggestion }
}

/**
 * 预警哨兵：按规则包主动扫描；asOf 用于回放/模拟时间，
 * 重复扫描按 dedupeKey 去重，条件解除时自动 resolved。
 */
export async function runAlertSentinel(
  actor: Actor,
  gateway: RoleGateway,
  asOf?: string
): Promise<Result<AlertScanResult, DomainError>> {
  const result = await gateway.invoke(
    actor,
    'alert.scan',
    asOf ? { asOf } : {},
    { agentId: 'alert-sentinel' }
  )
  if (!result.ok) return result
  return { ok: true, value: result.value as AlertScanResult }
}

/**
 * 调度 Agent：只生成派单建议，不写 booking.assignedTo。
 * 人工确认仍走 dispatch.assign。
 */
export async function runDispatcher(
  actor: Actor,
  bookingId: string,
  gateway: RoleGateway
): Promise<Result<DispatchSuggestion, DomainError>> {
  const result = await gateway.invoke(
    actor,
    'dispatch.suggest',
    { bookingId },
    { agentId: 'dispatcher' }
  )
  if (!result.ok) return result
  return { ok: true, value: result.value as DispatchSuggestion }
}
