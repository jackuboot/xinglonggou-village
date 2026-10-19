import type { AuditEvent, AuditLog } from '../ports/audit-log'

export class InMemoryAuditLog implements AuditLog {
  private readonly events: AuditEvent[] = []

  async append(event: AuditEvent): Promise<void> {
    this.events.push(event)
  }

  async all(): Promise<readonly AuditEvent[]> {
    return [...this.events]
  }
}
