export interface AuditEvent {
  readonly eventId: string
  readonly type: 'plot.submitted' | 'plot.approved' | 'plot.rejected'
  readonly occurredAt: string
  readonly actorUid: string
  readonly traceId: string
  readonly payload: Readonly<Record<string, unknown>>
}

export interface AuditLog {
  append(event: AuditEvent): Promise<void>
  all(): Promise<readonly AuditEvent[]>
}

export interface Clock {
  nowIso(): string
}

export interface IdGenerator {
  next(): string
}
