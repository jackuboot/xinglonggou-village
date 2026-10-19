import { SubmitPlotInput, type Plot } from '../domain/plot'
import { domainError, type DomainError } from '../domain/errors'
import { err, ok, type Result } from '../domain/result'
import type { PlotRepository } from '../ports/plot-repository'
import type { AuditLog, Clock, IdGenerator } from '../ports/audit-log'

export interface SubmitPlotDeps {
  readonly repo: PlotRepository
  readonly audit: AuditLog
  readonly clock: Clock
  readonly ids: IdGenerator
}

/**
 * 提交地块（纯用例编排）：
 * - 入参经 Zod 严格校验；
 * - 幂等键重复提交返回已有记录，不重复写审计；
 * - 新记录状态为 submitted，等待 keeper 审核。
 */
export async function submitPlot(
  raw: unknown,
  deps: SubmitPlotDeps
): Promise<Result<Plot, DomainError>> {
  const parsed = SubmitPlotInput.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return err(domainError('PLOT_INVALID_INPUT', issue?.message ?? '入参不合法'))
  }

  const input = parsed.data
  const existing = await deps.repo.findByIdempotencyKey(input.idempotencyKey)
  if (existing) return ok(existing)

  const now = deps.clock.nowIso()
  const plot: Plot = {
    id: deps.ids.next(),
    ownerUid: input.actorUid,
    villageId: input.villageId,
    groupName: input.groupName,
    areaMu: input.areaMu,
    crop: input.crop,
    status: 'submitted',
    version: 1,
    createdAt: now,
    updatedAt: now,
    idempotencyKey: input.idempotencyKey,
  }

  await deps.repo.save(plot)
  await deps.audit.append({
    eventId: deps.ids.next(),
    type: 'plot.submitted',
    occurredAt: now,
    actorUid: input.actorUid,
    traceId: input.traceId ?? deps.ids.next(),
    payload: { plotId: plot.id, areaMu: plot.areaMu, crop: plot.crop },
  })

  return ok(plot)
}
