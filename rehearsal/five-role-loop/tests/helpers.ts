import { createStore, FixedClock, SeqIds } from '../src/adapters/in-memory'
import { createRoleGateway } from '../src/application/role-gateway'
import type { Actor } from '../src/domain/types'

export function makeWorld() {
  const store = createStore()
  const clock = new FixedClock()
  const ids = new SeqIds()
  const gateway = createRoleGateway({ store, clock, ids })

  const farmer: Actor = {
    uid: 'farmer-001',
    name: '李桂芳',
    roles: ['farmer'],
    villageId: 'village-xinglonggou',
  }
  const keeper: Actor = {
    uid: 'keeper-001',
    name: '王入库',
    roles: ['keeper'],
    villageId: 'village-xinglonggou',
  }
  const keeperOther: Actor = {
    uid: 'keeper-002',
    name: '外村入库员',
    roles: ['keeper'],
    villageId: 'village-other',
  }
  const consumer: Actor = {
    uid: 'consumer-001',
    name: '张顾客',
    roles: ['consumer'],
    villageId: 'village-city',
  }
  const auditor: Actor = {
    uid: 'auditor-001',
    name: '赵审计',
    roles: ['auditor'],
    villageId: 'village-county',
  }
  const admin: Actor = {
    uid: 'admin-001',
    name: '孙管理员',
    roles: ['admin'],
    villageId: 'village-xinglonggou',
  }

  return {
    store,
    gateway,
    actors: { farmer, keeper, keeperOther, consumer, auditor, admin },
  }
}
