import { describe, expect, it } from 'vitest'
import { prefillPlotFromTranscript } from '../src/application/prefill-plot'

describe('prefillPlotFromTranscript（AI 工具：只建议，不落库）', () => {
  it('从 "3组 5.5亩茶" 抽取面积、作物、组名', () => {
    const result = prefillPlotFromTranscript({
      transcript: '我家在3组，有5.5亩茶',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.areaMu).toBe(5.5)
    expect(result.value.crop).toBe('茶')
    expect(result.value.groupName).toBe('3组')
    expect(result.value.confidence).toBe(1)
    expect(result.value.needsConfirmation).toBe(true)
  })

  it('信息不足 → 低置信度，仍需人工确认', () => {
    const result = prefillPlotFromTranscript({ transcript: '我不太清楚' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.confidence).toBe(0)
    expect(result.value.needsConfirmation).toBe(true)
    expect(result.value.areaMu).toBeUndefined()
  })

  it('空转写 → PLOT_INVALID_INPUT', () => {
    const result = prefillPlotFromTranscript({ transcript: '' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PLOT_INVALID_INPUT')
  })
})
