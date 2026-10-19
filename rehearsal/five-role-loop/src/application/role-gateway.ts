import {
  CAPABILITIES,
  TOOL_INPUTS,
  type Actor,
  type Alert,
  type AuditEvent,
  type Batch,
  type Booking,
  type Plot,
  type ToolName,
  type TraceView,
} from '../domain/types'
import { domainError, type DomainError } from '../domain/errors'
import { err, ok, type Result } from '../domain/result'
import type { Store } from '../adapters/in-memory'

export interface GatewayDeps {
  readonly store: Store
  readonly clock: { nowIso(): string }
  readonly ids: { next(prefix?: string): string }
}

export interface InvokeOptions {
  readonly agentId?: string
}

export interface RoleGateway {
  invoke(
    actor: Actor,
    tool: ToolName,
    input: unknown,
    options?: InvokeOptions
  ): Promise<Result<unknown, DomainError>>
}

function traceView(batch: Batch, plot: Plot | undefined): TraceView {
  return {
    batchId: batch.id,
    productName: batch.productName,
    groupName: plot?.groupName ?? '未知',
    areaMu: plot?.areaMu ?? 0,
    crop: plot?.crop ?? '未知',
    batchStatus: batch.status,
  }
}

function hasBooking(store: Store, batchId: string): boolean {
  return [...store.bookings.values()].some(
    (booking) => booking.batchId === batchId
  )
}

