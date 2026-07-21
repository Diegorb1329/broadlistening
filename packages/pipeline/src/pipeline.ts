import type { InputComment, RunParams, T3CReport } from "@broadlistening/schema";
import {
  assignClaims,
  buildTaxonomy,
  detectLanguage,
  embedTexts,
  extractClaims,
  verifyDuplicateGroups,
  PipelineError,
  pooled,
  classifyError,
  type LLMClient,
} from "@broadlistening/llm";
import { findCandidateGroups } from "./similarity.js";
import { assembleReport } from "./report.js";
import {
  addUsage,
  createRunState,
  type ProgressEvent,
  type RunState,
} from "./state.js";

export interface PipelineOptions {
  client: LLMClient;
  comments: InputComment[];
  params: RunParams;
  /** Concurrent LLM calls (web: 4, local default: 8) */
  concurrency?: number;
  /** Resume from a previous state (CLI state file / web step boundary) */
  state?: RunState;
  /** Called after every batch so callers can persist state for resume */
  persist?: (state: RunState) => void | Promise<void>;
  onProgress?: (event: ProgressEvent) => void;
  /** Dedup blocking threshold (cosine) */
  dedupThreshold?: number;
  /**
   * Stop after this stage and return the partial state (no report yet).
   * Lets durable-workflow callers run one stage per step; re-invoking with the
   * returned state resumes exactly where it stopped.
   */
  stopAfter?: "extract" | "assign" | "consolidate";
}

export interface PipelineResult {
  /** Present only when the pipeline ran to completion (no stopAfter cut) */
  report?: T3CReport;
  state: RunState;
  failures: { commentId: string; code: string; message: string }[];
}

const RETRYABLE_CODES = new Set(["rate_limited", "network"]);
const isRetryableCode = (code?: string) =>
  !!code && (RETRYABLE_CODES.has(code) || code.startsWith("provider_5"));

/**
 * Extract claims for a batch of comments (per-comment failure isolation).
 * Used internally by runPipeline and directly by the web workflow, which runs
 * one durable step per batch so progress flushes at batch boundaries.
 * FATAL_RUN errors propagate; everything else lands on the returned entry.
 */
export async function extractCommentsBatch(
  client: LLMClient,
  comments: InputComment[],
  outputLanguage: string,
  opts: {
    concurrency?: number;
    /** existing entries (attempt counts carry over on retry passes) */
    existing?: Record<string, import("./state.js").CommentExtraction>;
    customInstructions?: string;
    onItem?: (commentId: string, ok: boolean) => void;
  } = {},
): Promise<{
  extraction: Record<string, import("./state.js").CommentExtraction>;
  usage: { inputTokens: number; outputTokens: number };
}> {
  const usage = { inputTokens: 0, outputTokens: 0 };
  const extraction: Record<string, import("./state.js").CommentExtraction> = {};
  await pooled(comments, opts.concurrency ?? 8, async (comment) => {
    const prev = opts.existing?.[comment.id];
    const entry: import("./state.js").CommentExtraction = {
      status: "pending",
      attempts: (prev?.attempts ?? 0) + 1,
    };
    try {
      const r = await extractClaims(client, comment.text, outputLanguage, opts.customInstructions);
      usage.inputTokens += r.usage.inputTokens;
      usage.outputTokens += r.usage.outputTokens;
      entry.status = "done";
      entry.lang = r.data.lang;
      // cardinality enforced in code, not JSON Schema (Gemini limitation)
      entry.claims = r.data.claims.slice(0, 5).map((c) => ({
        id: crypto.randomUUID(),
        title: c.title,
        quote: c.quote,
      }));
      opts.onItem?.(comment.id, true);
    } catch (err) {
      const cls = err instanceof PipelineError ? err.classified : classifyError(err);
      if (cls.cls === "FATAL_RUN") throw err;
      entry.status = "failed";
      entry.errorCode = cls.code;
      entry.errorMessage = cls.message.slice(0, 500);
      opts.onItem?.(comment.id, false);
    }
    extraction[comment.id] = entry;
  });
  return { extraction, usage };
}

/**
 * The five-stage pipeline (architecture §6). Identical on web and local:
 * web wraps stages in workflow steps via the exported stage functions;
 * the CLI calls runPipeline directly with a state file for resume.
 */
