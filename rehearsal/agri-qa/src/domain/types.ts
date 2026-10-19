import { z } from 'zod'

export const AgriQaInput = z
  .object({
    threadId: z.string().min(8).max(128),
    userId: z.string().min(6).max(64),
    plotId: z.string().min(1).max(64),
    question: z.string().min(2).max(300),
    traceId: z.string().min(1).max(128).optional(),
  })
  .strict()

export type AgriQaInput = z.infer<typeof AgriQaInput>

export interface PlotSummary {
  readonly id: string
  readonly ownerUid: string
  readonly groupName: string
  readonly areaMu: number
  readonly crop: string
}

export interface KnowledgeChunk {
  readonly id: string
  readonly title: string
  readonly content: string
  readonly score: number
}

export interface PestCandidate {
  readonly name: string
  readonly confidence: number
}

export interface PestDetection {
  readonly candidates: readonly PestCandidate[]
  readonly topConfidence: number
}

export interface Citation {
  readonly id: string
  readonly title: string
}

export type AgriQaStatus =
  | 'received'
  | 'context_loaded'
  | 'retrieved'
  | 'pest_checked'
  | 'answered'
  | 'escalated'

export type MonitorEventType =
  | 'agent.task.received'
  | 'agent.tool.invoked'
  | 'agent.human.required'
  | 'agent.task.closed'

export interface MonitorEvent {
  readonly eventId: string
  readonly type: MonitorEventType
  readonly occurredAt: string
  readonly actorUid: string
  readonly traceId: string
  readonly payload: Readonly<Record<string, unknown>>
}

export interface AgriQaState {
  readonly threadId: string
  readonly userId: string
  readonly plotId: string
  readonly question: string
  readonly status: AgriQaStatus
  readonly plot?: PlotSummary
  readonly chunks: readonly KnowledgeChunk[]
  readonly pest?: PestDetection
  readonly answer?: string
  readonly citations: readonly Citation[]
  readonly escalatedTo?: string
  readonly escalationReason?: string
  readonly tokensUsed: number
  readonly createdAt: string
  readonly updatedAt: string
}

export const needsPestCheck = (question: string): boolean =>
  ['虫', '病', '黄叶', '发黄', '枯', '斑', '腐烂'].some((keyword) =>
    question.includes(keyword)
  )

export const isHighRisk = (question: string): boolean =>
  ['用药', '农药', '中毒', '病害', '虫害', '枯死'].some((keyword) =>
    question.includes(keyword)
  )
