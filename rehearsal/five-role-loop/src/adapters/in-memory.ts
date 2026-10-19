import type { Alert, AuditEvent, Batch, Booking, Produce } from '../domain/types'

export interface KeeperInfo {
  readonly uid: string
  readonly villageId: string
}

export interface Store {
  readonly produces: Map<string, Produce>
  readonly batches: Map<string, Batch>
  readonly bookings: Map<string, Booking>
  readonly alerts: Map<string, Alert>
  readonly keepers: Map<string, KeeperInfo>
  readonly audit: AuditEvent[]
}

export function createStore(): Store {
  return {
    produces: new Map(),
    batches: new Map(),
    bookings: new Map(),
    alerts: new Map(),
    keepers: new Map(),
    audit: [],
  }
}

export class FixedClock {
  private tick = 0

  nowIso(): string {
    return new Date(Date.UTC(2026, 9, 19, 0, 0, this.tick++)).toISOString()
  }
}

export class SeqIds {
  private seq = 0

  next(prefix = 'id'): string {
    return `${prefix}-${++this.seq}`
  }
}
