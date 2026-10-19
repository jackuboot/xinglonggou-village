import { z } from 'zod'

export const PLOT_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'active',
] as const

export type PlotStatus = (typeof PLOT_STATUSES)[number]

export interface Plot {
  readonly id: string
  readonly ownerUid: string
  readonly villageId: string
  readonly groupName: string
  readonly areaMu: number
  readonly crop: string
  readonly status: PlotStatus
  readonly version: number
  readonly createdAt: string
  readonly updatedAt: string
  readonly idempotencyKey: string
}

export const SubmitPlotInput = z
  .object({
    actorUid: z.string().min(6).max(64),
    villageId: z.string().min(1).max(64),
    groupName: z.string().min(1).max(50),
    areaMu: z.number().positive().max(10000),
    crop: z.string().min(1).max(50),
    idempotencyKey: z.string().min(8).max(128),
    traceId: z.string().min(1).max(128).optional(),
  })
  .strict()

export type SubmitPlotInput = z.infer<typeof SubmitPlotInput>

export const ROLES = ['farmer', 'keeper', 'consumer', 'auditor', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const ReviewPlotInput = z
  .object({
    actorUid: z.string().min(6).max(64),
    actorRoles: z.array(z.enum(ROLES)).min(1),
    actorVillageId: z.string().min(1).max(64),
    plotId: z.string().min(1).max(64),
    decision: z.enum(['approve', 'reject']),
    reason: z.string().max(200).optional(),
    expectedVersion: z.number().int().positive(),
    traceId: z.string().min(1).max(128).optional(),
  })
  .strict()

export type ReviewPlotInput = z.infer<typeof ReviewPlotInput>
