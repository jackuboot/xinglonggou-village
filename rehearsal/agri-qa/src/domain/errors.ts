export type DomainErrorCode =
  | 'AGRI_INVALID_INPUT'
  | 'AGRI_TOOL_DENIED'
  | 'AGRI_PLOT_NOT_FOUND'
  | 'AGRI_NO_CITATION'
  | 'AGRI_LOW_CONFIDENCE'
  | 'AGRI_MODEL_FAILED'

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
