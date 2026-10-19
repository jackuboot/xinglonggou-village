import { z } from 'zod'

export const ROLES = ['farmer', 'keeper', 'consumer', 'auditor', 'admin'] as const
export type Role = (typeof ROLES)[number]

export interface Actor {
  readonly uid: string
  readonly name: string
  readonly roles: readonly Role[]
  readonly villageId: string
}

export interface Plot {
  readonly id: string
  readonly ownerUid: string
  readonly villageId: string
  readonly groupName: string
  readonly areaMu: number
  readonly crop: string
  readonly status: 'submitted' | 'active' | 'rejected'
}

export interface Batch {
  readonly id: string
  readonly plotId: string
  readonly villageId: string
  readonly productName: string
  readonly status: 'available'
  readonly createdBy: string
}

export interface Booking {
  readonly id: string
  readonly batchId: string
  readonly consumerUid: string
  readonly status: 'booked'
  readonly createdAt: string
}

export interface AuditEvent {
  readonly id: string
  readonly type: string
  readonly occurredAt: string
  readonly actorUid: string
  readonly payload: Readonly<Record<string, unknown>>
}

/** 公开溯源视图：不含 ownerUid、手机号等敏感字段 */
export interface TraceView {
  readonly batchId: string
  readonly productName: string
  readonly groupName: string
  readonly areaMu: number
  readonly crop: string
  readonly batchStatus: string
}

export type ToolName =
  | 'plot.submit'
  | 'plot.review'
  | 'plot.list'
  | 'batch.create'
  | 'batch.list'
  | 'trace.list'
  | 'trace.query'
  | 'booking.create'
  | 'audit.query'
  | 'system.status'

export interface Capability {
  readonly roles: readonly Role[]
  readonly scope: 'own' | 'village' | 'all' | 'public'
}

export const CAPABILITIES: Record<ToolName, Capability> = {
  'plot.submit': { roles: ['farmer'], scope: 'own' },
  'plot.review': { roles: ['keeper', 'admin'], scope: 'village' },
  'plot.list': { roles: ['farmer'], scope: 'own' },
  'batch.create': { roles: ['keeper'], scope: 'village' },
  'batch.list': { roles: ['keeper'], scope: 'village' },
  'trace.list': { roles: ['consumer', 'keeper', 'auditor', 'admin'], scope: 'public' },
  'trace.query': { roles: ['consumer', 'keeper', 'auditor', 'admin'], scope: 'public' },
  'booking.create': { roles: ['consumer'], scope: 'own' },
  'audit.query': { roles: ['auditor', 'admin'], scope: 'all' },
  'system.status': { roles: ['admin'], scope: 'all' },
}

export const TOOL_INPUTS = {
  'plot.submit': z
    .object({
      groupName: z.string().min(1).max(50),
      areaMu: z.number().positive().max(10000),
      crop: z.string().min(1).max(50),
    })
    .strict(),
  'plot.review': z
    .object({
      plotId: z.string().min(1),
      decision: z.enum(['approve', 'reject']),
    })
    .strict(),
  'plot.list': z.object({}).strict(),
  'batch.create': z
    .object({
      plotId: z.string().min(1),
      productName: z.string().min(1).max(50),
    })
    .strict(),
  'batch.list': z.object({}).strict(),
  'trace.list': z.object({}).strict(),
  'trace.query': z.object({ batchId: z.string().min(1) }).strict(),
  'booking.create': z.object({ batchId: z.string().min(1) }).strict(),
  'audit.query': z.object({}).strict(),
  'system.status': z.object({}).strict(),
} as const
