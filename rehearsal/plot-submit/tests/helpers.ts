import { InMemoryAuditLog } from '../src/adapters/in-memory-audit-log'
import { InMemoryPlotRepository } from '../src/adapters/in-memory-plot-repository'

export function makeDeps() {
  const repo = new InMemoryPlotRepository()
  const audit = new InMemoryAuditLog()
  let idSeq = 0
  let timeSeq = 0

  return {
    repo,
    audit,
    clock: {
      nowIso: () =>
        new Date(Date.UTC(2026, 9, 19, 0, 0, timeSeq++)).toISOString(),
    },
    ids: {
      next: () => `id-${++idSeq}`,
    },
  }
}

export function validSubmitInput(overrides: Record<string, unknown> = {}) {
  return {
    actorUid: 'farmer-001',
    villageId: 'village-xinglonggou',
    groupName: '3组',
    areaMu: 5.5,
    crop: '茶',
    idempotencyKey: 'submit-plot-0001',
    traceId: 'trace-001',
    ...overrides,
  }
}
