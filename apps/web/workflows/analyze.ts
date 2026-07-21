import { getWritable } from "workflow";
import type { InputComment, RunParams, T3CReport } from "@broadlistening/schema";
import { createLLMClient, detectLanguage } from "@broadlistening/llm";
import {
  createRunState,
  extractCommentsBatch,
  runPipeline,
  type CommentExtraction,
  type ProgressEvent,
  type RunState,
} from "@broadlistening/pipeline";

/**
 * Hosted analysis run (architecture §6): durable workflow around the shared
 * pipeline. Extraction runs as one step per 20-comment batch — the retry unit,
 * the crash-resume unit, AND the progress-flush unit (the workflow stream
 * delivers writes to readers at step boundaries).
 */

export interface AnalyzeResult {
  report: T3CReport;
  failures: { commentId: string; code: string; message: string }[];
  usage: RunState["usage"];
}

const WEB_CONCURRENCY = 4;
const BATCH_SIZE = 20;

export async function analyzeWorkflow(
  comments: InputComment[],
  params: RunParams,
): Promise<AnalyzeResult> {
  "use workflow";
  const lang = await prepareStep(comments, params);

  let extraction: Record<string, CommentExtraction> = {};
  let done = 0;
  let failed = 0;
  for (let i = 0; i < comments.length; i += BATCH_SIZE) {
    const batch = comments.slice(i, i + BATCH_SIZE);
    const res = await extractBatchStep(batch, lang, done, failed, comments.length);
    extraction = { ...extraction, ...res.extraction };
    done = res.done;
    failed = res.failed;
  }

  const midState = await organizeStep(comments, params, lang, extraction);
  const result = await finishStep(comments, params, midState);
  await emitDoneStep(result);
  return result;
}

function progressWriter() {
  const writer = getWritable().getWriter();
  return {
    emit: (e: ProgressEvent | { type: "done"; topics: number; failures: number }) =>
      writer.write(JSON.stringify(e) + "\n").catch(() => {}),
    release: () => writer.releaseLock(),
  };
}

function makeClient() {
  return createLLMClient({ apiKey: process.env.OPENROUTER_API_KEY });
}

async function prepareStep(comments: InputComment[], params: RunParams): Promise<string> {
  "use step";
  console.log(`[analyze] prepare: ${comments.length} comments, lang=${params.outputLanguage}`);
  const { emit, release } = progressWriter();
  try {
    await emit({ type: "stage", stage: "prepare" });
    let lang = params.outputLanguage;
    if (lang === "auto") {
      const r = await detectLanguage(makeClient(), comments.slice(0, 30).map((c) => c.text));
      lang = r.data;
    }
    await emit({ type: "language", language: lang });
    await emit({ type: "stage", stage: "extract" });
    return lang;
  } finally {
    release();
  }
}

async function extractBatchStep(
  batch: InputComment[],
  lang: string,
  doneSoFar: number,
  failedSoFar: number,
  total: number,
): Promise<{ extraction: Record<string, CommentExtraction>; done: number; failed: number }> {
  "use step";
  console.log(`[analyze] extract batch: ${batch.length} comments (${doneSoFar}/${total} done)`);
  const { emit, release } = progressWriter();
  let done = doneSoFar;
  let failed = failedSoFar;
  try {
    const res = await extractCommentsBatch(makeClient(), batch, lang, {
      concurrency: WEB_CONCURRENCY,
      onItem: (_id, ok) => {
        if (ok) done++;
        else failed++;
        void emit({ type: "extract", done, failed, total });
      },
    });
    return { extraction: res.extraction, done, failed };
  } finally {
    release();
  }
}

/** Taxonomy + assignment + consolidation (extraction already complete in state). */
async function organizeStep(
  comments: InputComment[],
  params: RunParams,
  lang: string,
  extraction: Record<string, CommentExtraction>,
): Promise<RunState> {
  "use step";
  console.log("[analyze] organize: taxonomy + assign + consolidate");
  const { emit, release } = progressWriter();
  try {
    const state = createRunState(comments, params);
    state.outputLanguage = lang;
    state.extraction = extraction;
    const result = await runPipeline({
      client: makeClient(),
      comments,
      params,
      state,
      concurrency: WEB_CONCURRENCY,
      stopAfter: "consolidate",
      onProgress: emit,
    });
    return result.state;
  } finally {
    release();
  }
}

async function finishStep(
  comments: InputComment[],
  params: RunParams,
  state: RunState,
): Promise<AnalyzeResult> {
  "use step";
  const { emit, release } = progressWriter();
  try {
    const result = await runPipeline({
      client: makeClient(),
      comments,
      params,
      state,
      concurrency: WEB_CONCURRENCY,
      onProgress: emit,
    });
    if (!result.report) throw new Error("pipeline finished without a report");
    console.log(
      `[analyze] report assembled: ${result.report.data[1].topics.length} topics, ${result.failures.length} failed comments`,
    );
    return { report: result.report, failures: result.failures, usage: result.state.usage };
  } finally {
    release();
  }
}

async function emitDoneStep(result: AnalyzeResult): Promise<void> {
  "use step";
  console.log("[analyze] emitting done event");
  const { emit, release } = progressWriter();
  try {
    await emit({
      type: "done",
      topics: result.report.data[1].topics.length,
      failures: result.failures.length,
    });
  } finally {
    release();
  }
}
