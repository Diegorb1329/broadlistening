#!/usr/bin/env tsx
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { Command } from "commander";
import { createLLMClient } from "@broadlistening/llm";
import {
  detectMapping,
  detectTextColumn,
  parseCommentsCsv,
  runPipeline,
  type ProgressEvent,
  type RunState,
} from "@broadlistening/pipeline";

const program = new Command()
  .name("broadlistening")
  .description("Broad Listening — turn comments into an explorable T3C topic map");

program
  .command("analyze")
  .argument("<csv>", "CSV file with comments")
  .option("--col-text <column>", "text column (auto-detected if omitted)")
  .option("--col-id <column>", "id column")
  .option("--col-author <column>", "author column")
  .option("--col-url <column>", "source URL column")
  .option("--col-timestamp <column>", "timestamp column")
  .option("--title <title>", "report title")
  .option("--description <desc>", "report description", "")
  .option("--language <lang>", "output language (ISO 639-1) or 'auto'", "auto")
  .option("--instructions <text>", "analyst lens: extra instructions for extraction/taxonomy", "")
  .option("--limit <n>", "analyze only the first N comments", (v) => parseInt(v, 10))
  .option("--concurrency <n>", "concurrent LLM calls", (v) => parseInt(v, 10), 8)
  .option("--out <file>", "output report path (default: <csv>.report.json)")
  .option("--json", "emit machine-readable progress events on stdout", false)
  .option("--no-resume", "ignore any existing state file and start fresh")
  .action(async (csvPath: string, opts) => {
    const file = resolve(csvPath);
    if (!existsSync(file)) fail(`File not found: ${file}`);
    const csvText = readFileSync(file, "utf8");

    const probe = parseCommentsCsv(csvText, { textColumn: "__none__" });
    const textColumn = opts.colText ?? detectTextColumn(probe.columns);
    if (!textColumn || !probe.columns.includes(textColumn)) {
      fail(
        `Could not find text column. Available columns: ${probe.columns.join(", ")}\n` +
          `Use --col-text <column>.`,
      );
    }

    const detected = detectMapping(probe.columns);
    const parsed = parseCommentsCsv(csvText, {
      textColumn: textColumn!,
      idColumn: opts.colId ?? detected?.idColumn,
      authorColumn: opts.colAuthor ?? detected?.authorColumn,
      urlColumn: opts.colUrl ?? detected?.urlColumn,
      timestampColumn: opts.colTimestamp ?? detected?.timestampColumn,
    });
    let comments = parsed.comments;
    if (opts.limit) comments = comments.slice(0, opts.limit);
    log(opts, `Parsed ${comments.length} comments (${parsed.dropped.length} rows dropped)`);
    for (const d of parsed.dropped.slice(0, 5)) log(opts, `  dropped row ${d.row}: ${d.reason}`);
    if (comments.length === 0) fail("No usable comments in the CSV.");

    const stateDir = join(process.cwd(), ".broadlistening");
    mkdirSync(stateDir, { recursive: true });
    const stateFile = join(stateDir, `${basename(file)}.state.json`);
    let state: RunState | undefined;
    if (opts.resume && existsSync(stateFile)) {
      try {
        const prev = JSON.parse(readFileSync(stateFile, "utf8")) as RunState;
        if (prev.stage !== "done" && prev.comments.length === comments.length) {
          state = prev;
          log(opts, `Resuming previous run from stage "${prev.stage}" (${stateFile})`);
        }
      } catch {
        /* corrupt state — start fresh */
      }
    }

    const client = createLLMClient({});
    const started = Date.now();
    try {
      const result = await runPipeline({
        client,
        comments,
        params: {
          title: opts.title ?? basename(file).replace(/\.csv$/i, ""),
          description: opts.description,
          outputLanguage: opts.language,
          customInstructions: opts.instructions,
        },
        concurrency: opts.concurrency,
        state,
        persist: (s) => writeFileSync(stateFile, JSON.stringify(s)),
        onProgress: (e) => progress(opts, e),
      });

      const report = result.report;
      if (!report) fail("Pipeline stopped before producing a report.");
      const out = resolve(opts.out ?? file.replace(/\.csv$/i, "") + ".report.json");
      writeFileSync(out, JSON.stringify(report, null, 2));
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      const u = result.state.usage;
      const [, data] = report.data;
      const claimCount = data.topics.reduce(
        (n, t) => n + t.subtopics.reduce((m, s) => m + s.claims.reduce((k, c) => k + 1 + c.similarClaims.length, 0), 0),
        0,
      );
      log(opts, `\nDone in ${secs}s — ${data.topics.length} topics, ${claimCount} claims`);
      log(opts, `Tokens: ${u.inputTokens} in / ${u.outputTokens} out / ${u.embeddingTokens} embed`);
      if (result.failures.length > 0) {
        log(opts, `Failed comments: ${result.failures.length}`);
        for (const f of result.failures.slice(0, 10)) log(opts, `  ${f.commentId}: ${f.code}`);
      }
      log(opts, `Report: ${out}`);
      log(opts, `View it: /dashboard?report=<hosted-url-of-this-file>`);
      if (opts.json) console.log(JSON.stringify({ type: "done", report: out, failures: result.failures.length }));
    } catch (err) {
      const e = err as Error & { classified?: { code: string; message: string } };
      if (e.classified) fail(`Run failed [${e.classified.code}]: ${e.classified.message}`);
      throw err;
    }
  });

function progress(opts: { json: boolean }, e: ProgressEvent): void {
  if (opts.json) {
    console.log(JSON.stringify(e));
    return;
  }
  switch (e.type) {
    case "stage":
      process.stderr.write(`\n▸ ${e.stage}\n`);
      break;
    case "language":
      process.stderr.write(`  output language: ${e.language}\n`);
      break;
    case "extract":
      process.stderr.write(`\r  ${e.done}/${e.total} extracted${e.failed ? ` (${e.failed} failed)` : ""}   `);
      break;
    case "assign":
      process.stderr.write(`\r  ~${Math.min(e.done, e.total)}/${e.total} assigned   `);
      break;
    case "consolidate":
      process.stderr.write(`  candidate groups: ${e.candidateGroups}, merged duplicates: ${e.merged}\n`);
      break;
    case "warning":
      process.stderr.write(`\n  ⚠ ${e.message}\n`);
      break;
  }
}

function log(opts: { json: boolean }, msg: string): void {
  if (!opts.json) process.stderr.write(msg + "\n");
}

function fail(msg: string): never {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(1);
}

program.parseAsync().catch((err) => {
  process.stderr.write(`Unexpected error: ${err?.stack ?? err}\n`);
  process.exit(1);
});
