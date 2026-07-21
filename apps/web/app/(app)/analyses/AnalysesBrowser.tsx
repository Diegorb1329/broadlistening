"use client";

import { useCallback, useEffect, useState } from "react";
import type { NetworkAnalysis } from "@/lib/network";
import { viewerUrl } from "@/lib/viewer";

/** Editorial accent palette for card top borders (rgb triplets). */
const ACCENTS = [
  "185 28 28", "194 65 12", "161 98 7", "77 124 15", "21 128 61",
  "15 118 110", "3 105 161", "29 78 216", "109 40 217", "162 28 175",
  "190 24 93", "87 83 78",
];

interface MyAnalysis {
  uri: string;
  value: {
    title?: string;
    description?: string;
    createdAt?: string;
    counts?: { comments: number; claims: number; topics: number };
    tool?: string;
    report?: { ref?: { $link?: string } };
  };
  blobUrl?: string;
}

type Tab = "feed" | "mine";

export default function AnalysesBrowser({ feed }: { feed: NetworkAnalysis[] }) {
  const [tab, setTab] = useState<Tab>("feed");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [did, setDid] = useState<string | null>(null);
  const [mine, setMine] = useState<MyAnalysis[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => setAuthenticated(!!s.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  const loadMine = useCallback(async () => {
    try {
      const res = await fetch("/api/me/analyses");
      if (res.status === 401) {
        setAuthenticated(false);
        return;
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setDid(body.did);
      // Resolve the caller's PDS blob URLs from the network feed when possible;
      // otherwise cards render without a view link.
      const feedByUri = new Map(feed.map((a) => [a.uri, a.blobUrl]));
      setMine(
        (body.analyses as MyAnalysis[]).map((a) => ({
          ...a,
          blobUrl: feedByUri.get(a.uri),
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [feed]);

  useEffect(() => {
    if (tab === "mine" && mine === null && authenticated) void loadMine();
  }, [tab, mine, authenticated, loadMine]);

  const remove = useCallback(
    async (uri: string) => {
      if (!window.confirm("Delete this analysis from your repository? This cannot be undone.")) return;
      setDeleting(uri);
      setError(null);
      try {
        const res = await fetch("/api/me/analyses", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uri }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setMine((prev) => prev?.filter((a) => a.uri !== uri) ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setDeleting(null);
      }
    },
    [],
  );

  return (
    <div>
      <div className="mb-8 flex gap-3">
        <button
          type="button"
          className="btn-editorial px-4 py-2"
          aria-pressed={tab === "feed"}
          onClick={() => setTab("feed")}
        >
          Public feed
        </button>
        <button
          type="button"
          className="btn-editorial px-4 py-2"
          aria-pressed={tab === "mine"}
          onClick={() => setTab("mine")}
        >
          My analyses
        </button>
      </div>

      {error && (
        <p className="mb-6 text-sm" style={{ color: "var(--signal)" }}>{error}</p>
      )}

      {tab === "feed" && (
        <>
          {feed.length === 0 && (
            <div className="card-editorial text-center py-14">
              <p className="font-serif text-xl mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
                No published analyses discovered yet
              </p>
              <p className="text-sm" style={{ color: "var(--muted-ink)" }}>
                Be the first: run an analysis in the Studio and publish it.
              </p>
            </div>
          )}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {feed.map((a, i) => (
              <FeedCard key={a.uri} analysis={a} accent={ACCENTS[i % ACCENTS.length]!} />
            ))}
          </div>
        </>
      )}

      {tab === "mine" && (
        <>
          {authenticated === false && (
            <div className="card-editorial text-center py-14">
              <p className="text-sm" style={{ color: "var(--body)" }}>
                Sign in from the Studio to see and manage your analyses.
              </p>
            </div>
          )}
          {authenticated && mine === null && !error && (
            <p className="kicker">Loading your analyses…</p>
          )}
          {authenticated && mine !== null && mine.length === 0 && (
            <div className="card-editorial text-center py-14">
              <p className="text-sm" style={{ color: "var(--body)" }}>
                You haven&apos;t published any analyses yet.
              </p>
            </div>
          )}
          {authenticated && mine !== null && mine.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((a, i) => (
                <article
                  key={a.uri}
                  className="card-editorial h-full flex flex-col"
                  style={{ borderTop: `3px solid rgb(${ACCENTS[i % ACCENTS.length]})` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="kicker-muted">{fmtDate(a.value.createdAt ?? "")}</span>
                    {a.value.tool && <span className="chip-editorial"><span>{a.value.tool}</span></span>}
                  </div>
                  <h2 className="font-serif text-xl leading-snug mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
                    {a.value.title ?? "Untitled analysis"}
                  </h2>
                  {a.value.counts && (
                    <div className="flex gap-6 mb-4">
                      {(
                        [
                          [a.value.counts.topics, "Topics"],
                          [a.value.counts.claims, "Claims"],
                          [a.value.counts.comments, "Voices"],
                        ] as const
                      ).map(([num, label]) => (
                        <div key={label} className="stat-column">
                          <div className="stat-num" style={{ fontSize: "1.4rem" }}>{num}</div>
                          <div className="stat-label">{label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs break-all mb-4" style={{ color: "var(--faint-ink)" }}>{a.uri}</p>
                  <div className="mt-auto flex gap-3 border-t pt-3" style={{ borderColor: "var(--hairline)" }}>
                    {a.blobUrl && (
                      <a
                        className="btn-editorial px-3 py-1.5"
                        href={viewerUrl(a.blobUrl)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>
                    )}
                    <button
                      type="button"
                      className="btn-editorial px-3 py-1.5"
                      style={{ color: "var(--signal)" }}
                      disabled={deleting === a.uri}
                      onClick={() => remove(a.uri)}
                    >
                      {deleting === a.uri ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function FeedCard({ analysis, accent }: { analysis: NetworkAnalysis; accent: string }) {
  const inner = (
    <article
      className="card-editorial h-full transition-colors hover:border-[var(--brand)]"
      style={{ borderTop: `3px solid rgb(${accent})` }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="kicker-muted">{fmtDate(analysis.createdAt)}</span>
        {analysis.tool && <span className="chip-editorial"><span>{analysis.tool}</span></span>}
      </div>
      <h2 className="font-serif text-xl leading-snug mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
        {analysis.title}
      </h2>
      {analysis.description && (
        <p className="text-sm mb-4 line-clamp-2" style={{ color: "var(--body)" }}>
          {analysis.description}
        </p>
      )}
      {analysis.counts && (
        <div className="flex gap-6 mb-4">
          {(
            [
              [analysis.counts.topics, "Topics"],
              [analysis.counts.claims, "Claims"],
              [analysis.counts.comments, "Voices"],
            ] as const
          ).map(([num, label]) => (
            <div key={label} className="stat-column">
              <div className="stat-num" style={{ fontSize: "1.4rem" }}>{num}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 border-t pt-3" style={{ borderColor: "var(--hairline)" }}>
        {analysis.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={analysis.avatar} alt="" className="h-5 w-5" style={{ borderRadius: 0 }} />
        ) : (
          <span className="inline-block h-5 w-5" style={{ background: "var(--brand-soft)" }} />
        )}
        <span className="text-xs" style={{ color: "var(--muted-ink)" }}>
          {analysis.displayName || analysis.handle || analysis.did.slice(0, 24)}
          {analysis.handle && <> · @{analysis.handle}</>}
        </span>
      </div>
    </article>
  );
  return analysis.blobUrl ? (
    <a href={viewerUrl(analysis.blobUrl)} target="_blank" rel="noreferrer" className="block h-full">
      {inner}
    </a>
  ) : (
    inner
  );
}
