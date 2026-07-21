"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  detectMapping,
  parseCommentsCsv,
  type CsvMapping,
  type CsvParseResult,
} from "@broadlistening/pipeline/csv";
import type { ProgressEvent } from "@broadlistening/pipeline/state";
import { viewerUrl } from "@/lib/viewer";

const MAX_WEB_COMMENTS = 200;
const NONE = "__none__";

type Phase =
  | { kind: "upload" }
  | { kind: "configure"; fileName: string; csvText: string; parsed: CsvParseResult; mapping: CsvMapping }
  | { kind: "running"; runId: string }
  | { kind: "done"; runId: string; topics: number; failures: number }
  | { kind: "error"; message: string };

interface SessionInfo {
  authenticated: boolean;
  did?: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
}

interface PublishResult {
  atUri: string;
  blobUrl?: string;
  viewerPath?: string;
}

interface StageProgress {
  stage: string;
  extractDone: number;
  extractFailed: number;
  extractTotal: number;
  warnings: string[];
}

const STAGES = ["prepare", "extract", "taxonomy", "assign", "consolidate", "assemble"] as const;
const STAGE_LABELS: Record<string, string> = {
  prepare: "Preparing",
  extract: "Extracting claims",
  taxonomy: "Building topic map",
  assign: "Organizing claims",
  consolidate: "Consolidating duplicates",
  assemble: "Assembling report",
};

