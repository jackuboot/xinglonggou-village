import type { MonitorEvent } from '../domain/types'
import { domainError } from '../domain/errors'
import { err, ok, type Result } from '../domain/result'
import type {
  KnowledgeSearch,
  Monitor,
  PestDetector,
  PlotReader,
  ToolContext,
  ToolGateway,
  ToolName,
} from '../ports/ports'

export interface ToolGatewayDeps {
  readonly plots: PlotReader
  readonly knowledge: KnowledgeSearch
  readonly pest: PestDetector
  readonly monitor: Monitor
  readonly clock: { nowIso(): string }
  readonly ids: { next(): string }
}

const ALLOWED_TOOLS = new Set<ToolName>([
  'plot.query',
  'knowledge.search',
  'pest.detect',
])

/**
 * 工具网关：白名单 + 身份/数据范围 + 审计。
 * Agent 不能绕过它直接访问适配器。
 */
export function createToolGateway(deps: ToolGatewayDeps): ToolGateway {
  async function record(
    ctx: ToolContext,
    tool: ToolName,
    status: 'ok' | 'error',
    code?: string
  ): Promise<void> {
    const event: MonitorEvent = {
      eventId: deps.ids.next(),
      type: 'agent.tool.invoked',
      occurredAt: deps.clock.nowIso(),
      actorUid: ctx.actorUid,
      traceId: ctx.traceId,
      payload: { tool, status, ...(code ? { code } : {}) },
    }
    await deps.monitor.record(event)
  }

  return {
    async invoke(name, ctx, input): Promise<Result<unknown, import('../domain/errors').DomainError>> {
      if (!ALLOWED_TOOLS.has(name)) {
        await record(ctx, name, 'error', 'AGRI_TOOL_DENIED')
        return err(domainError('AGRI_TOOL_DENIED', `工具未授权：${name}`))
      }

      if (name === 'plot.query') {
        const { plotId, actorUid } = input as {
          plotId: string
          actorUid: string
        }
        const plot = await deps.plots.getById(plotId)
        if (!plot || plot.ownerUid !== ctx.actorUid || actorUid !== ctx.actorUid) {
          await record(ctx, name, 'error', 'AGRI_TOOL_DENIED')
          return err(domainError('AGRI_TOOL_DENIED', '无权访问该地块'))
        }
        await record(ctx, name, 'ok')
        return ok(plot)
      }

      if (name === 'knowledge.search') {
        const { query, topK } = input as { query: string; topK: number }
        const chunks = await deps.knowledge.search(query, topK)
        await record(ctx, name, 'ok')
        return ok(chunks)
      }

      const { question, crop } = input as { question: string; crop?: string }
      const detection = await deps.pest.detect({
        question,
        ...(crop ? { crop } : {}),
      })
      await record(ctx, name, 'ok')
      return ok(detection)
    },
  }
}
