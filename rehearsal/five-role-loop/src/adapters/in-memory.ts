import type { AuditEvent, Batch, Booking, Plot } from '../domain/types'

export interface Store {
  readonly plots: Map<string, Plot>
  readonly batches: Map<string, Batch>
  readonly bookings: Map<string, Booking>
  readonly audit: AuditEvent[]
}

export function createStore(): Store {
  return {
    plots: new Map(),
    batches: new Map(),
    bookings: new Map(),
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
