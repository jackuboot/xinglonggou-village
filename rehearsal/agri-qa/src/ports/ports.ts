import type {
  AgriQaState,
  Citation,
  KnowledgeChunk,
  MonitorEvent,
  PestDetection,
  PlotSummary,
} from '../domain/types'
import type { DomainError } from '../domain/errors'
import type { Result } from '../domain/result'

export type ToolName = 'plot.query' | 'knowledge.search' | 'pest.detect'

export interface ToolContext {
  readonly actorUid: string
  readonly traceId: string
}

export interface ToolGateway {
  invoke(
    name: ToolName,
    ctx: ToolContext,
    input: unknown
  ): Promise<Result<unknown, DomainError>>
}

export interface ModelRequest {
  readonly question: string
  readonly plot?: PlotSummary
  readonly chunks: readonly KnowledgeChunk[]
  readonly pest?: PestDetection
}

export interface ModelResponse {
  readonly answer: string
  readonly citations: readonly Citation[]
  readonly tokensUsed: number
}

export interface ModelGateway {
  generate(
    request: ModelRequest
  ): Promise<Result<ModelResponse, DomainError>>
}

export interface Checkpointer {
  save(state: AgriQaState): Promise<void>
  load(threadId: string): Promise<AgriQaState | null>
}

export interface Monitor {
  record(event: MonitorEvent): Promise<void>
  all(): Promise<readonly MonitorEvent[]>
}

export interface Clock {
  nowIso(): string
}

export interface IdGenerator {
  next(): string
}

export interface PlotReader {
  getById(id: string): Promise<PlotSummary | null>
}

export interface KnowledgeSearch {
  search(query: string, topK: number): Promise<readonly KnowledgeChunk[]>
}

export interface PestDetector {
  detect(input: {
    question: string
    crop?: string
  }): Promise<PestDetection>
}
