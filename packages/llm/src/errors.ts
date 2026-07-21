import { APICallError, NoObjectGeneratedError, NoOutputGeneratedError, RetryError } from "ai";

/**
 * The single error-classification function of the system (architecture §8).
 * Every stage on web and CLI routes failures through this; nothing else retries.
 */
export type ErrorClass =
  | "RETRYABLE" // 429 / 5xx / network — retry with backoff
  | "MALFORMED" // output failed schema validation — one repair attempt, then fail item
  | "FATAL_RUN" // invalid key / quota exhausted — stop the whole run
  | "FATAL_COMMENT"; // content blocked — fail the item, never retry

export interface ClassifiedError {
  cls: ErrorClass;
  code: string;
  message: string;
  /** For RETRYABLE: server-requested delay (Retry-After), if any */
  retryAfterMs?: number;
  cause: unknown;
}

function parseRetryAfter(headers: Record<string, string> | undefined): number | undefined {
  const v = headers?.["retry-after"];
  if (!v) return undefined;
  const secs = Number(v);
  if (Number.isFinite(secs)) return Math.min(secs * 1000, 120_000);
  const at = Date.parse(v);
  return Number.isNaN(at) ? undefined : Math.max(0, Math.min(at - Date.now(), 120_000));
}

export function classifyError(err: unknown): ClassifiedError {
  // AI SDK wraps repeated failures in RetryError — classify the last underlying error.
  if (RetryError.isInstance(err)) {
    return classifyError(err.lastError ?? err.errors.at(-1) ?? err);
  }

  if (APICallError.isInstance(err)) {
    const status = err.statusCode;
    if (status === 401 || status === 403) {
      return { cls: "FATAL_RUN", code: "invalid_api_key", message: "The API key was rejected by the provider.", cause: err };
    }
    if (status === 402) {
      return { cls: "FATAL_RUN", code: "quota_exhausted", message: "The provider account has no remaining credit.", cause: err };
    }
    if (status === 429) {
      return {
        cls: "RETRYABLE",
        code: "rate_limited",
        message: "Rate limited by the provider.",
        retryAfterMs: parseRetryAfter(err.responseHeaders),
        cause: err,
      };
    }
    if (status !== undefined && status >= 400 && status < 500) {
      // Provider-reported content/safety blocks arrive as 4xx with descriptive bodies.
      const body = (err.responseBody ?? "").toLowerCase();
      if (body.includes("safety") || body.includes("blocked") || body.includes("moderation")) {
        return { cls: "FATAL_COMMENT", code: "content_blocked", message: "The provider refused this content.", cause: err };
      }
      return { cls: "MALFORMED", code: `provider_${status}`, message: err.message, cause: err };
    }
    // 5xx or unknown status (network-level)
    return { cls: "RETRYABLE", code: status ? `provider_${status}` : "network", message: err.message, cause: err };
  }

  if (NoObjectGeneratedError.isInstance(err) || NoOutputGeneratedError.isInstance(err)) {
    return { cls: "MALFORMED", code: "malformed_output", message: "Model output failed schema validation.", cause: err };
  }

  const message = err instanceof Error ? err.message : String(err);
  if (/fetch failed|network|ECONNRESET|ETIMEDOUT|ENOTFOUND|aborted/i.test(message)) {
    return { cls: "RETRYABLE", code: "network", message, cause: err };
  }
  return { cls: "MALFORMED", code: "unknown", message, cause: err };
}

/** Error carrying its classification across stage boundaries. */
export class PipelineError extends Error {
  readonly classified: ClassifiedError;
  constructor(classified: ClassifiedError) {
    super(classified.message);
    this.name = `PipelineError(${classified.cls}:${classified.code})`;
    this.classified = classified;
  }
}
