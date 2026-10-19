import {
  CAPABILITIES,
  TOOL_INPUTS,
  type Actor,
  type Alert,
  type AuditEvent,
  type Batch,
  type Booking,
  type Produce,
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

function traceView(batch: Batch, produce: Produce | undefined): TraceView {
  return {
    batchId: batch.id,
    productName: batch.productName,
    groupName: produce?.groupName ?? '未知',
    vegetableName: produce?.vegetableName ?? '未知',
    quantityKg: produce?.quantityKg ?? 0,
    harvestDate: produce?.harvestDate ?? '未知',
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

      if (tool === 'produce.submit') {
        const produce: Produce = {
          id: deps.ids.next('produce'),
          farmerUid: actor.uid,
          villageId: actor.villageId,
          groupName: String(data.groupName),
          vegetableName: String(data.vegetableName),
          quantityKg: Number(data.quantityKg),
          harvestDate: String(data.harvestDate),
          status: 'submitted',
          submittedAt: deps.clock.nowIso(),
        }
        store.produces.set(produce.id, produce)
        await audit(actor, 'produce.submitted', { produceId: produce.id }, options.agentId)
        return ok(produce)
      }

      if (tool === 'produce.review') {
        const produce = store.produces.get(String(data.produceId))
        if (!produce) return err(domainError('PRODUCE_NOT_FOUND', '蔬菜批次不存在'))
        if (!actor.roles.includes('admin') && actor.villageId !== produce.villageId) {
          await audit(actor, 'access.denied', { tool, reason: 'village' }, options.agentId)
          return err(domainError('VILLAGE_DENIED', '不能审核其他村的蔬菜批次'))
        }
        if (produce.status !== 'submitted') {
          return err(domainError('PRODUCE_INVALID_STATUS', '当前状态不可审核'))
        }
        const next: Produce = {
          ...produce,
          status: data.decision === 'approve' ? 'active' : 'rejected',
        }
        store.produces.set(produce.id, next)
        await audit(
          actor,
          data.decision === 'approve' ? 'produce.approved' : 'produce.rejected',
          { produceId: produce.id },
          options.agentId
        )
        return ok(next)
      }

      if (tool === 'produce.list') {
        return ok(
          [...store.produces.values()].filter((produce) => produce.farmerUid === actor.uid)
        )
      }

      if (tool === 'batch.create') {
        const produce = store.produces.get(String(data.produceId))
        if (!produce) return err(domainError('PRODUCE_NOT_FOUND', '蔬菜批次不存在'))
        if (actor.villageId !== produce.villageId) {
          await audit(actor, 'access.denied', { tool, reason: 'village' }, options.agentId)
          return err(domainError('VILLAGE_DENIED', '不能为其他村创建批次'))
        }
        if (produce.status !== 'active') {
          return err(domainError('PRODUCE_INVALID_STATUS', '蔬菜批次未生效'))
        }
        const batch: Batch = {
          id: deps.ids.next('batch'),
          produceId: produce.id,
          villageId: produce.villageId,
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
            .map((batch) => traceView(batch, store.produces.get(batch.produceId)))
        )
      }

      if (tool === 'trace.query') {
        const batch = store.batches.get(String(data.batchId))
        if (!batch) return err(domainError('BATCH_NOT_FOUND', '批次不存在'))
        return ok(traceView(batch, store.produces.get(batch.produceId)))
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
        const produce = store.produces.get(String(data.produceId))
        if (!produce) return err(domainError('PRODUCE_NOT_FOUND', '蔬菜批次不存在'))
        if (!actor.roles.includes('admin') && actor.villageId !== produce.villageId) {
          await audit(actor, 'access.denied', { tool, reason: 'village' }, options.agentId)
          return err(domainError('VILLAGE_DENIED', '不能查看其他村的蔬菜批次'))
        }
        const suspicious = produce.quantityKg > 500
        const suggestion = {
          produceId: produce.id,
          recommendation: suspicious ? 'reject' : 'approve',
          confidence: suspicious ? 0.82 : 0.9,
          reasons: suspicious
            ? ['申报数量超过 500 公斤，请核对采收记录']
            : ['字段完整', '数量在常见范围'],
          requiresHumanDecision: true,
        }
        await audit(
          actor,
          'review.suggested',
          { produceId: produce.id, recommendation: suggestion.recommendation },
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
            severity: type === 'stale_produce' ? 'warn' : 'critical',
            targetId,
            message,
            status: 'open',
            dedupeKey,
            createdAt: deps.clock.nowIso(),
          }
          store.alerts.set(dedupeKey, alert)
          created.push(alert)
        }

        for (const produce of store.produces.values()) {
          if (produce.status === 'submitted') {
            raise('stale_produce', produce.id, '蔬菜批次提交后尚未审核', `stale_produce:${produce.id}`)
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
        produces: store.produces.size,
        batches: store.batches.size,
        bookings: store.bookings.size,
        alerts: store.alerts.size,
        auditEvents: store.audit.length,
      })
    },
  }
}
