import {
  AgriQaInput,
  isHighRisk,
  needsPestCheck,
  type AgriQaState,
  type KnowledgeChunk,
  type MonitorEvent,
  type MonitorEventType,
  type PestDetection,
  type PlotSummary,
} from '../domain/types'
import { domainError, type DomainError } from '../domain/errors'
import { err, ok, type Result } from '../domain/result'
import type {
  Checkpointer,
  Clock,
  IdGenerator,
  ModelGateway,
  Monitor,
  ToolContext,
  ToolGateway,
} from '../ports/ports'

export interface AgriQaDeps {
  readonly tools: ToolGateway
  readonly models: ModelGateway
  readonly checkpointer: Checkpointer
  readonly monitor: Monitor
  readonly clock: Clock
  readonly ids: IdGenerator
}

function event(
  deps: AgriQaDeps,
  type: MonitorEventType,
  ctx: ToolContext,
  payload: Readonly<Record<string, unknown>>
): MonitorEvent {
  return {
    eventId: deps.ids.next(),
    type,
    occurredAt: deps.clock.nowIso(),
    actorUid: ctx.actorUid,
    traceId: ctx.traceId,
    payload,
  }
}

async function escalate(
  state: AgriQaState,
  reasonCode: string,
  reason: string,
  deps: AgriQaDeps,
  ctx: ToolContext
): Promise<Result<AgriQaState, DomainError>> {
  const next: AgriQaState = {
    ...state,
    status: 'escalated',
    escalatedTo: 'agronomist',
    escalationReason: `${reasonCode}: ${reason}`,
    updatedAt: deps.clock.nowIso(),
  }
  await deps.monitor.record(
    event(deps, 'agent.human.required', ctx, {
      reason: reasonCode,
      detail: reason,
    })
  )
  await deps.checkpointer.save(next)
  await deps.monitor.record(
    event(deps, 'agent.task.closed', ctx, {
      status: 'escalated',
      reason: reasonCode,
      tokensUsed: next.tokensUsed,
    })
  )
  return ok(next)
}

/**
 * 最小业务：农户问农事问题。
 * 流程：身份/地块 → 知识检索 → 可选病虫害 → 模型生成 → 低置信度/无引用升级人工。
 * 每个阶段写检查点；模型失败时保留状态，重试从断点继续。
 */
export async function askFarmQuestion(
  raw: unknown,
  deps: AgriQaDeps
): Promise<Result<AgriQaState, DomainError>> {
  const parsed = AgriQaInput.safeParse(raw)
  if (!parsed.success) {
    return err(
      domainError(
        'AGRI_INVALID_INPUT',
        parsed.error.issues[0]?.message ?? '入参不合法'
      )
    )
  }

  const input = parsed.data
  const ctx: ToolContext = {
    actorUid: input.userId,
    traceId: input.traceId ?? input.threadId,
  }

  let state = await deps.checkpointer.load(input.threadId)
  if (!state) {
    const now = deps.clock.nowIso()
    state = {
      threadId: input.threadId,
      userId: input.userId,
      plotId: input.plotId,
      question: input.question,
      status: 'received',
      chunks: [],
      citations: [],
      tokensUsed: 0,
      createdAt: now,
      updatedAt: now,
    }
  }

  if (state.status === 'answered' || state.status === 'escalated') {
    return ok(state)
  }

  if (state.status === 'received') {
    await deps.monitor.record(
      event(deps, 'agent.task.received', ctx, {
        question: state.question,
        plotId: state.plotId,
      })
    )
    const plotResult = await deps.tools.invoke('plot.query', ctx, {
      plotId: state.plotId,
      actorUid: state.userId,
    })
    if (!plotResult.ok) {
      return escalate(
        state,
        plotResult.error.code,
        plotResult.error.message,
        deps,
        ctx
      )
    }
    state = {
      ...state,
      plot: plotResult.value as PlotSummary,
      status: 'context_loaded',
      updatedAt: deps.clock.nowIso(),
    }
    await deps.checkpointer.save(state)
  }

  if (state.status === 'context_loaded') {
    const knowledgeResult = await deps.tools.invoke('knowledge.search', ctx, {
      query: state.question,
      topK: 3,
    })
    if (!knowledgeResult.ok) {
      return escalate(
        state,
        knowledgeResult.error.code,
        knowledgeResult.error.message,
        deps,
        ctx
      )
    }
    state = {
      ...state,
      chunks: knowledgeResult.value as readonly KnowledgeChunk[],
      status: 'retrieved',
      updatedAt: deps.clock.nowIso(),
    }
    await deps.checkpointer.save(state)
  }

  if (state.status === 'retrieved' && needsPestCheck(state.question)) {
    const pestResult = await deps.tools.invoke('pest.detect', ctx, {
      question: state.question,
      ...(state.plot ? { crop: state.plot.crop } : {}),
    })
    if (!pestResult.ok) {
      return escalate(
        state,
        pestResult.error.code,
        pestResult.error.message,
        deps,
        ctx
      )
    }
    state = {
      ...state,
      pest: pestResult.value as PestDetection,
      status: 'pest_checked',
      updatedAt: deps.clock.nowIso(),
    }
    await deps.checkpointer.save(state)
  }

  if (state.status === 'retrieved' || state.status === 'pest_checked') {
    if (state.chunks.length === 0) {
      const reason = isHighRisk(state.question)
        ? '高风险问题没有检索到可引用资料'
        : '没有检索到可引用资料'
      return escalate(state, 'AGRI_NO_CITATION', reason, deps, ctx)
    }

    if (state.pest && state.pest.topConfidence < 0.75) {
      return escalate(
        state,
        'AGRI_LOW_CONFIDENCE',
        `病虫害识别置信度不足：${state.pest.topConfidence}`,
        deps,
        ctx
      )
    }

    const modelResult = await deps.models.generate({
      question: state.question,
      ...(state.plot ? { plot: state.plot } : {}),
      chunks: state.chunks,
      ...(state.pest ? { pest: state.pest } : {}),
    })
    if (!modelResult.ok) {
      // 模型失败：保留当前检查点，调用方可用同一 threadId 重试
      return err(modelResult.error)
    }
    if (modelResult.value.citations.length === 0) {
      return escalate(
        state,
        'AGRI_NO_CITATION',
        '模型回答没有引用来源',
        deps,
        ctx
      )
    }

    state = {
      ...state,
      answer: modelResult.value.answer,
      citations: modelResult.value.citations,
      tokensUsed: state.tokensUsed + modelResult.value.tokensUsed,
      status: 'answered',
      updatedAt: deps.clock.nowIso(),
    }
    await deps.checkpointer.save(state)
  }

  await deps.monitor.record(
    event(deps, 'agent.task.closed', ctx, {
      status: state.status,
      citations: state.citations.length,
      tokensUsed: state.tokensUsed,
    })
  )

  return ok(state)
}
