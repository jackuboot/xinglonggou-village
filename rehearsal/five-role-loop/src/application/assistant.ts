import type { Actor, Role, ToolName } from '../domain/types'
import { domainError, type DomainError } from '../domain/errors'
import { err, ok, type Result } from '../domain/result'
import type { RoleGateway } from './role-gateway'

const ROLE_TOOL: Record<Role, ToolName> = {
  farmer: 'plot.list',
  keeper: 'batch.list',
  consumer: 'trace.list',
  auditor: 'audit.query',
  admin: 'system.status',
}

export interface AssistantReply {
  readonly answer: string
  readonly data: unknown
}

/**
 * 五角色助手（最小模拟）：
 * 每个角色只能通过自己的工具范围取数；回答是确定性模板，不是真实 LLM。
 */
export async function askRoleAssistant(
  actor: Actor,
  question: string,
  gateway: RoleGateway
): Promise<Result<AssistantReply, DomainError>> {
  const role = actor.roles[0]
  if (!role) {
    return err(domainError('AUTH_DENIED', '用户没有任何角色'))
  }

  const tool = ROLE_TOOL[role]
  const result = await gateway.invoke(actor, tool, {})
  if (!result.ok) return err(result.error)

  const data = result.value
  if (tool === 'plot.list' && Array.isArray(data)) {
    return ok({
      answer: `您好，${question}。您名下共有 ${data.length} 块地块。`,
      data,
    })
  }
  if (tool === 'batch.list' && Array.isArray(data)) {
    return ok({
      answer: `您好，${question}。本村共有 ${data.length} 个可售批次。`,
      data,
    })
  }
  if (tool === 'trace.list' && Array.isArray(data)) {
    return ok({
      answer: `您好，${question}。当前有 ${data.length} 个可溯源批次。`,
      data,
    })
  }
  if (tool === 'audit.query' && Array.isArray(data)) {
    return ok({
      answer: `您好，${question}。共有 ${data.length} 条审计事件。`,
      data,
    })
  }
  return ok({
    answer: `您好，${question}。系统当前统计：${JSON.stringify(data)}。`,
    data,
  })
}
