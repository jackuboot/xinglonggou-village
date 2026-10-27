import { describe, expect, it } from 'vitest'
import {
  runAlertSentinel,
  runDispatcher,
  runReviewAgent,
} from '../src/application/active-agents'
import type { Result } from '../src/domain/result'
import type { DomainError } from '../src/domain/errors'
import type {
  Alert,
  Batch,
  Booking,
  Produce,
} from '../src/domain/types'
import { makeWorld } from './helpers'

function value<T>(result: Result<T, DomainError>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  return result.value
}

async function seedLoop(options: { seedKeeper?: boolean } = {}) {
  const world = makeWorld(options)
  const { gateway, actors } = world

  const produce = value(
    (await gateway.invoke(actors.farmer, 'produce.submit', {
      groupName: '3组',
      vegetableName: '时令蔬菜',
      quantityKg: 120,
      harvestDate: '2026-10-18',
    })) as Result<Produce, DomainError>
  )
  value(
    (await gateway.invoke(actors.keeper, 'produce.review', {
      produceId: produce.id,
      decision: 'approve',
    })) as Result<Produce, DomainError>
  )
  const batch = value(
    (await gateway.invoke(actors.keeper, 'batch.create', {
      produceId: produce.id,
      productName: '时令蔬菜',
    })) as Result<Batch, DomainError>
  )
  const booking = value(
    (await gateway.invoke(actors.consumer, 'booking.create', {
      batchId: batch.id,
    })) as Result<Booking, DomainError>
  )
  return { world, produce, batch, booking }
}

