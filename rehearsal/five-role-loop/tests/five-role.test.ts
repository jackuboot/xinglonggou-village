import { describe, expect, it } from 'vitest'
import { askRoleAssistant } from '../src/application/assistant'
import type { Result } from '../src/domain/result'
import type { DomainError } from '../src/domain/errors'
import type { Batch, Booking, Plot, TraceView } from '../src/domain/types'
import { makeWorld } from './helpers'

function value<T>(result: Result<T, DomainError>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  return result.value
}

async function runLoop() {
  const world = makeWorld()
  const { gateway, actors } = world

  const plot = value(
    await gateway.invoke(actors.farmer, 'plot.submit', {
      groupName: '3组',
      areaMu: 5,
      crop: '茶',
    }) as Result<Plot, DomainError>
  )

  const reviewed = value(
    await gateway.invoke(actors.keeper, 'plot.review', {
      plotId: plot.id,
      decision: 'approve',
    }) as Result<Plot, DomainError>
  )

  const batch = value(
    await gateway.invoke(actors.keeper, 'batch.create', {
      plotId: plot.id,
      productName: '高山云雾茶',
    }) as Result<Batch, DomainError>
  )

  const trace = value(
    await gateway.invoke(actors.consumer, 'trace.query', {
      batchId: batch.id,
    }) as Result<TraceView, DomainError>
  )

  const booking = value(
    await gateway.invoke(actors.consumer, 'booking.create', {
      batchId: batch.id,
    }) as Result<Booking, DomainError>
  )

  return { world, plot, reviewed, batch, trace, booking }
}

describe('五角色最小闭环', () => {
  it('农户→入库员→消费者→审计员→管理员完整走通', async () => {
    const { world, plot, reviewed, batch, trace, booking } = await runLoop()
    const { gateway, actors, store } = world

    expect(plot.status).toBe('submitted')
    expect(reviewed.status).toBe('active')
    expect(batch.status).toBe('available')
    expect(trace.productName).toBe('高山云雾茶')
    expect(booking.status).toBe('booked')

    const audit = value(
      (await gateway.invoke(actors.auditor, 'audit.query', {})) as Result<
        unknown[],
        DomainError
      >
    )
    expect(audit.length).toBeGreaterThanOrEqual(4)

    const status = value(
      (await gateway.invoke(actors.admin, 'system.status', {})) as Result<
        { plots: number; batches: number; bookings: number },
        DomainError
      >
    )
    expect(status.plots).toBe(1)
    expect(status.batches).toBe(1)
    expect(status.bookings).toBe(1)
    expect(store.audit.some((event) => event.type === 'plot.approved')).toBe(true)
  })

  it('公开溯源不暴露 ownerUid', async () => {
    const { trace } = await runLoop()
    expect(trace).not.toHaveProperty('ownerUid')
  })

  it('角色越权被拒并写入审计', async () => {
    const { world } = await runLoop()
    const { gateway, actors } = world

    const farmerReview = await gateway.invoke(actors.farmer, 'plot.review', {
      plotId: 'plot-1',
      decision: 'approve',
    })
    expect(farmerReview.ok).toBe(false)
    if (farmerReview.ok) return
    expect(farmerReview.error.code).toBe('AUTH_DENIED')

    const consumerBatch = await gateway.invoke(actors.consumer, 'batch.create', {
      plotId: 'plot-1',
      productName: 'x',
    })
    expect(consumerBatch.ok).toBe(false)

    const keeperAudit = await gateway.invoke(actors.keeper, 'audit.query', {})
    expect(keeperAudit.ok).toBe(false)

    const denied = world.store.audit.filter(
      (event) => event.type === 'access.denied'
    )
    expect(denied.length).toBeGreaterThanOrEqual(3)
  })

  it('外村入库员不能审核或建批次（ABAC 村范围）', async () => {
    const { world } = await runLoop()
    const { gateway, actors } = world

    const plot = [...world.store.plots.values()][0]
    expect(plot).toBeDefined()
    if (!plot) return

    const review = await gateway.invoke(actors.keeperOther, 'plot.review', {
      plotId: plot.id,
      decision: 'approve',
    })
    expect(review.ok).toBe(false)
    if (review.ok) return
    expect(review.error.code).toBe('VILLAGE_DENIED')

    const batch = await gateway.invoke(actors.keeperOther, 'batch.create', {
      plotId: plot.id,
      productName: 'x',
    })
    expect(batch.ok).toBe(false)
    if (batch.ok) return
    expect(batch.error.code).toBe('VILLAGE_DENIED')
  })

  it('五角色助手各用自己的工具范围回答', async () => {
    const { world } = await runLoop()
    const { gateway, actors } = world

    const farmer = await askRoleAssistant(actors.farmer, '我有哪些地块', gateway)
    expect(farmer.ok).toBe(true)
    if (farmer.ok) expect(farmer.value.answer).toContain('1 块地块')

    const keeper = await askRoleAssistant(actors.keeper, '本村批次', gateway)
    expect(keeper.ok).toBe(true)
    if (keeper.ok) expect(keeper.value.answer).toContain('1 个可售批次')

    const consumer = await askRoleAssistant(actors.consumer, '有哪些溯源', gateway)
    expect(consumer.ok).toBe(true)
    if (consumer.ok) expect(consumer.value.answer).toContain('1 个可溯源批次')

    const auditor = await askRoleAssistant(actors.auditor, '审计情况', gateway)
    expect(auditor.ok).toBe(true)
    if (auditor.ok) expect(auditor.value.answer).toContain('条审计事件')

    const admin = await askRoleAssistant(actors.admin, '系统状态', gateway)
    expect(admin.ok).toBe(true)
    if (admin.ok) expect(admin.value.answer).toContain('系统当前统计')
  })

  it('输入校验：面积 0 被拒绝', async () => {
    const { gateway, actors } = makeWorld()
    const result = await gateway.invoke(actors.farmer, 'plot.submit', {
      groupName: '3组',
      areaMu: 0,
      crop: '茶',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('INPUT_INVALID')
  })
})