export default function Studio() {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "upload" });
  const [progress, setProgress] = useState<StageProgress>({
    stage: "prepare",
    extractDone: 0,
    extractFailed: 0,
    extractTotal: 0,
    warnings: [],
  });
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("auto");
  const [lens, setLens] = useState("");
  const [truncateConsent, setTruncateConsent] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<PublishResult | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void fetch("/api/auth/session")
      .then((r) => r.json())
      .then(setSession)
      .catch(() => setSession({ authenticated: false }));
  }, []);

  const onFile = useCallback(async (file: File) => {
    const csvText = await file.text();
    const probe = parseCommentsCsv(csvText, { textColumn: NONE });
    const mapping = detectMapping(probe.columns) ?? { textColumn: probe.columns[0] ?? "" };
    const parsed = parseCommentsCsv(csvText, mapping);
    setTitle(file.name.replace(/\.csv$/i, "").replace(/[-_]+/g, " "));
    setPhase({ kind: "configure", fileName: file.name, csvText, parsed, mapping });
  }, []);

  const remap = useCallback(
    (csvText: string, fileName: string, mapping: CsvMapping) => {
      const parsed = parseCommentsCsv(csvText, mapping);
      setPhase({ kind: "configure", fileName, csvText, parsed, mapping });
    },
    [],
  );

  const streamProgress = useCallback(async (runId: string) => {
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const res = await fetch(`/api/runs/${runId}/events`, { signal: abort.signal });
      if (!res.ok || !res.body) throw new Error(`event stream failed (HTTP ${res.status})`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let event: ProgressEvent | { type: "done"; topics: number; failures: number };
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }
          if (event.type === "done") {
            setPhase({ kind: "done", runId, topics: event.topics, failures: event.failures });
            return;
          }
          setProgress((p) => applyEvent(p, event as ProgressEvent));
        }
      }
      const status = await fetch(`/api/runs/${runId}`).then((r) => r.json());
      if (status.status === "completed") {
        setPhase({ kind: "done", runId, topics: 0, failures: 0 });
      } else {
        setPhase({ kind: "error", message: `Run ended with status: ${status.status}` });
      }
    } catch (err) {
      if (!abort.signal.aborted)
        setPhase({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const run = useCallback(async () => {
    if (phase.kind !== "configure") return;
    const comments = phase.parsed.comments.slice(0, MAX_WEB_COMMENTS);
    setProgress({ stage: "prepare", extractDone: 0, extractFailed: 0, extractTotal: comments.length, warnings: [] });
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comments,
          params: {
            title: title.trim() || phase.fileName,
            description: "",
            outputLanguage: language,
            customInstructions: lens.trim(),
          },
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        throw new Error(body.detail ?? body.error ?? `HTTP ${res.status}`);
      }
      const { runId } = (await res.json()) as { runId: string };
      setPhase({ kind: "running", runId });
      void streamProgress(runId);
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [phase, title, language, lens, streamProgress]);

  const cancel = useCallback(async (runId: string) => {
    abortRef.current?.abort();
    await fetch(`/api/runs/${runId}/cancel`, { method: "POST" }).catch(() => {});
    setPhase({ kind: "upload" });
  }, []);

  const publish = useCallback(async (runId: string) => {
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setPublished(body as PublishResult);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
    }
  }, []);

  // Viewing is delegated to broadlistening.org — this app doesn't duplicate the viewer.
  const viewReport = useCallback((runId: string) => {
    const url = `${window.location.origin}/api/runs/${runId}/report`;
    window.open(viewerUrl(url), "_blank", "noopener");
  }, []);

  const downloadReport = useCallback(async (runId: string) => {
    const res = await fetch(`/api/runs/${runId}/report`);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "broadlistening-report.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    setSession({ authenticated: false });
    setPhase({ kind: "upload" });
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="kicker mb-3">Broad Listening · Studio</p>
      <h1 className="font-serif text-4xl leading-tight mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
        Turn comments into an <span className="brand-italic">explorable</span> topic map
      </h1>
      <p className="mb-10" style={{ color: "var(--body)" }}>
        Upload a CSV of comments. Claims are extracted, organized into topics, and
        assembled into a report you can explore, download, and publish to the
        AT&nbsp;Protocol network.
      </p>

      {/* Login gate — the first thing users see */}
      {session === null && (
        <div className="card-editorial py-10 text-center">
          <p className="kicker">Loading session…</p>
        </div>
      )}

      {session !== null && !session.authenticated && <LoginHero />}

      {session?.authenticated && (
        <>
          <SessionStrip session={session} onLogout={logout} />

          {phase.kind === "upload" && <UploadZone onFile={onFile} />}

          {phase.kind === "configure" && (
            <ConfigurePanel
              phase={phase}
              title={title}
              setTitle={setTitle}
              language={language}
              setLanguage={setLanguage}
              lens={lens}
              setLens={setLens}
              truncateConsent={truncateConsent}
              setTruncateConsent={setTruncateConsent}
              onMapping={(m) => remap(phase.csvText, phase.fileName, m)}
              onRun={run}
              onBack={() => setPhase({ kind: "upload" })}
            />
          )}

          {phase.kind === "running" && (
            <RunningPanel progress={progress} onCancel={() => cancel(phase.runId)} />
          )}

          {phase.kind === "done" && (
            <div className="card-editorial">
              <p className="kicker mb-4">Analysis complete</p>
              <div className="flex gap-10 mb-6">
                <div className="stat-column">
                  <div className="stat-num">{phase.topics || "—"}</div>
                  <div className="stat-label">Topics</div>
                </div>
                <div className="stat-column">
                  <div className="stat-num">{progress.extractTotal}</div>
                  <div className="stat-label">Comments</div>
                </div>
                {phase.failures > 0 && (
                  <div className="stat-column">
                    <div className="stat-num" style={{ color: "var(--signal)" }}>{phase.failures}</div>
                    <div className="stat-label">Failed</div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-editorial btn-editorial-primary px-4 py-2" onClick={() => viewReport(phase.runId)}>
                  View report
                </button>
                <button type="button" className="btn-editorial px-4 py-2" onClick={() => downloadReport(phase.runId)}>
                  Download JSON
                </button>
                <button
                  type="button"
                  className="btn-editorial px-4 py-2"
                  onClick={() => {
                    setPublished(null);
                    setPublishError(null);
                    setPhase({ kind: "upload" });
                  }}
                >
                  New analysis
                </button>
              </div>

              <div className="mt-8 border-t pt-6" style={{ borderColor: "var(--hairline)" }}>
                {published ? (
                  <div>
                    <p className="kicker mb-2">Published to the network</p>
                    <p className="text-sm break-all mb-3" style={{ color: "var(--body)" }}>{published.atUri}</p>
                    <div className="flex flex-wrap gap-3">
                      {published.blobUrl && (
                        <a
                          className="btn-editorial px-4 py-2"
                          href={viewerUrl(published.blobUrl)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View published report
                        </a>
                      )}
                      <button type="button" className="btn-editorial px-4 py-2" onClick={() => router.push("/analyses")}>
                        See all analyses
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm mb-3" style={{ color: "var(--body)" }}>
                      Publishing places this report <strong>permanently and publicly</strong> in
                      your AT&nbsp;Protocol repository as <span style={{ color: "var(--brand)" }}>@{session.handle}</span>.
                    </p>
                    {publishError && (
                      <p className="text-sm mb-3" style={{ color: "var(--signal)" }}>{publishError}</p>
                    )}
                    <button
                      type="button"
                      className="btn-editorial btn-editorial-primary px-4 py-2"
                      disabled={publishing}
                      onClick={() => publish(phase.runId)}
                    >
                      {publishing ? "Publishing…" : "Publish to ATProto"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {phase.kind === "error" && (
            <div className="card-editorial" style={{ borderLeft: "3px solid var(--signal)" }}>
              <p className="kicker mb-2" style={{ color: "var(--signal)" }}>Something went wrong</p>
              <p className="mb-4" style={{ color: "var(--body)" }}>{phase.message}</p>
              <button type="button" className="btn-editorial px-4 py-2" onClick={() => setPhase({ kind: "upload" })}>
                Start over
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LoginHero() {
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, returnTo: "/" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      window.location.href = body.redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }, [handle]);

  return (
    <div className="card-editorial">
      <p className="kicker mb-3">Step 1 · Sign in</p>
      <p className="font-serif text-xl mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
        Sign in with your Bluesky account to begin
      </p>
      <p className="text-sm mb-5" style={{ color: "var(--body)" }}>
        Your analyses are yours: reports you publish live in your own AT&nbsp;Protocol
        repository, not on our servers. No password is shared with this site — you
        authenticate directly with your identity provider.
      </p>
      {error && <p className="text-sm mb-3" style={{ color: "var(--signal)" }}>{error}</p>}
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (handle.trim()) void login();
        }}
      >
        <input
          className="border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
          style={{ borderColor: "var(--hairline)", color: "var(--ink)", minWidth: "16rem" }}
          placeholder="your-handle.bsky.social"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          autoComplete="username"
        />
        <button type="submit" className="btn-editorial btn-editorial-primary px-4 py-2" disabled={busy || !handle.trim()}>
          {busy ? "Redirecting…" : "Sign in with Bluesky"}
        </button>
      </form>
      <p className="text-xs mt-4" style={{ color: "var(--muted-ink)" }}>
        No account? Create one at bsky.app — any AT&nbsp;Protocol identity works.
      </p>
    </div>
  );
}

function SessionStrip({ session, onLogout }: { session: SessionInfo; onLogout: () => void }) {
  return (
    <div className="mb-6 flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--hairline)" }}>
      <div className="flex items-center gap-3">
        {session.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.avatar} alt="" className="h-7 w-7" style={{ borderRadius: 0 }} />
        ) : (
          <span className="inline-block h-7 w-7" style={{ background: "var(--brand-soft)" }} />
        )}
        <span className="text-sm" style={{ color: "var(--body)" }}>
          {session.displayName || session.handle}{" "}
          <span style={{ color: "var(--muted-ink)" }}>@{session.handle}</span>
        </span>
      </div>
      <button type="button" className="kicker-muted hover:text-[var(--ink)]" onClick={onLogout}>
        Sign out
      </button>
    </div>
  );
}

function applyEvent(p: StageProgress, e: ProgressEvent): StageProgress {
  switch (e.type) {
    case "stage":
      return { ...p, stage: e.stage };
    case "extract":
      return { ...p, extractDone: e.done, extractFailed: e.failed, extractTotal: e.total };
    case "warning":
      return { ...p, warnings: [...p.warnings.slice(-4), e.message] };
    default:
      return p;
  }
}

function UploadZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      className="card-editorial block cursor-pointer text-center py-16 transition-colors"
      style={{ borderStyle: "dashed", borderColor: dragging ? "var(--brand)" : "var(--hairline)" }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
    >
      <input
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <p className="kicker mb-3">Step 2 · Upload</p>
      <p className="font-serif text-xl mb-1" style={{ fontFamily: "var(--font-playfair)" }}>
        Drop a CSV here, or click to browse
      </p>
      <p className="text-sm" style={{ color: "var(--muted-ink)" }}>
        One comment per row · up to {MAX_WEB_COMMENTS} comments per hosted run ·{" "}
        <a
          className="underline hover:text-[var(--brand)]"
          href="https://github.com/Diegorb1329/broadlistening/blob/main/examples/sample-20.csv"
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          example CSV
        </a>
      </p>
    </label>
  );
}

function ConfigurePanel(props: {
  phase: Extract<Phase, { kind: "configure" }>;
  title: string;
  setTitle: (v: string) => void;
  language: string;
  setLanguage: (v: string) => void;
  lens: string;
  setLens: (v: string) => void;
  truncateConsent: boolean;
  setTruncateConsent: (v: boolean) => void;
  onMapping: (m: CsvMapping) => void;
  onRun: () => void;
  onBack: () => void;
}) {
  const { phase, title, setTitle, language, setLanguage, lens, setLens, truncateConsent, setTruncateConsent, onMapping, onRun, onBack } = props;
  const total = phase.parsed.comments.length;
  const overCap = total > MAX_WEB_COMMENTS;
  const canRun = total > 0 && (!overCap || truncateConsent);
  const inputCls = "w-full border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--brand)]";
  const inputStyle = { borderColor: "var(--hairline)", color: "var(--ink)" } as const;
  const m = phase.mapping;

  const optionalSelect = (
    id: string,
    label: string,
    value: string | undefined,
    set: (v: string | undefined) => void,
  ) => (
    <div>
      <label className="kicker-muted block mb-1" htmlFor={id}>{label}</label>
      <select
        id={id}
        className={inputCls}
        style={inputStyle}
        value={value ?? NONE}
        onChange={(e) => set(e.target.value === NONE ? undefined : e.target.value)}
      >
        <option value={NONE}>—</option>
        {phase.parsed.columns.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="card-editorial">
      <p className="kicker mb-4">Step 3 · Configure</p>
      <div className="mb-5 flex gap-10">
        <div className="stat-column">
          <div className="stat-num">{total}</div>
          <div className="stat-label">Comments</div>
        </div>
        {phase.parsed.dropped.length > 0 && (
          <div className="stat-column">
            <div className="stat-num" style={{ color: "var(--muted-ink)" }}>{phase.parsed.dropped.length}</div>
            <div className="stat-label">Rows dropped</div>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="kicker-muted block mb-1" htmlFor="bl-col">Text column</label>
          <select
            id="bl-col"
            className={inputCls}
            style={inputStyle}
            value={m.textColumn}
            onChange={(e) => onMapping({ ...m, textColumn: e.target.value })}
          >
            {phase.parsed.columns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        {optionalSelect("bl-author", "Author column", m.authorColumn, (v) => onMapping({ ...m, authorColumn: v }))}
        {optionalSelect("bl-url", "Link column", m.urlColumn, (v) => onMapping({ ...m, urlColumn: v }))}
        {optionalSelect("bl-ts", "Timestamp column", m.timestampColumn, (v) => onMapping({ ...m, timestampColumn: v }))}
        <div>
          <label className="kicker-muted block mb-1" htmlFor="bl-lang">Report language</label>
          <select id="bl-lang" className={inputCls} style={inputStyle} value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="auto">Auto-detect</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="de">Deutsch</option>
            <option value="fr">Français</option>
            <option value="pt">Português</option>
            <option value="ja">日本語</option>
          </select>
        </div>
        <div>
          <label className="kicker-muted block mb-1" htmlFor="bl-title">Report title</label>
          <input id="bl-title" className={inputCls} style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="kicker-muted block mb-1" htmlFor="bl-lens">
            Analysis lens <span style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span>
          </label>
          <textarea
            id="bl-lens"
            className={inputCls}
            style={{ ...inputStyle, minHeight: "4.5rem", resize: "vertical" }}
            placeholder='Steer the analysis, e.g. "focus on economic arguments and concrete policy asks" — quotes stay verbatim and nothing is invented.'
            value={lens}
            onChange={(e) => setLens(e.target.value)}
            maxLength={2000}
          />
        </div>
      </div>

      {overCap && (
        <label className="mt-4 flex items-start gap-2 text-sm" style={{ color: "var(--body)" }}>
          <input
            type="checkbox"
            className="mt-1"
            checked={truncateConsent}
            onChange={(e) => setTruncateConsent(e.target.checked)}
          />
          <span>
            This file has <strong>{total}</strong> comments. The hosted run analyzes the{" "}
            <strong>first {MAX_WEB_COMMENTS}</strong>. For the full set, run it locally with the
            CLI (<code>npx broadlistening analyze</code>).
          </span>
        </label>
      )}

      <div className="mt-6 flex gap-3">
        <button type="button" className="btn-editorial btn-editorial-primary px-4 py-2" disabled={!canRun} onClick={onRun}>
          Run analysis
        </button>
        <button type="button" className="btn-editorial px-4 py-2" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}

function RunningPanel({ progress, onCancel }: { progress: StageProgress; onCancel: () => void }) {
  const stageIdx = Math.max(0, STAGES.indexOf(progress.stage as (typeof STAGES)[number]));
  const pct =
    progress.stage === "extract" && progress.extractTotal > 0
      ? Math.round((progress.extractDone / progress.extractTotal) * 100)
      : undefined;
  return (
    <div className="card-editorial" aria-live="polite">
      <p className="kicker mb-5">Running analysis</p>
      <ol className="space-y-3">
        {STAGES.map((s, i) => {
          const isDone = i < stageIdx;
          const isActive = i === stageIdx;
          return (
            <li key={s} className="flex items-center gap-3 text-sm">
              <span
                className="inline-block h-2 w-2"
                style={{
                  background: isDone ? "var(--brand)" : isActive ? "var(--signal)" : "var(--hairline)",
                }}
              />
              <span style={{ color: isActive ? "var(--ink)" : isDone ? "var(--body)" : "var(--faint-ink)" }}>
                {STAGE_LABELS[s]}
                {isActive && s === "extract" && progress.extractTotal > 0 && (
                  <>
                    {" "}
                    — {progress.extractDone}/{progress.extractTotal}
                    {progress.extractFailed > 0 && (
                      <span style={{ color: "var(--signal)" }}> ({progress.extractFailed} failed)</span>
                    )}
                  </>
                )}
                {isActive && pct !== undefined && ` · ${pct}%`}
              </span>
            </li>
          );
        })}
      </ol>
      {progress.warnings.length > 0 && (
        <p className="mt-4 text-xs" style={{ color: "var(--muted-ink)" }}>
          {progress.warnings.at(-1)}
        </p>
      )}
      <button type="button" className="btn-editorial mt-6 px-4 py-2" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
