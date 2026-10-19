import { ReviewPlotInput, type Plot } from '../domain/plot'
import { domainError, type DomainError } from '../domain/errors'
import { err, ok, type Result } from '../domain/result'
import type { PlotRepository } from '../ports/plot-repository'
import type { AuditLog, Clock, IdGenerator } from '../ports/audit-log'

export interface ReviewPlotDeps {
  readonly repo: PlotRepository
  readonly audit: AuditLog
  readonly clock: Clock
  readonly ids: IdGenerator
}

const REVIEWABLE_STATUSES = new Set<Plot['status']>(['submitted', 'under_review'])

/**
 * 审核地块：只有 keeper/admin 可操作；非 admin 只能审核本村数据；
 * 驳回必须填写原因；版本号不匹配时拒绝，避免并发覆盖。
 */
export async function reviewPlot(
  raw: unknown,
  deps: ReviewPlotDeps
): Promise<Result<Plot, DomainError>> {
  const parsed = ReviewPlotInput.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return err(domainError('PLOT_INVALID_INPUT', issue?.message ?? '入参不合法'))
  }

  const input = parsed.data
  const isAdmin = input.actorRoles.includes('admin')
  const isKeeper = input.actorRoles.includes('keeper')
  if (!isAdmin && !isKeeper) {
    return err(domainError('PLOT_FORBIDDEN', '只有入库员或管理员可以审核地块'))
  }

  const plot = await deps.repo.findById(input.plotId)
  if (!plot) return err(domainError('PLOT_NOT_FOUND', '地块不存在'))

  if (!isAdmin && input.actorVillageId !== plot.villageId) {
    return err(domainError('PLOT_FORBIDDEN', '不能审核其他村的地块'))
  }
  if (plot.version !== input.expectedVersion) {
    return err(domainError('PLOT_VERSION_CONFLICT', '数据已被他人修改，请刷新后重试', true))
  }
  if (!REVIEWABLE_STATUSES.has(plot.status)) {
    return err(domainError('PLOT_INVALID_STATUS', `当前状态不可审核：${plot.status}`))
  }
  if (input.decision === 'reject' && !input.reason?.trim()) {
    return err(domainError('PLOT_REJECT_REASON_REQUIRED', '驳回必须填写原因'))
  }

  const now = deps.clock.nowIso()
  const next: Plot = {
    ...plot,
    status: input.decision === 'approve' ? 'active' : 'rejected',
    version: plot.version + 1,
    updatedAt: now,
  }

  await deps.repo.save(next)
  await deps.audit.append({
    eventId: deps.ids.next(),
    type: input.decision === 'approve' ? 'plot.approved' : 'plot.rejected',
    occurredAt: now,
    actorUid: input.actorUid,
    traceId: input.traceId ?? deps.ids.next(),
    payload: {
      plotId: plot.id,
      decision: input.decision,
      reason: input.reason ?? '',
    },
  })

  return ok(next)
}
