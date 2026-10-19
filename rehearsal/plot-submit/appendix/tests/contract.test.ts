import { describe, expect, it } from 'vitest'
import { ReviewPlotInput, SubmitPlotInput } from '../src/domain/plot'
import { validSubmitInput } from './helpers'

describe('契约测试（schema 即规格）', () => {
  it('SubmitPlotInput 接受合法输入', () => {
    const parsed = SubmitPlotInput.safeParse(validSubmitInput())
    expect(parsed.success).toBe(true)
  })

  it('SubmitPlotInput 拒绝缺少幂等键的输入', () => {
    const input = validSubmitInput()
    delete (input as { idempotencyKey?: string }).idempotencyKey
    const parsed = SubmitPlotInput.safeParse(input)
    expect(parsed.success).toBe(false)
  })

  it('ReviewPlotInput 拒绝空角色与未知字段', () => {
    const base = {
      actorUid: 'keeper-001',
      actorRoles: [],
      actorVillageId: 'village-xinglonggou',
      plotId: 'plot-1',
      decision: 'approve',
      expectedVersion: 1,
    }
    expect(ReviewPlotInput.safeParse(base).success).toBe(false)
    expect(
      ReviewPlotInput.safeParse({ ...base, actorRoles: ['keeper'], x: 1 })
        .success
    ).toBe(false)
  })
})
