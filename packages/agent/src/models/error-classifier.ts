import { ProviderError } from '@peep/shared';
import type { AIError } from '@peep/shared';

export function classifyProviderError(
  raw: unknown,
  statusCode?: number,
): ProviderError {
  if (raw instanceof ProviderError) {
    return raw;
  }

  let code = 'GATEWAY_ERROR';
  let message = 'Unknown provider error';
  let status = statusCode;

  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as any;
    if (obj.code) code = obj.code;
    if (obj.message) message = obj.message;
    if (obj.status) status = obj.status;
  } else if (raw instanceof Error) {
    message = raw.message;
  } else if (typeof raw === 'string') {
    message = raw;
  }

  // Handle plain Error objects that contain HTTP status codes in their messages (like Gemini throws)
  if (!statusCode && raw instanceof Error) {
    const match = raw.message.match(/error:?\s*(\d{3})/i) || raw.message.match(/status:?\s*(\d{3})/i);
    if (match) {
      status = parseInt(match[1], 10);
    }
  }

  // Infer code from status if we don't have a specific code yet
  if (code === 'GATEWAY_ERROR' && status) {
    if (status === 401) code = 'UNAUTHORIZED';
    else if (status === 403) code = 'FORBIDDEN';
    else if (status === 429) code = 'RATE_LIMIT_EXCEEDED';
    else if (status === 400) code = 'VALIDATION_ERROR';
    else if (status === 502 || status === 503) code = 'GATEWAY_UNAVAILABLE';
  }

  // Or infer from message string matching for edge cases
  const lowerMsg = message.toLowerCase();
  if (code === 'GATEWAY_ERROR') {
    if (lowerMsg.includes('fetch failed') || lowerMsg.includes('network')) {
      code = 'NETWORK_FAILURE';
    } else if (lowerMsg.includes('429') || lowerMsg.includes('rate limit') || lowerMsg.includes('quota')) {
      code = 'RATE_LIMIT_EXCEEDED';
    } else if (lowerMsg.includes('401') || lowerMsg.includes('unauthorized')) {
      code = 'UNAUTHORIZED';
    } else if (lowerMsg.includes('budget')) {
      code = 'BUDGET_EXCEEDED';
    } else if (lowerMsg.includes('provider_error') || lowerMsg.includes('downstream')) {
      code = 'PROVIDER_ERROR';
    }
  }

  // Determine retryability based on code
  let retryable = false;
  let retryAfterMs: number | undefined;

  switch (code) {
    case 'NETWORK_FAILURE':
      retryable = true;
      retryAfterMs = 2000;
      break;
    case 'RATE_LIMIT_EXCEEDED':
      retryable = true;
      retryAfterMs = 5000;
      break;
    case 'GATEWAY_UNAVAILABLE':
      retryable = true;
      retryAfterMs = 3000;
      break;
    case 'PROVIDER_ERROR':
      retryable = true;
      retryAfterMs = 2000;
      break;
    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
    case 'BUDGET_EXCEEDED':
    case 'VALIDATION_ERROR':
    case 'GATEWAY_ERROR':
      retryable = false;
      break;
  }

  // Handle AbortError specifically (never retryable)
  if (raw instanceof Error && raw.name === 'AbortError') {
    code = 'CANCELLED';
    message = 'Request aborted';
    retryable = false;
  } else if (message.includes('aborted') || message === 'Cancelled') {
    code = 'CANCELLED';
    retryable = false;
  }

  const aiError: AIError = { code, message, status };
  return new ProviderError({ ...aiError, retryable, retryAfterMs });
}