/** 角色网关：RBAC + ABAC + 审计；agentId 用于区分 AI 提议与人工操作。 */
export function createRoleGateway(deps: GatewayDeps): RoleGateway {
  const { store } = deps

  async function audit(
    actor: Actor,
    type: string,
    payload: Readonly<Record<string, unknown>>,
    agentId?: string
  ): Promise<void> {
    const event: AuditEvent = {
      id: deps.ids.next('audit'),
      type,
      occurredAt: deps.clock.nowIso(),
      actorUid: actor.uid,
      payload: { ...payload, ...(agentId ? { agentId } : {}) },
    }
    store.audit.push(event)
  }

  return {
    async invoke(actor, tool, input, options = {}): Promise<Result<unknown, DomainError>> {
      const capability = CAPABILITIES[tool]
      const allowed = capability.roles.some((role) => actor.roles.includes(role))
      if (!allowed) {
        await audit(actor, 'access.denied', { tool, reason: 'role' }, options.agentId)
        return err(domainError('AUTH_DENIED', `角色无权调用 ${tool}`))
      }

      const schema = TOOL_INPUTS[tool]
      const parsed = schema.safeParse(input)
      if (!parsed.success) {
        await audit(actor, 'access.denied', { tool, reason: 'input' }, options.agentId)
        return err(
          domainError('INPUT_INVALID', parsed.error.issues[0]?.message ?? '入参不合法')
        )
      }

      const data = parsed.data as Record<string, unknown>

      if (tool === 'plot.submit') {
        const plot: Plot = {
          id: deps.ids.next('plot'),
          ownerUid: actor.uid,
          villageId: actor.villageId,
          groupName: String(data.groupName),
          areaMu: Number(data.areaMu),
          crop: String(data.crop),
          status: 'submitted',
          submittedAt: deps.clock.nowIso(),
        }
        store.plots.set(plot.id, plot)
        await audit(actor, 'plot.submitted', { plotId: plot.id }, options.agentId)
        return ok(plot)
      }

      if (tool === 'plot.review') {
        const plot = store.plots.get(String(data.plotId))
        if (!plot) return err(domainError('PLOT_NOT_FOUND', '地块不存在'))
        if (!actor.roles.includes('admin') && actor.villageId !== plot.villageId) {
          await audit(actor, 'access.denied', { tool, reason: 'village' }, options.agentId)
          return err(domainError('VILLAGE_DENIED', '不能审核其他村的地块'))
        }
        if (plot.status !== 'submitted') {
          return err(domainError('PLOT_INVALID_STATUS', '当前状态不可审核'))
        }
        const next: Plot = {
          ...plot,
          status: data.decision === 'approve' ? 'active' : 'rejected',
        }
        store.plots.set(plot.id, next)
        await audit(
          actor,
          data.decision === 'approve' ? 'plot.approved' : 'plot.rejected',
          { plotId: plot.id },
          options.agentId
        )
        return ok(next)
      }

      if (tool === 'plot.list') {
        return ok(
          [...store.plots.values()].filter((plot) => plot.ownerUid === actor.uid)
        )
      }

      if (tool === 'batch.create') {
        const plot = store.plots.get(String(data.plotId))
        if (!plot) return err(domainError('PLOT_NOT_FOUND', '地块不存在'))
        if (actor.villageId !== plot.villageId) {
          await audit(actor, 'access.denied', { tool, reason: 'village' }, options.agentId)
          return err(domainError('VILLAGE_DENIED', '不能为其他村创建批次'))
        }
        if (plot.status !== 'active') {
          return err(domainError('PLOT_INVALID_STATUS', '地块未生效'))
        }
        const batch: Batch = {
          id: deps.ids.next('batch'),
          plotId: plot.id,
          villageId: plot.villageId,
          productName: String(data.productName),
          status: 'available',
          createdBy: actor.uid,
          createdAt: deps.clock.nowIso(),
        }
        store.batches.set(batch.id, batch)
        await audit(actor, 'batch.created', { batchId: batch.id }, options.agentId)
        return ok(batch)
      }

      if (tool === 'batch.list') {
        return ok(
          [...store.batches.values()].filter(
            (batch) => batch.villageId === actor.villageId
          )
        )
      }

      if (tool === 'trace.list') {
        return ok(
          [...store.batches.values()]
            .filter((batch) => batch.status === 'available')
            .map((batch) => traceView(batch, store.plots.get(batch.plotId)))
        )
      }

      if (tool === 'trace.query') {
        const batch = store.batches.get(String(data.batchId))
        if (!batch) return err(domainError('BATCH_NOT_FOUND', '批次不存在'))
        return ok(traceView(batch, store.plots.get(batch.plotId)))
      }

      if (tool === 'booking.create') {
        const batch = store.batches.get(String(data.batchId))
        if (!batch) return err(domainError('BATCH_NOT_FOUND', '批次不存在'))
        const booking: Booking = {
          id: deps.ids.next('booking'),
          batchId: batch.id,
          consumerUid: actor.uid,
          status: 'booked',
          createdAt: deps.clock.nowIso(),
        }
        store.bookings.set(booking.id, booking)
        await audit(
          actor,
          'booking.created',
          { bookingId: booking.id, batchId: batch.id },
          options.agentId
        )
        return ok(booking)
      }

      if (tool === 'booking.list') {
        return ok(
          [...store.bookings.values()].filter((booking) =>
            actor.roles.includes('consumer')
              ? booking.consumerUid === actor.uid
              : true
          )
        )
      }

      if (tool === 'audit.query') {
        return ok([...store.audit])
      }

      if (tool === 'review.suggest') {
        const plot = store.plots.get(String(data.plotId))
        if (!plot) return err(domainError('PLOT_NOT_FOUND', '地块不存在'))
        if (!actor.roles.includes('admin') && actor.villageId !== plot.villageId) {
          await audit(actor, 'access.denied', { tool, reason: 'village' }, options.agentId)
          return err(domainError('VILLAGE_DENIED', '不能查看其他村的地块'))
        }
        const suspicious = plot.areaMu > 50
        const suggestion = {
          plotId: plot.id,
          recommendation: suspicious ? 'reject' : 'approve',
          confidence: suspicious ? 0.82 : 0.9,
          reasons: suspicious
            ? ['面积超过 50 亩，请核对承包合同']
            : ['字段完整', '面积在常见范围'],
          requiresHumanDecision: true,
        }
        await audit(
          actor,
          'review.suggested',
          { plotId: plot.id, recommendation: suggestion.recommendation },
          options.agentId
        )
        return ok(suggestion)
      }

      if (tool === 'alert.scan') {
        const created: Alert[] = []
        const raise = (
          type: Alert['type'],
          targetId: string,
          message: string,
          dedupeKey: string
        ) => {
          if (store.alerts.has(dedupeKey)) return
          const alert: Alert = {
            id: deps.ids.next('alert'),
            type,
            severity: type === 'stale_plot' ? 'warn' : 'critical',
            targetId,
            message,
            status: 'open',
            dedupeKey,
            createdAt: deps.clock.nowIso(),
          }
          store.alerts.set(dedupeKey, alert)
          created.push(alert)
        }

        for (const plot of store.plots.values()) {
          if (plot.status === 'submitted') {
            raise('stale_plot', plot.id, '地块提交后尚未审核', `stale_plot:${plot.id}`)
          }
        }
        for (const batch of store.batches.values()) {
          if (!hasBooking(store, batch.id)) {
            raise('unsold_batch', batch.id, '批次上架后暂无预约', `unsold_batch:${batch.id}`)
          }
        }
        for (const booking of store.bookings.values()) {
          if (!booking.assignedTo) {
            raise(
              'unassigned_booking',
              booking.id,
              '预约尚未分配履约人',
              `unassigned_booking:${booking.id}`
            )
          }
        }

        await audit(
          actor,
          'alert.scanned',
          { created: created.length, open: store.alerts.size },
          options.agentId
        )
        return ok({ created, open: [...store.alerts.values()] })
      }

      if (tool === 'alert.list') {
        return ok([...store.alerts.values()])
      }

      if (tool === 'alert.ack') {
        const alert = [...store.alerts.values()].find(
          (item) => item.id === String(data.alertId)
        )
        if (!alert) return err(domainError('INPUT_INVALID', '告警不存在'))
        const next: Alert = { ...alert, status: 'acknowledged' }
        store.alerts.set(alert.dedupeKey, next)
        await audit(
          actor,
          'alert.acknowledged',
          { alertId: alert.id },
          options.agentId
        )
        return ok(next)
      }

      if (tool === 'dispatch.suggest') {
        const booking = store.bookings.get(String(data.bookingId))
        if (!booking) return err(domainError('INPUT_INVALID', '预约不存在'))
        const batch = store.batches.get(booking.batchId)
        if (!batch) return err(domainError('BATCH_NOT_FOUND', '批次不存在'))
        const keeper = [...store.keepers.values()].find(
          (item) => item.villageId === batch.villageId
        )
        const suggestion = {
          bookingId: booking.id,
          assigneeUid: keeper?.uid ?? null,
          confidence: keeper ? 0.86 : 0,
          reason: keeper
            ? '本村入库员可承接履约'
            : '本村暂无可用入库员，建议升级人工',
          requiresHumanDecision: true,
        }
        await audit(
          actor,
          'dispatch.suggested',
          { bookingId: booking.id, assigneeUid: suggestion.assigneeUid },
          options.agentId
        )
        return ok(suggestion)
      }

      if (tool === 'dispatch.assign') {
        const booking = store.bookings.get(String(data.bookingId))
        if (!booking) return err(domainError('INPUT_INVALID', '预约不存在'))
        const batch = store.batches.get(booking.batchId)
        if (!batch) return err(domainError('BATCH_NOT_FOUND', '批次不存在'))
        const keeper = store.keepers.get(String(data.assigneeUid))
        if (!keeper || keeper.villageId !== batch.villageId) {
          await audit(actor, 'access.denied', { tool, reason: 'village' }, options.agentId)
          return err(domainError('VILLAGE_DENIED', '只能分配本村入库员'))
        }
        const next: Booking = { ...booking, assignedTo: keeper.uid }
        store.bookings.set(booking.id, next)
        await audit(
          actor,
          'dispatch.assigned',
          { bookingId: booking.id, assigneeUid: keeper.uid },
          options.agentId
        )
        return ok(next)
      }

      return ok({
        plots: store.plots.size,
        batches: store.batches.size,
        bookings: store.bookings.size,
        alerts: store.alerts.size,
        auditEvents: store.audit.length,
      })
    },
  }
}
