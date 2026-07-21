import type { Metadata } from "next";
import Link from "next/link";
import { fetchNetworkAnalyses, type NetworkAnalysis } from "@/lib/network";
import { TopicColors } from "@/app/_components/BroadListening/utils/parse-topics";

export const metadata: Metadata = {
  title: "Analyses · Broad Listening",
  description: "Every analysis published to the Broad Listening network, by anyone.",
};

export const revalidate = 300;

function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function Card({ analysis, index }: { analysis: NetworkAnalysis; index: number }) {
  const accent = `rgb(${TopicColors[index % TopicColors.length]})`;
  const viewerHref = analysis.blobUrl
    ? `/dashboard?report=${encodeURIComponent(analysis.blobUrl)}`
    : undefined;
  const inner = (
    <article
      className="card-editorial h-full transition-colors hover:border-[var(--brand)]"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="kicker-muted">{fmtDate(analysis.createdAt)}</span>
        {analysis.tool && <span className="chip-editorial"><span>{analysis.tool}</span></span>}
      </div>
      <h2
        className="font-serif text-xl leading-snug mb-2"
        style={{ fontFamily: "var(--font-playfair)" }}
      >
        {analysis.title}
      </h2>
      {analysis.description && (
        <p className="text-sm mb-4 line-clamp-2" style={{ color: "var(--body)" }}>
          {analysis.description}
        </p>
      )}
      {analysis.counts && (
        <div className="flex gap-6 mb-4">
          {[
            [analysis.counts.topics, "Topics"],
            [analysis.counts.claims, "Claims"],
            [analysis.counts.comments, "Voices"],
          ].map(([num, label]) => (
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
  return viewerHref ? (
    <Link href={viewerHref} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default async function AnalysesPage() {
  let analyses: NetworkAnalysis[] = [];
  let failed = false;
  try {
    analyses = await fetchNetworkAnalyses();
  } catch {
    failed = true;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <p className="kicker mb-3">Broad Listening · Network</p>
      <h1
        className="font-serif text-4xl leading-tight mb-3"
        style={{ fontFamily: "var(--font-playfair)" }}
      >
        Every analysis, from <span className="brand-italic">everyone</span>
      </h1>
      <p className="mb-12 max-w-2xl" style={{ color: "var(--body)" }}>
        Reports published with Broad Listening live in their authors&apos; own
        AT&nbsp;Protocol repositories. This page discovers them across the whole
        network — nothing here is stored on our servers.
      </p>

      {failed && (
        <div className="card-editorial" style={{ borderLeft: "3px solid var(--signal)" }}>
          <p className="text-sm" style={{ color: "var(--body)" }}>
            The network index is unreachable right now. Try again in a minute.
          </p>
        </div>
      )}

      {!failed && analyses.length === 0 && (
        <div className="card-editorial text-center py-14">
          <p className="font-serif text-xl mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
            No published analyses discovered yet
          </p>
          <p className="text-sm mb-5" style={{ color: "var(--muted-ink)" }}>
            Be the first: run an analysis in the Studio and publish it to your repository.
          </p>
          <Link href="/" className="btn-editorial btn-editorial-primary px-4 py-2 inline-flex">
            Open the Studio
          </Link>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {analyses.map((a, i) => (
          <Card key={a.uri} analysis={a} index={i} />
        ))}
      </div>
    </div>
  );
}
