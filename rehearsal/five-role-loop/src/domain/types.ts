import { z } from 'zod'

export const ROLES = ['farmer', 'keeper', 'consumer', 'auditor', 'admin'] as const
export type Role = (typeof ROLES)[number]

export interface Actor {
  readonly uid: string
  readonly name: string
  readonly roles: readonly Role[]
  readonly villageId: string
}

export interface Produce {
  readonly id: string
  readonly farmerUid: string
  readonly villageId: string
  readonly groupName: string
  readonly vegetableName: string
  readonly quantityKg: number
  readonly harvestDate: string
  readonly status: 'submitted' | 'active' | 'rejected'
  readonly submittedAt: string
}

export interface Batch {
  readonly id: string
  readonly produceId: string
  readonly villageId: string
  readonly productName: string
  readonly status: 'available'
  readonly createdBy: string
  readonly createdAt: string
}

export interface Booking {
  readonly id: string
  readonly batchId: string
  readonly consumerUid: string
  readonly status: 'booked'
  readonly assignedTo?: string
  readonly createdAt: string
}

export type AlertType = 'stale_produce' | 'unsold_batch' | 'unassigned_booking'
export type AlertSeverity = 'warn' | 'critical'
export type AlertStatus = 'open' | 'acknowledged' | 'resolved'

export interface Alert {
  readonly id: string
  readonly type: AlertType
  readonly severity: AlertSeverity
  readonly targetId: string
  readonly message: string
  readonly status: AlertStatus
  readonly dedupeKey: string
  readonly createdAt: string
  readonly ruleId?: string
  readonly ruleVersion?: number
  readonly ageMinutes?: number
  readonly thresholdMinutes?: number
  readonly observedAt?: string
  readonly asOf?: string
  readonly suggestedAction?: string
  readonly ownerRole?: Role
  readonly resolvedAt?: string
  readonly resolvedReason?: string
}

export interface AuditEvent {
  readonly id: string
  readonly type: string
  readonly occurredAt: string
  readonly actorUid: string
  readonly payload: Readonly<Record<string, unknown>>
}

/** 公开溯源视图：不含 farmerUid、手机号等敏感字段 */
export interface TraceView {
  readonly batchId: string
  readonly productName: string
  readonly groupName: string
  readonly vegetableName: string
  readonly quantityKg: number
  readonly harvestDate: string
  readonly batchStatus: string
}

export type ToolName =
  | 'produce.submit'
  | 'produce.review'
  | 'produce.list'
  | 'batch.create'
  | 'batch.list'
  | 'trace.list'
  | 'trace.query'
  | 'booking.create'
  | 'booking.list'
  | 'audit.query'
  | 'system.status'
  | 'review.suggest'
  | 'alert.scan'
  | 'alert.list'
  | 'alert.ack'
  | 'dispatch.suggest'
  | 'dispatch.assign'

export interface Capability {
  readonly roles: readonly Role[]
  readonly scope: 'own' | 'village' | 'all' | 'public'
}

export const CAPABILITIES: Record<ToolName, Capability> = {
  'produce.submit': { roles: ['farmer'], scope: 'own' },
  'produce.review': { roles: ['keeper', 'admin'], scope: 'village' },
  'produce.list': { roles: ['farmer'], scope: 'own' },
  'batch.create': { roles: ['keeper'], scope: 'village' },
  'batch.list': { roles: ['keeper'], scope: 'village' },
  'trace.list': { roles: ['consumer', 'keeper', 'auditor', 'admin'], scope: 'public' },
  'trace.query': { roles: ['consumer', 'keeper', 'auditor', 'admin'], scope: 'public' },
  'booking.create': { roles: ['consumer'], scope: 'own' },
  'booking.list': { roles: ['consumer', 'keeper', 'admin'], scope: 'own' },
  'audit.query': { roles: ['auditor', 'admin'], scope: 'all' },
  'system.status': { roles: ['admin'], scope: 'all' },
  'review.suggest': { roles: ['keeper', 'admin'], scope: 'village' },
  'alert.scan': { roles: ['admin'], scope: 'all' },
  'alert.list': { roles: ['auditor', 'admin'], scope: 'all' },
  'alert.ack': { roles: ['auditor', 'admin'], scope: 'all' },
  'dispatch.suggest': { roles: ['keeper', 'admin'], scope: 'village' },
  'dispatch.assign': { roles: ['keeper', 'admin'], scope: 'village' },
}

export const TOOL_INPUTS = {
  'produce.submit': z
    .object({
      groupName: z.string().min(1).max(50),
      vegetableName: z.string().min(1).max(50),
      quantityKg: z.number().positive().max(5000),
      harvestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .strict(),
  'produce.review': z
    .object({
      produceId: z.string().min(1),
      decision: z.enum(['approve', 'reject']),
    })
    .strict(),
  'produce.list': z.object({}).strict(),
  'batch.create': z
    .object({
      produceId: z.string().min(1),
      productName: z.string().min(1).max(50),
    })
    .strict(),
  'batch.list': z.object({}).strict(),
  'trace.list': z.object({}).strict(),
  'trace.query': z.object({ batchId: z.string().min(1) }).strict(),
  'booking.create': z.object({ batchId: z.string().min(1) }).strict(),
  'booking.list': z.object({}).strict(),
  'audit.query': z.object({}).strict(),
  'system.status': z.object({}).strict(),
  'review.suggest': z.object({ produceId: z.string().min(1) }).strict(),
  'alert.scan': z.object({ asOf: z.string().optional() }).strict(),
  'alert.list': z.object({}).strict(),
  'alert.ack': z.object({ alertId: z.string().min(1) }).strict(),
  'dispatch.suggest': z.object({ bookingId: z.string().min(1) }).strict(),
  'dispatch.assign': z
    .object({
      bookingId: z.string().min(1),
      assigneeUid: z.string().min(1),
    })
    .strict(),
} as const
