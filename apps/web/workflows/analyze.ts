import { getWritable } from "workflow";
import type { InputComment, RunParams, T3CReport } from "@broadlistening/schema";
import { createLLMClient } from "@broadlistening/llm";
import { runPipeline, type ProgressEvent, type RunState } from "@broadlistening/pipeline";

/**
 * Hosted analysis run (architecture §6): the durable workflow wraps the shared
 * pipeline, one stage per step, so a crash/deploy resumes at the last completed
 * stage without re-paying LLM calls. Progress events stream to the run's
 * default stream as NDJSON.
 */

export interface AnalyzeResult {
  report: T3CReport;
  failures: { commentId: string; code: string; message: string }[];
  usage: RunState["usage"];
}

export async function analyzeWorkflow(
  comments: InputComment[],
  params: RunParams,
): Promise<AnalyzeResult> {
  "use workflow";
  const afterExtract = await runStage(comments, params, undefined, "extract");
  const afterAssign = await runStage(comments, params, afterExtract, "assign");
  const afterConsolidate = await runStage(comments, params, afterAssign, "consolidate");
  const result = await finalStage(comments, params, afterConsolidate);
  await emitDone(result);
  return result;
}

const WEB_CONCURRENCY = 4;

function makeProgressWriter() {
  const writer = getWritable().getWriter();
  return {
    emit: (e: ProgressEvent | { type: "done"; topics: number; failures: number }) =>
      writer.write(JSON.stringify(e) + "\n").catch(() => {}),
    release: () => writer.releaseLock(),
  };
}

async function runStage(
  comments: InputComment[],
  params: RunParams,
  state: RunState | undefined,
  stopAfter: "extract" | "assign" | "consolidate",
): Promise<RunState> {
  "use step";
  console.log(`[analyze] stage start: ${stopAfter} (${comments.length} comments)`);
  const { emit, release } = makeProgressWriter();
  try {
    const client = createLLMClient({ apiKey: process.env.OPENROUTER_API_KEY });
    const result = await runPipeline({
      client,
      comments,
      params,
      state,
      concurrency: WEB_CONCURRENCY,
      stopAfter,
      onProgress: emit,
    });
    console.log(`[analyze] stage done: ${stopAfter}`);
    return result.state;
  } finally {
    release();
  }
}

async function finalStage(
  comments: InputComment[],
  params: RunParams,
  state: RunState,
): Promise<AnalyzeResult> {
  "use step";
  console.log("[analyze] final stage start (consolidate remainder + assemble)");
  const { emit, release } = makeProgressWriter();
  try {
    const client = createLLMClient({ apiKey: process.env.OPENROUTER_API_KEY });
    const result = await runPipeline({
      client,
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

async function emitDone(result: AnalyzeResult): Promise<void> {
  "use step";
  console.log("[analyze] emitting done event");
  const { emit, release } = makeProgressWriter();
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
