import { describe, expect, it } from 'vitest'
import { askFarmQuestion } from '../src/application/ask-farm-question'
import { farmerInput, makeWorld } from './helpers'

describe('最小业务：农事问答（地块上下文 + RAG + 工具 + 人工升级）', () => {
  it('正常问题 → 回答带引用，记录 token，写完整监测事件', async () => {
    const world = makeWorld()
    const result = await askFarmQuestion(farmerInput(), world.deps)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.status).toBe('answered')
    expect(result.value.answer).toContain('3组')
    expect(result.value.citations.length).toBeGreaterThan(0)
    expect(result.value.tokensUsed).toBeGreaterThan(0)

    const events = await world.monitor.all()
    const types = events.map((event) => event.type)
    expect(types[0]).toBe('agent.task.received')
    expect(types).toContain('agent.tool.invoked')
    expect(types.at(-1)).toBe('agent.task.closed')
  })

  it('跨用户读取地块 → 拒绝并升级人工，不检索知识', async () => {
    const world = makeWorld()
    const result = await askFarmQuestion(
      farmerInput({ userId: 'farmer-002' }),
      world.deps
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.status).toBe('escalated')
    expect(result.value.escalationReason).toContain('AGRI_TOOL_DENIED')
    expect(world.knowledge.searchCalls).toBe(0)
  })

  it('知识库无命中 → 无引用，升级人工', async () => {
    const world = makeWorld()
    const result = await askFarmQuestion(
      farmerInput({ question: '这块地适合种什么果树？' }),
      world.deps
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.status).toBe('escalated')
    expect(result.value.escalationReason).toContain('AGRI_NO_CITATION')
  })

  it('病虫害置信度不足 → 升级人工', async () => {
    const world = makeWorld({ pestConfidence: 0.5 })
    const result = await askFarmQuestion(
      farmerInput({ question: '茶树上有很多虫怎么办？' }),
      world.deps
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.status).toBe('escalated')
    expect(result.value.escalationReason).toContain('AGRI_LOW_CONFIDENCE')
    expect(result.value.pest?.topConfidence).toBe(0.5)
  })

  it('模型失败 → 保留检查点；重试从断点继续，不重复查地块/知识', async () => {
    const world = makeWorld({ modelFailures: 1 })
    const input = farmerInput()

    const first = await askFarmQuestion(input, world.deps)
    expect(first.ok).toBe(false)
    if (first.ok) return
    expect(first.error.code).toBe('AGRI_MODEL_FAILED')

    const checkpoint = await world.checkpointer.load(input.threadId)
    expect(checkpoint?.status).toBe('pest_checked')

    const second = await askFarmQuestion(input, world.deps)
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.value.status).toBe('answered')
    expect(world.plots.getCalls).toBe(1)
    expect(world.knowledge.searchCalls).toBe(1)
    expect(world.pest.calls).toBe(1)
    expect(world.model.calls).toBe(2)
  })

  it('已完成会话重复调用 → 直接返回，不重复执行', async () => {
    const world = makeWorld()
    const input = farmerInput()

    const first = await askFarmQuestion(input, world.deps)
    const second = await askFarmQuestion(input, world.deps)

    expect(first.ok && second.ok).toBe(true)
    expect(world.knowledge.searchCalls).toBe(1)
    expect(world.model.calls).toBe(1)
  })

  it('空问题 → AGRI_INVALID_INPUT', async () => {
    const world = makeWorld()
    const result = await askFarmQuestion(farmerInput({ question: '' }), world.deps)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('AGRI_INVALID_INPUT')
  })
})