describe('主动 Agent：审核、预警、调度', () => {
  it('审核 Agent 只给建议，不改变蔬菜批次状态；人工确认后才生效', async () => {
    const { world, produce } = await seedLoop({ seedKeeper: true })
    // 新提交一批待审蔬菜
    const pending = value(
      (await world.gateway.invoke(world.actors.farmer, 'produce.submit', {
        groupName: '4组',
        vegetableName: '时令蔬菜',
        quantityKg: 80,
        harvestDate: '2026-10-18',
      })) as Result<Produce, DomainError>
    )

    const suggestion = value(
      await runReviewAgent(world.actors.keeper, pending.id, world.gateway)
    )
    expect(suggestion.recommendation).toBe('approve')
    expect(suggestion.requiresHumanDecision).toBe(true)

    const stillPending = [...world.store.produces.values()].find(
      (item) => item.id === pending.id
    )
    expect(stillPending?.status).toBe('submitted')

    value(
      (await world.gateway.invoke(world.actors.keeper, 'produce.review', {
        produceId: pending.id,
        decision: 'approve',
      })) as Result<Produce, DomainError>
    )

    const suggested = world.store.audit.find(
      (event) => event.type === 'review.suggested'
    )
    expect(suggested?.payload.agentId).toBe('review-agent')
    const reviewed = [...world.store.produces.values()].find(
      (item) => item.id === produce.id
    )
    expect(reviewed?.status).toBe('active')
  })

  it('审核 Agent 对异常面积给出驳回建议', async () => {
    const world = makeWorld()
    const produce = value(
      (await world.gateway.invoke(world.actors.farmer, 'produce.submit', {
        groupName: '5组',
        vegetableName: '时令蔬菜',
        quantityKg: 800,
        harvestDate: '2026-10-18',
      })) as Result<Produce, DomainError>
    )

    const suggestion = value(
      await runReviewAgent(world.actors.keeper, produce.id, world.gateway)
    )
    expect(suggestion.recommendation).toBe('reject')
    expect(suggestion.confidence).toBeLessThan(1)
    expect(suggestion.reasons[0]).toContain('数量')
  })

  it('预警哨兵按时间窗扫描并去重；审计员可确认告警', async () => {
    const world = makeWorld()
    const produce = value(
      (await world.gateway.invoke(world.actors.farmer, 'produce.submit', {
        groupName: '6组',
        vegetableName: '时令蔬菜',
        quantityKg: 120,
        harvestDate: '2026-10-18',
      })) as Result<Produce, DomainError>
    )

    const asOf = '2026-10-19T03:00:00.000Z'
    const first = value(
      await runAlertSentinel(world.actors.admin, world.gateway, asOf)
    )
    expect(first.created.length).toBeGreaterThan(0)
    expect(world.store.alerts.size).toBeGreaterThan(0)

    const second = value(
      await runAlertSentinel(world.actors.admin, world.gateway, asOf)
    )
    expect(second.created.length).toBe(0)

    const alerts = value(
      (await world.gateway.invoke(world.actors.auditor, 'alert.list', {})) as Result<
        Alert[],
        DomainError
      >
    )
    const alert = alerts.find((item) => item.targetId === produce.id)
    expect(alert).toBeDefined()
    if (!alert) return

    const acked = value(
      (await world.gateway.invoke(world.actors.auditor, 'alert.ack', {
        alertId: alert.id,
      })) as Result<Alert, DomainError>
    )
    expect(acked.status).toBe('acknowledged')
  })

  it('上架不足 24 小时不报滞销；超时升级，订单出现后自动解除', async () => {
    const world = makeWorld()
    const produce = value(
      (await world.gateway.invoke(world.actors.farmer, 'produce.submit', {
        groupName: '6组',
        vegetableName: '土豆',
        quantityKg: 200,
        harvestDate: '2026-10-18',
      })) as Result<Produce, DomainError>
    )
    value(
      (await world.gateway.invoke(world.actors.keeper, 'produce.review', {
        produceId: produce.id,
        decision: 'approve',
      })) as Result<Produce, DomainError>
    )
    const batch = value(
      (await world.gateway.invoke(world.actors.keeper, 'batch.create', {
        produceId: produce.id,
        productName: '土豆',
      })) as Result<Batch, DomainError>
    )

    const early = value(
      await runAlertSentinel(
        world.actors.admin,
        world.gateway,
        '2026-10-19T00:30:00.000Z'
      )
    )
    expect(early.created.length).toBe(0)

    const warning = value(
      await runAlertSentinel(
        world.actors.admin,
        world.gateway,
        '2026-10-20T01:00:00.000Z'
      )
    )
    const unsold = warning.created.find(
      (item) => (item as Alert).type === 'unsold_batch'
    ) as Alert | undefined
    expect(unsold).toBeDefined()
    if (!unsold) return
    expect(unsold.severity).toBe('warn')
    expect(unsold.ageMinutes).toBeGreaterThanOrEqual(1440)
    expect(unsold.thresholdMinutes).toBe(1440)

    const critical = value(
      await runAlertSentinel(
        world.actors.admin,
        world.gateway,
        '2026-10-22T01:00:00.000Z'
      )
    )
    const escalated = (critical.escalated || []).find(
      (item) => (item as { alert: Alert }).alert.type === 'unsold_batch'
    ) as { to: string } | undefined
    expect(escalated?.to).toBe('critical')

    value(
      (await world.gateway.invoke(world.actors.consumer, 'booking.create', {
        batchId: batch.id,
      })) as Result<Booking, DomainError>
    )
    const resolved = value(
      await runAlertSentinel(
        world.actors.admin,
        world.gateway,
        '2026-10-22T01:10:00.000Z'
      )
    )
    expect(
      (resolved.resolved || []).some(
        (item) => (item as Alert).type === 'unsold_batch'
      )
    ).toBe(true)
  })

  it('调度 Agent 只给建议；人工确认后才写入 assignedTo', async () => {
    const { world, booking } = await seedLoop()

    const suggestion = value(
      await runDispatcher(world.actors.keeper, booking.id, world.gateway)
    )
    expect(suggestion.assigneeUid).toBe('keeper-001')
    expect(suggestion.requiresHumanDecision).toBe(true)

    const before = [...world.store.bookings.values()].find(
      (item) => item.id === booking.id
    )
    expect(before?.assignedTo).toBeUndefined()

    const assigned = value(
      (await world.gateway.invoke(world.actors.keeper, 'dispatch.assign', {
        bookingId: booking.id,
        assigneeUid: suggestion.assigneeUid,
      })) as Result<Booking, DomainError>
    )
    expect(assigned.assignedTo).toBe('keeper-001')

    const suggested = world.store.audit.find(
      (event) => event.type === 'dispatch.suggested'
    )
    expect(suggested?.payload.agentId).toBe('dispatcher')
  })

  it('无可用入库员时，调度 Agent 返回空建议，不能强行派单', async () => {
    const { world, booking } = await seedLoop({ seedKeeper: false })

    const suggestion = value(
      await runDispatcher(world.actors.keeper, booking.id, world.gateway)
    )
    expect(suggestion.assigneeUid).toBeNull()
    expect(suggestion.confidence).toBe(0)

    const assign = await world.gateway.invoke(
      world.actors.keeper,
      'dispatch.assign',
      { bookingId: booking.id, assigneeUid: 'keeper-001' }
    )
    expect(assign.ok).toBe(false)
  })
})
