export type DomainErrorCode =
  | 'PLOT_INVALID_INPUT'
  | 'PLOT_FORBIDDEN'
  | 'PLOT_NOT_FOUND'
  | 'PLOT_INVALID_STATUS'
  | 'PLOT_REJECT_REASON_REQUIRED'
  | 'PLOT_VERSION_CONFLICT'

export interface DomainError {
  readonly code: DomainErrorCode
  readonly message: string
  readonly retryable: boolean
}

export const domainError = (
  code: DomainErrorCode,
  message: string,
  retryable = false
): DomainError => ({ code, message, retryable })
