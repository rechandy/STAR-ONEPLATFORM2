export interface BackoffConfig {
  baseMs: number;
  maxMs: number;
  /** after this many attempts a record is parked as needs_attention. */
  maxAttempts: number;
}

export const DEFAULT_BACKOFF: BackoffConfig = { baseMs: 1000, maxMs: 300_000, maxAttempts: 8 };

/** Full-jitter exponential backoff: random(0, min(max, base*2^attempt)). */
export function computeBackoff(
  attempt: number,
  cfg: BackoffConfig = DEFAULT_BACKOFF,
  rand: () => number = Math.random,
): number {
  const ceiling = Math.min(cfg.maxMs, cfg.baseMs * 2 ** attempt);
  return Math.floor(rand() * ceiling);
}

export type ErrorClass = 'retryable' | 'fatal' | 'auth';

/** Classify an HTTP status for retry decisions (see protocol §7.1). */
export function classifyStatus(status: number): ErrorClass {
  if (status === 401) return 'auth';
  if (status === 429 || status >= 500) return 'retryable';
  if (status >= 400) return 'fatal';
  return 'retryable';
}
