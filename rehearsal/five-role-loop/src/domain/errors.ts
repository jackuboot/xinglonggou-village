export type DomainErrorCode =
  | 'AUTH_DENIED'
  | 'INPUT_INVALID'
  | 'PRODUCE_NOT_FOUND'
  | 'PRODUCE_INVALID_STATUS'
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