export async function runPipeline(opts: PipelineOptions): Promise<PipelineResult> {
  const { client, params } = opts;
  const concurrency = opts.concurrency ?? 8;
  const emit = opts.onProgress ?? (() => {});
  const persist = opts.persist ?? (() => {});

  const state = opts.state ?? createRunState(opts.comments, params);

  // ---- Stage 0: prepare (resolve output language) ----
  if (!state.outputLanguage) {
    state.stage = "prepare";
    emit({ type: "stage", stage: "prepare" });
    if (params.outputLanguage !== "auto") {
      state.outputLanguage = params.outputLanguage;
    } else {
      const sample = state.comments.slice(0, 30).map((c) => c.text);
      const r = await detectLanguage(client, sample);
      addUsage(state, r.usage);
      state.outputLanguage = r.data;
    }
    emit({ type: "language", language: state.outputLanguage });
    await persist(state);
  }
  const lang = state.outputLanguage;

  // ---- Stage 1: extract (per-comment failure isolation) ----
  state.stage = "extract";
  emit({ type: "stage", stage: "extract" });
  const extractPass = async (targets: InputComment[]) => {
    let done = Object.values(state.extraction).filter((e) => e.status === "done").length;
    let failed = Object.values(state.extraction).filter((e) => e.status === "failed").length;
    // Process in chunks of 20 so CLI state persists at a useful resume granularity
    for (let i = 0; i < targets.length; i += 20) {
      const chunk = targets.slice(i, i + 20);
      const res = await extractCommentsBatch(client, chunk, lang, {
        concurrency,
        existing: state.extraction,
        customInstructions: params.customInstructions,
        onItem: (_id, ok) => {
          if (ok) done++;
          else failed++;
          emit({ type: "extract", done, failed, total: state.comments.length });
        },
      });
      Object.assign(state.extraction, res.extraction);
      state.usage.inputTokens += res.usage.inputTokens;
      state.usage.outputTokens += res.usage.outputTokens;
      await persist(state);
    }
  };

  const pending = state.comments.filter((c) => state.extraction[c.id]?.status === "pending");
  await extractPass(pending);
  await persist(state);

  // One targeted second pass over retryable failures (poison cap: attempts < 3)
  const retryable = state.comments.filter((c) => {
    const e = state.extraction[c.id]!;
    return e.status === "failed" && isRetryableCode(e.errorCode) && e.attempts < 3;
  });
  if (retryable.length > 0) {
    emit({ type: "warning", message: `retrying ${retryable.length} failed comments` });
    await extractPass(retryable);
    await persist(state);
  }

  const failuresOf = (s: RunState) =>
    s.comments
      .filter((c) => s.extraction[c.id]?.status === "failed")
      .map((c) => ({
        commentId: c.id,
        code: s.extraction[c.id]!.errorCode ?? "unknown",
        message: s.extraction[c.id]!.errorMessage ?? "",
      }));

  if (opts.stopAfter === "extract") return { state, failures: failuresOf(state) };

  const allClaims: { id: string; title: string }[] = [];
  for (const c of state.comments) {
    const e = state.extraction[c.id];
    if (e?.status === "done" && e.claims)
      for (const claim of e.claims) allClaims.push({ id: claim.id, title: claim.title });
  }
  if (allClaims.length === 0) {
    throw new PipelineError({
      cls: "FATAL_RUN",
      code: "no_claims",
      message: "No claims could be extracted from the input comments.",
      cause: undefined,
    });
  }

  // ---- Stage 2: taxonomy (over claim titles, never raw comments) ----
  if (!state.taxonomy) {
    state.stage = "taxonomy";
    emit({ type: "stage", stage: "taxonomy" });
    const r = await buildTaxonomy(client, allClaims.map((c) => c.title), lang, params.customInstructions);
    addUsage(state, r.usage);
    // cardinality enforced in code (schema bounds break Gemini constrained decoding)
    const topics = r.data.topics
      .map((t) => ({ ...t, subtopics: t.subtopics.slice(0, 8) }))
      .filter((t) => t.subtopics.length > 0)
      .slice(0, 12);
    if (topics.length === 0) {
      throw new PipelineError({
        cls: "FATAL_RUN",
        code: "empty_taxonomy",
        message: "The model returned an empty topic map.",
        cause: undefined,
      });
    }
    state.taxonomy = { topics };
    await persist(state);
  }

  // ---- Stage 3: assign (batches of 50; unplaced → "other", never dropped) ----
  if (!state.assignments) {
    state.stage = "assign";
    emit({ type: "stage", stage: "assign" });
    const taxonomy = state.taxonomy;
    const valid = new Set<string>();
    taxonomy.topics.forEach((t, ti) =>
      t.subtopics.forEach((_, si) => valid.add(`${ti}.${si}`)),
    );
    const assignments: Record<string, string> = {};
    const batches: (typeof allClaims)[] = [];
    for (let i = 0; i < allClaims.length; i += 50) batches.push(allClaims.slice(i, i + 50));
    let doneBatches = 0;
    await pooled(batches, concurrency, async (batch) => {
      try {
        const r = await assignClaims(client, taxonomy, batch);
        addUsage(state, r.usage);
        const byId = new Map(r.data.assignments.map((a) => [a.claimId, a.subtopic]));
        for (const claim of batch) {
          const raw = byId.get(claim.id);
          // model labels are 1-based "T.S"; normalize to 0-based; anything invalid → other
          if (raw && raw !== "other") {
            const m = /^(\d+)\.(\d+)$/.exec(raw.trim());
            const label = m ? `${Number(m[1]) - 1}.${Number(m[2]) - 1}` : "";
            assignments[claim.id] = valid.has(label) ? label : "other";
          } else {
            assignments[claim.id] = "other";
          }
        }
      } catch (err) {
        const cls = err instanceof PipelineError ? err.classified : classifyError(err);
        if (cls.cls === "FATAL_RUN") throw err;
        // graceful degradation: whole batch → other (never dropped)
        for (const claim of batch) assignments[claim.id] = "other";
        emit({ type: "warning", message: `assignment batch failed (${cls.code}); ${batch.length} claims → Other` });
      }
      emit({ type: "assign", done: ++doneBatches * 50, total: allClaims.length });
    });
    state.assignments = assignments;
    await persist(state);
  }
  if (opts.stopAfter === "assign") return { state, failures: failuresOf(state) };

  // ---- Stage 4: consolidate (ephemeral embeddings → candidates → LLM verify; fail-open) ----
  if (!state.consolidation) {
    state.stage = "consolidate";
    emit({ type: "stage", stage: "consolidate" });
    try {
      state.consolidation = await consolidateClaims(state, client, allClaims, {
        concurrency,
        threshold: opts.dedupThreshold ?? 0.8,
        emit,
      });
    } catch (err) {
      const cls = err instanceof PipelineError ? err.classified : classifyError(err);
      if (cls.cls === "FATAL_RUN") throw err;
      emit({ type: "warning", message: `dedup skipped (${cls.code}); claims stay individual` });
      state.consolidation = [];
    }
    await persist(state);
  }
  if (opts.stopAfter === "consolidate") return { state, failures: failuresOf(state) };

  // ---- Stage 5: assemble (zod-validated) ----
  state.stage = "assemble";
  emit({ type: "stage", stage: "assemble" });
  const report = assembleReport(state);
  state.stage = "done";
  await persist(state);

  const failures = state.comments
    .filter((c) => state.extraction[c.id]?.status === "failed")
    .map((c) => ({
      commentId: c.id,
      code: state.extraction[c.id]!.errorCode ?? "unknown",
      message: state.extraction[c.id]!.errorMessage ?? "",
    }));

  return { report, state, failures };
}

