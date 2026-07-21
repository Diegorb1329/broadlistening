import { classifyError, PipelineError, type ClassifiedError } from "./errors.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RetryOptions {
  /** Max attempts for RETRYABLE errors (rate limits get one extra). Default 3. */
  maxAttempts?: number;
  /** Base backoff in ms (exponential + full jitter). Default 2000. */
  baseDelayMs?: number;
  onRetry?: (info: { attempt: number; delayMs: number; error: ClassifiedError }) => void;
}

/**
 * The only retry loop in the system (architecture §8).
 * RETRYABLE → exponential backoff + full jitter, honoring Retry-After; capped attempts.
 * Everything else → throws PipelineError immediately for the caller to handle
 * (MALFORMED repair passes live at the call site because they need prompt feedback).
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const base = opts.baseDelayMs ?? 2000;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt++;
    try {
      return await fn();
    } catch (err) {
      const classified = err instanceof PipelineError ? err.classified : classifyError(err);
      if (classified.cls !== "RETRYABLE") throw new PipelineError(classified);
      const cap = classified.code === "rate_limited" ? maxAttempts + 1 : maxAttempts;
      if (attempt >= cap) throw new PipelineError(classified);
      const backoff = base * 2 ** (attempt - 1);
      const delayMs = classified.retryAfterMs ?? Math.random() * backoff;
      opts.onRetry?.({ attempt, delayMs, error: classified });
      await sleep(delayMs);
    }
  }
}

/** Simple promise-pool: run tasks with bounded concurrency, preserving order of results. */
export async function pooled<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]!, i);
    }
  });
  await Promise.all(lanes);
  return results;
}
