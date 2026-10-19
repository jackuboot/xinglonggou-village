import { describe, expect, it } from 'vitest'
import { submitPlot } from '../src/application/submit-plot'
import { reviewPlot } from '../src/application/review-plot'
import { makeDeps, validSubmitInput } from './helpers'

async function seedPlot() {
  const deps = makeDeps()
  const submitted = await submitPlot(validSubmitInput(), deps)
  if (!submitted.ok) throw new Error('seed failed')
  return { deps, plot: submitted.value }
}

function reviewInput(plotId: string, overrides: Record<string, unknown> = {}) {
  return {
    actorUid: 'keeper-001',
    actorRoles: ['keeper'],
    actorVillageId: 'village-xinglonggou',
    plotId,
    decision: 'approve',
    expectedVersion: 1,
    traceId: 'trace-review-001',
    ...overrides,
  }
}

describe('reviewPlot（业务目标：入库员审核，数据生效）', () => {
  it('本村入库员通过 → active，版本 +1，写审计', async () => {
    const { deps, plot } = await seedPlot()
    const result = await reviewPlot(reviewInput(plot.id), deps)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.status).toBe('active')
    expect(result.value.version).toBe(2)

    const events = await deps.audit.all()
    expect(events.at(-1)?.type).toBe('plot.approved')
  })

  it('农户审核 → PLOT_FORBIDDEN', async () => {
    const { deps, plot } = await seedPlot()
    const result = await reviewPlot(
      reviewInput(plot.id, { actorUid: 'farmer-001', actorRoles: ['farmer'] }),
      deps
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PLOT_FORBIDDEN')
  })

  it('外村入库员审核 → PLOT_FORBIDDEN（行级数据范围）', async () => {
    const { deps, plot } = await seedPlot()
    const result = await reviewPlot(
      reviewInput(plot.id, { actorVillageId: 'village-other' }),
      deps
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PLOT_FORBIDDEN')
  })

  it('驳回不填原因 → PLOT_REJECT_REASON_REQUIRED', async () => {
    const { deps, plot } = await seedPlot()
    const result = await reviewPlot(
      reviewInput(plot.id, { decision: 'reject' }),
      deps
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PLOT_REJECT_REASON_REQUIRED')
  })

  it('驳回并填原因 → rejected，审计保留原因', async () => {
    const { deps, plot } = await seedPlot()
    const result = await reviewPlot(
      reviewInput(plot.id, { decision: 'reject', reason: '面积与合同不符' }),
      deps
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.status).toBe('rejected')
    const events = await deps.audit.all()
    expect(events.at(-1)?.payload.reason).toBe('面积与合同不符')
  })

  it('版本号过期 → PLOT_VERSION_CONFLICT（并发保护）', async () => {
    const { deps, plot } = await seedPlot()
    const result = await reviewPlot(
      reviewInput(plot.id, { expectedVersion: 99 }),
      deps
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PLOT_VERSION_CONFLICT')
    expect(result.error.retryable).toBe(true)
  })

  it('已生效的地块不能重复审核 → PLOT_INVALID_STATUS', async () => {
    const { deps, plot } = await seedPlot()
    await reviewPlot(reviewInput(plot.id), deps)
    const result = await reviewPlot(
      reviewInput(plot.id, { expectedVersion: 2 }),
      deps
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PLOT_INVALID_STATUS')
  })
})
