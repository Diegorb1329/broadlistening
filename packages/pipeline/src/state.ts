import type { InputComment, RunParams } from "@broadlistening/schema";
import type { TaxonomyOutput, Usage } from "@broadlistening/llm";

export type Stage = "prepare" | "extract" | "taxonomy" | "assign" | "consolidate" | "assemble" | "done";

export interface ExtractedClaim {
  id: string;
  title: string;
  quote: string;
}

export interface CommentExtraction {
  status: "pending" | "done" | "failed";
  lang?: string;
  claims?: ExtractedClaim[];
  errorCode?: string;
  errorMessage?: string;
  attempts: number;
}

/** Consolidated duplicate set: primary keeps its quote, members nest as similarClaims. */
export interface ConsolidatedGroup {
  primaryClaimId: string;
  memberClaimIds: string[];
  title: string;
}

export interface RunUsage {
  inputTokens: number;
  outputTokens: number;
  embeddingTokens: number;
}

export interface RunState {
  runId: string;
  params: RunParams;
  /** resolved output language (params.outputLanguage unless "auto") */
  outputLanguage?: string;
  comments: InputComment[];
  extraction: Record<string, CommentExtraction>;
  taxonomy?: TaxonomyOutput;
  /** claimId → "t.s" (0-based "1.0") or "other" */
  assignments?: Record<string, string>;
  consolidation?: ConsolidatedGroup[];
  usage: RunUsage;
  stage: Stage;
  startedAt: string;
}

export type ProgressEvent =
  | { type: "stage"; stage: Stage }
  | { type: "language"; language: string }
  | { type: "extract"; done: number; failed: number; total: number }
  | { type: "assign"; done: number; total: number }
  | { type: "consolidate"; candidateGroups: number; merged: number }
  | { type: "retry"; scope: string; attempt: number; delayMs: number; code: string }
  | { type: "warning"; message: string };

export function addUsage(state: RunState, usage: Usage, embedding = false): void {
  if (embedding) {
    state.usage.embeddingTokens += usage.inputTokens;
  } else {
    state.usage.inputTokens += usage.inputTokens;
    state.usage.outputTokens += usage.outputTokens;
  }
}

export function createRunState(comments: InputComment[], params: RunParams): RunState {
  return {
    runId: crypto.randomUUID(),
    params,
    comments,
    extraction: Object.fromEntries(
      comments.map((c) => [c.id, { status: "pending", attempts: 0 } satisfies CommentExtraction]),
    ),
    usage: { inputTokens: 0, outputTokens: 0, embeddingTokens: 0 },
    stage: "prepare",
    startedAt: new Date().toISOString(),
  };
}
