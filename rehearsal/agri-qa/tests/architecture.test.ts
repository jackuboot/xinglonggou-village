import { describe, expect, it } from 'vitest'
import { SessionRegistry } from '../src/application/session-actor'
import { askFarmQuestion } from '../src/application/ask-farm-question'
import { farmerInput, makeWorld } from './helpers'

describe('架构约束：工具白名单、会话串行、会话隔离', () => {
  it('工具网关闭非白名单工具', async () => {
    const world = makeWorld()
    const result = await world.deps.tools.invoke(
      'db.raw' as never,
      { actorUid: 'farmer-001', traceId: 'trace-x' },
      {}
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('AGRI_TOOL_DENIED')
  })

  it('同一 thread 的任务串行执行（Actor 单写者）', async () => {
    const registry = new SessionRegistry()
    const order: string[] = []

    const first = registry.run('thread-a', async () => {
      order.push('first-start')
      await new Promise((resolve) => setTimeout(resolve, 20))
      order.push('first-end')
    })
    const second = registry.run('thread-a', async () => {
      order.push('second-start')
    })

    await Promise.all([first, second])
    expect(order).toEqual(['first-start', 'first-end', 'second-start'])
  })

  it('不同 thread 的会话状态互不影响', async () => {
    const world = makeWorld()
    const a = await askFarmQuestion(farmerInput(), world.deps)
    const b = await askFarmQuestion(
      farmerInput({
        threadId: 'thread-0002',
        userId: 'farmer-002',
        traceId: 'trace-0002',
      }),
      world.deps
    )

    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.value.status).toBe('answered')
    expect(b.value.status).toBe('escalated')
    expect(a.value.threadId).not.toBe(b.value.threadId)
  })
})
