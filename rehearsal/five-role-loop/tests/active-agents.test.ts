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
  Plot,
} from '../src/domain/types'
import { makeWorld } from './helpers'

function value<T>(result: Result<T, DomainError>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  return result.value
}

async function seedLoop(options: { seedKeeper?: boolean } = {}) {
  const world = makeWorld(options)
  const { gateway, actors } = world

  const plot = value(
    (await gateway.invoke(actors.farmer, 'plot.submit', {
      groupName: '3组',
      areaMu: 5,
      crop: '茶',
    })) as Result<Plot, DomainError>
  )
  value(
    (await gateway.invoke(actors.keeper, 'plot.review', {
      plotId: plot.id,
      decision: 'approve',
    })) as Result<Plot, DomainError>
  )
  const batch = value(
    (await gateway.invoke(actors.keeper, 'batch.create', {
      plotId: plot.id,
      productName: '高山云雾茶',
    })) as Result<Batch, DomainError>
  )
  const booking = value(
    (await gateway.invoke(actors.consumer, 'booking.create', {
      batchId: batch.id,
    })) as Result<Booking, DomainError>
  )
  return { world, plot, batch, booking }
}

describe('主动 Agent：审核、预警、调度', () => {
  it('审核 Agent 只给建议，不改变地块状态；人工确认后才生效', async () => {
    const { world, plot } = await seedLoop({ seedKeeper: true })
    // 新提交一块待审地块
    const pending = value(
      (await world.gateway.invoke(world.actors.farmer, 'plot.submit', {
        groupName: '4组',
        areaMu: 8,
        crop: '茶',
      })) as Result<Plot, DomainError>
    )

    const suggestion = value(
      await runReviewAgent(world.actors.keeper, pending.id, world.gateway)
    )
    expect(suggestion.recommendation).toBe('approve')
    expect(suggestion.requiresHumanDecision).toBe(true)

    const stillPending = [...world.store.plots.values()].find(
      (item) => item.id === pending.id
    )
    expect(stillPending?.status).toBe('submitted')

    value(
      (await world.gateway.invoke(world.actors.keeper, 'plot.review', {
        plotId: pending.id,
        decision: 'approve',
      })) as Result<Plot, DomainError>
    )

    const suggested = world.store.audit.find(
      (event) => event.type === 'review.suggested'
    )
    expect(suggested?.payload.agentId).toBe('review-agent')
    const reviewed = [...world.store.plots.values()].find(
      (item) => item.id === plot.id
    )
    expect(reviewed?.status).toBe('active')
  })

  it('审核 Agent 对异常面积给出驳回建议', async () => {
    const world = makeWorld()
    const plot = value(
      (await world.gateway.invoke(world.actors.farmer, 'plot.submit', {
        groupName: '5组',
        areaMu: 80,
        crop: '茶',
      })) as Result<Plot, DomainError>
    )

    const suggestion = value(
      await runReviewAgent(world.actors.keeper, plot.id, world.gateway)
    )
    expect(suggestion.recommendation).toBe('reject')
    expect(suggestion.confidence).toBeLessThan(1)
    expect(suggestion.reasons[0]).toContain('面积')
  })

  it('预警哨兵主动扫描并去重；审计员可确认告警', async () => {
    const world = makeWorld()
    const plot = value(
      (await world.gateway.invoke(world.actors.farmer, 'plot.submit', {
        groupName: '6组',
        areaMu: 5,
        crop: '茶',
      })) as Result<Plot, DomainError>
    )

    const first = value(await runAlertSentinel(world.actors.admin, world.gateway))
    expect(first.created.length).toBeGreaterThan(0)
    expect(
      world.store.alerts.size
    ).toBeGreaterThan(0)

    const second = value(await runAlertSentinel(world.actors.admin, world.gateway))
    expect(second.created.length).toBe(0)

    const alerts = value(
      (await world.gateway.invoke(world.actors.auditor, 'alert.list', {})) as Result<
        Alert[],
        DomainError
      >
    )
    const alert = alerts.find((item) => item.targetId === plot.id)
    expect(alert).toBeDefined()
    if (!alert) return

    const acked = value(
      (await world.gateway.invoke(world.actors.auditor, 'alert.ack', {
        alertId: alert.id,
      })) as Result<Alert, DomainError>
    )
    expect(acked.status).toBe('acknowledged')
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
