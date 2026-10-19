export type DomainErrorCode =
  | 'AUTH_DENIED'
  | 'INPUT_INVALID'
  | 'PLOT_NOT_FOUND'
  | 'PLOT_INVALID_STATUS'
  | 'BATCH_NOT_FOUND'
  | 'VILLAGE_DENIED'

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
