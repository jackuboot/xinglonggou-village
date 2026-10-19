import { createStore, FixedClock, SeqIds } from './adapters/in-memory'
import { createRoleGateway } from './application/role-gateway'
import { askRoleAssistant } from './application/assistant'
import type { Actor, Batch, Plot } from './domain/types'
import type { Result } from './domain/result'
import type { DomainError } from './domain/errors'

const store = createStore()
const gateway = createRoleGateway({
  store,
  clock: new FixedClock(),
  ids: new SeqIds(),
})

const farmer: Actor = { uid: 'farmer-001', name: '李桂芳', roles: ['farmer'], villageId: 'village-xinglonggou' }
const keeper: Actor = { uid: 'keeper-001', name: '王入库', roles: ['keeper'], villageId: 'village-xinglonggou' }
const consumer: Actor = { uid: 'consumer-001', name: '张顾客', roles: ['consumer'], villageId: 'village-city' }
const auditor: Actor = { uid: 'auditor-001', name: '赵审计', roles: ['auditor'], villageId: 'village-county' }
const admin: Actor = { uid: 'admin-001', name: '孙管理员', roles: ['admin'], villageId: 'village-xinglonggou' }

function value<T>(result: Result<T, DomainError>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  return result.value
}

const plot = value(
  (await gateway.invoke(farmer, 'plot.submit', {
    groupName: '3组',
    areaMu: 5,
    crop: '茶',
  })) as Result<Plot, DomainError>
)
const reviewed = value(
  (await gateway.invoke(keeper, 'plot.review', {
    plotId: plot.id,
    decision: 'approve',
  })) as Result<Plot, DomainError>
)
const batch = value(
  (await gateway.invoke(keeper, 'batch.create', {
    plotId: plot.id,
    productName: '高山云雾茶',
  })) as Result<Batch, DomainError>
)
const booking = value(
  (await gateway.invoke(consumer, 'booking.create', { batchId: batch.id })) as Result<
    unknown,
    DomainError
  >
)
const audit = value(
  (await gateway.invoke(auditor, 'audit.query', {})) as Result<unknown[], DomainError>
)
const status = value(
  (await gateway.invoke(admin, 'system.status', {})) as Result<unknown, DomainError>
)

console.log('plot:', reviewed.status)
console.log('batch:', batch.status)
console.log('booking:', booking)
console.log('audit events:', audit.length)
console.log('system status:', status)

for (const actor of [farmer, keeper, consumer, auditor, admin]) {
  const reply = await askRoleAssistant(actor, '请介绍当前情况', gateway)
  console.log(`${actor.name}:`, reply.ok ? reply.value.answer : reply.error.code)
}
