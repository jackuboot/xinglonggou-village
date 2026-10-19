import { describe, expect, it } from 'vitest'
import { submitPlot } from '../src/application/submit-plot'
import { makeDeps, validSubmitInput } from './helpers'

describe('submitPlot（业务目标：农户提交地块）', () => {
  it('合法输入 → 状态 submitted，版本 1，写一条审计', async () => {
    const deps = makeDeps()
    const result = await submitPlot(validSubmitInput(), deps)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.status).toBe('submitted')
    expect(result.value.version).toBe(1)
    expect(result.value.ownerUid).toBe('farmer-001')

    const events = await deps.audit.all()
    expect(events).toHaveLength(1)
    expect(events[0]?.type).toBe('plot.submitted')
    expect(events[0]?.traceId).toBe('trace-001')
  })

  it('面积为 0 → 拒绝并返回 PLOT_INVALID_INPUT', async () => {
    const deps = makeDeps()
    const result = await submitPlot(validSubmitInput({ areaMu: 0 }), deps)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PLOT_INVALID_INPUT')
    expect(await deps.audit.all()).toHaveLength(0)
  })

  it('未知字段 → 严格 schema 拒绝', async () => {
    const deps = makeDeps()
    const result = await submitPlot(
      validSubmitInput({ unexpected: 'x' }),
      deps
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PLOT_INVALID_INPUT')
  })

  it('幂等重放 → 返回同一地块，只写一条审计', async () => {
    const deps = makeDeps()
    const input = validSubmitInput()

    const first = await submitPlot(input, deps)
    const second = await submitPlot(input, deps)

    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(second.value.id).toBe(first.value.id)
    expect(await deps.audit.all()).toHaveLength(1)
  })
})
