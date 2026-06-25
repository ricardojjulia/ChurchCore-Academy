export class LmsRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LmsRetryableError';
  }
}

export class LmsCircuitOpenError extends Error {
  constructor() {
    super('LMS temporarily unavailable');
    this.name = 'LmsCircuitOpenError';
  }
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Response) {
    return error.status >= 500 && error.status < 600;
  }
  if (error instanceof Error && error.name === 'LmsCircuitOpenError') {
    return false;
  }
  if (error instanceof Error && error.name === 'LmsProviderError') {
    return (error as { retryable?: boolean }).retryable === true;
  }
  return error instanceof Error;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 2000,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error)) {
        throw error;
      }

      if (attempt < maxRetries) {
        const baseDelay = backoffMs * Math.pow(2, attempt);
        const jitter = Math.random() * 500;
        const delay = baseDelay + jitter;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new LmsRetryableError(
    `Operation failed after ${maxRetries + 1} attempts: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`
  );
}