async function consolidateClaims(
  state: RunState,
  client: LLMClient,
  allClaims: { id: string; title: string }[],
  opts: { concurrency: number; threshold: number; emit: (e: ProgressEvent) => void },
) {
  const assignments = state.assignments!;
  // Block within subtopic only: honest counts, no cross-topic merges (§6.4)
  const bySubtopic = new Map<string, { id: string; title: string }[]>();
  for (const claim of allClaims) {
    const label = assignments[claim.id] ?? "other";
    const list = bySubtopic.get(label);
    if (list) list.push(claim);
    else bySubtopic.set(label, [claim]);
  }

  // Ephemeral embeddings (never persisted) — one batch call over all titles
  const titles = allClaims.map((c) => c.title);
  const emb = await embedTexts(client, titles);
  addUsage(state, emb.usage, true);
  const embByClaim = new Map(allClaims.map((c, i) => [c.id, emb.data[i]!]));

  // Candidates per subtopic
  const candidates: { groupId: string; claims: { id: string; title: string }[] }[] = [];
  for (const [label, claims] of bySubtopic) {
    if (claims.length < 2) continue;
    const groups = findCandidateGroups(claims.map((c) => embByClaim.get(c.id)!), opts.threshold);
    groups.forEach((g, gi) => {
      candidates.push({
        groupId: `${label}-${gi}`,
        claims: g.members.map((m) => claims[m]!),
      });
    });
  }
  if (candidates.length === 0) {
    opts.emit({ type: "consolidate", candidateGroups: 0, merged: 0 });
    return [];
  }

  // LLM verification in batches of 20 groups; a failed batch fails open
  const consolidated: { primaryClaimId: string; memberClaimIds: string[]; title: string }[] = [];
  const batches: (typeof candidates)[] = [];
  for (let i = 0; i < candidates.length; i += 20) batches.push(candidates.slice(i, i + 20));
  await pooled(batches, opts.concurrency, async (batch) => {
    try {
      const r = await verifyDuplicateGroups(client, batch, state.outputLanguage!);
      addUsage(state, r.usage);
      const validIds = new Map(batch.flatMap((g) => g.claims.map((c) => [c.id, g.groupId] as const)));
      for (const group of r.data.groups) {
        for (const sub of group.subgroups) {
          const ids = sub.claimIds.filter((id) => validIds.has(id));
          if (ids.length < 2) continue; // singleton or hallucinated ids → no merge
          consolidated.push({
            primaryClaimId: ids[0]!,
            memberClaimIds: ids.slice(1),
            title: sub.title,
          });
        }
      }
    } catch (err) {
      const cls = err instanceof PipelineError ? err.classified : classifyError(err);
      if (cls.cls === "FATAL_RUN") throw err;
      opts.emit({ type: "warning", message: `dedup batch failed open (${cls.code})` });
    }
  });

  // A claim may appear in only one group (defensive: drop later conflicts)
  const claimed = new Set<string>();
  const unique = consolidated.filter((g) => {
    const all = [g.primaryClaimId, ...g.memberClaimIds];
    if (all.some((id) => claimed.has(id))) return false;
    all.forEach((id) => claimed.add(id));
    return true;
  });

  opts.emit({
    type: "consolidate",
    candidateGroups: candidates.length,
    merged: unique.reduce((n, g) => n + g.memberClaimIds.length, 0),
  });
  return unique;
}
