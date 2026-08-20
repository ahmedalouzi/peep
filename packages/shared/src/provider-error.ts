import type { AIError } from './index';

export class ProviderError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;

  constructor(aiError: AIError & { retryable?: boolean; retryAfterMs?: number }) {
    super(aiError.message);
    this.name = 'ProviderError';
    this.code = aiError.code;
    this.status = aiError.status;
    this.retryable = aiError.retryable ?? false;
    this.retryAfterMs = aiError.retryAfterMs;
  }
}
