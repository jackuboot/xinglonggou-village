import {
  CAPABILITIES,
  TOOL_INPUTS,
  type Actor,
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

export interface RoleGateway {
  invoke(
    actor: Actor,
    tool: ToolName,
    input: unknown
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

/** 角色网关：RBAC（角色）+ ABAC（村/本人）+ 审计。 */
export function createRoleGateway(deps: GatewayDeps): RoleGateway {
  const { store } = deps

  async function audit(
    actor: Actor,
    type: string,
    payload: Readonly<Record<string, unknown>>
  ): Promise<void> {
    const event: AuditEvent = {
      id: deps.ids.next('audit'),
      type,
      occurredAt: deps.clock.nowIso(),
      actorUid: actor.uid,
      payload,
    }
    store.audit.push(event)
  }

  return {
    async invoke(actor, tool, input): Promise<Result<unknown, DomainError>> {
      const capability = CAPABILITIES[tool]
      const allowed = capability.roles.some((role) => actor.roles.includes(role))
      if (!allowed) {
        await audit(actor, 'access.denied', { tool, reason: 'role' })
        return err(domainError('AUTH_DENIED', `角色无权调用 ${tool}`))
      }

      const schema = TOOL_INPUTS[tool]
      const parsed = schema.safeParse(input)
      if (!parsed.success) {
        await audit(actor, 'access.denied', { tool, reason: 'input' })
        return err(
          domainError(
            'INPUT_INVALID',
            parsed.error.issues[0]?.message ?? '入参不合法'
          )
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
        }
        store.plots.set(plot.id, plot)
        await audit(actor, 'plot.submitted', { plotId: plot.id })
        return ok(plot)
      }

      if (tool === 'plot.review') {
        const plot = store.plots.get(String(data.plotId))
        if (!plot) return err(domainError('PLOT_NOT_FOUND', '地块不存在'))
        if (!actor.roles.includes('admin') && actor.villageId !== plot.villageId) {
          await audit(actor, 'access.denied', { tool, reason: 'village' })
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
          { plotId: plot.id }
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
          await audit(actor, 'access.denied', { tool, reason: 'village' })
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
        }
        store.batches.set(batch.id, batch)
        await audit(actor, 'batch.created', { batchId: batch.id })
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
        await audit(actor, 'booking.created', {
          bookingId: booking.id,
          batchId: batch.id,
        })
        return ok(booking)
      }

      if (tool === 'audit.query') {
        return ok([...store.audit])
      }

      // system.status
      return ok({
        plots: store.plots.size,
        batches: store.batches.size,
        bookings: store.bookings.size,
        auditEvents: store.audit.length,
      })
    },
  }
}
