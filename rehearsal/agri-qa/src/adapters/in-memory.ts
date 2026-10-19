import type {
  AgriQaState,
  KnowledgeChunk,
  MonitorEvent,
  PestDetection,
  PlotSummary,
} from '../domain/types'
import type { DomainError } from '../domain/errors'
import { domainError } from '../domain/errors'
import { err, ok, type Result } from '../domain/result'
import type {
  Checkpointer,
  KnowledgeSearch,
  ModelGateway,
  ModelRequest,
  ModelResponse,
  Monitor,
  PestDetector,
  PlotReader,
} from '../ports/ports'

export class InMemoryPlotStore implements PlotReader {
  private readonly plots = new Map<string, PlotSummary>()
  getCalls = 0

  seed(plot: PlotSummary): void {
    this.plots.set(plot.id, plot)
  }

  async getById(id: string): Promise<PlotSummary | null> {
    this.getCalls += 1
    return this.plots.get(id) ?? null
  }
}

const KNOWLEDGE_KEYWORDS = ['黄叶', '发黄', '虫', '病', '茶', '施肥', '修剪']

export class InMemoryKnowledgeBase implements KnowledgeSearch {
  searchCalls = 0

  constructor(private readonly chunks: readonly KnowledgeChunk[] = []) {}

  async search(query: string, topK: number): Promise<readonly KnowledgeChunk[]> {
    this.searchCalls += 1
    return this.chunks
      .map((chunk) => {
        const text = `${chunk.title}${chunk.content}`
        const score = KNOWLEDGE_KEYWORDS.filter(
          (keyword) => query.includes(keyword) && text.includes(keyword)
        ).length
        return { ...chunk, score }
      })
      .filter((chunk) => chunk.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }
}

export class StubPestDetector implements PestDetector {
  calls = 0

  constructor(private readonly topConfidence = 0.9) {}

  async detect(input: { question: string; crop?: string }): Promise<PestDetection> {
    this.calls += 1
    return {
      candidates: [
        { name: '茶小绿叶蝉', confidence: this.topConfidence },
        { name: '茶炭疽病', confidence: Math.max(0, this.topConfidence - 0.2) },
      ],
      topConfidence: this.topConfidence,
    }
  }
}

export interface StubModelOptions {
  failuresRemaining?: number
}

export class StubModelGateway implements ModelGateway {
  calls = 0
  private failuresRemaining: number

  constructor(options: StubModelOptions = {}) {
    this.failuresRemaining = options.failuresRemaining ?? 0
  }

  async generate(
    request: ModelRequest
  ): Promise<Result<ModelResponse, DomainError>> {
    this.calls += 1
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1
      return err(domainError('AGRI_MODEL_FAILED', '模型暂时不可用', true))
    }

    const top = request.chunks[0]
    if (!top) {
      return ok({
        answer: '暂时没有足够的资料回答这个问题，已转交农技员。',
        citations: [],
        tokensUsed: 20,
      })
    }

    const plotText = request.plot
      ? `根据您${request.plot.groupName}的${request.plot.areaMu}亩${request.plot.crop}：`
      : ''
    const answer = `${plotText}${top.content} 建议先记录叶片情况并观察 3 天。`
    const citations = request.chunks.map((chunk) => ({
      id: chunk.id,
      title: chunk.title,
    }))

    return ok({
      answer,
      citations,
      tokensUsed: Math.ceil((request.question.length + answer.length) / 4),
    })
  }
}

export class InMemoryCheckpointer implements Checkpointer {
  private readonly states = new Map<string, AgriQaState>()

  async save(state: AgriQaState): Promise<void> {
    this.states.set(state.threadId, structuredClone(state))
  }

  async load(threadId: string): Promise<AgriQaState | null> {
    const state = this.states.get(threadId)
    return state ? structuredClone(state) : null
  }
}

export class InMemoryMonitor implements Monitor {
  private readonly events: MonitorEvent[] = []

  async record(event: MonitorEvent): Promise<void> {
    this.events.push(event)
  }

  async all(): Promise<readonly MonitorEvent[]> {
    return [...this.events]
  }
}

export class FixedClock {
  private tick = 0

  nowIso(): string {
    return new Date(Date.UTC(2026, 9, 19, 0, 0, this.tick++)).toISOString()
  }
}

export class SeqIds {
  private seq = 0

  next(): string {
    return `id-${++this.seq}`
  }
}
