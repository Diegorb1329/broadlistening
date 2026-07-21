import type { Metadata } from "next";
import { fetchNetworkAnalyses, type NetworkAnalysis } from "@/lib/network";
import AnalysesBrowser from "./AnalysesBrowser";

export const metadata: Metadata = {
  title: "Analyses",
  description: "Every analysis published to the Broad Listening network, by anyone.",
};

export const revalidate = 300;

export default async function AnalysesPage() {
  let feed: NetworkAnalysis[] = [];
  let failed = false;
  try {
    feed = await fetchNetworkAnalyses();
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
      <p className="mb-10 max-w-2xl" style={{ color: "var(--body)" }}>
        Reports published with Broad Listening live in their authors&apos; own
        AT&nbsp;Protocol repositories. This page discovers them across the whole
        network — nothing here is stored on our servers. Viewing opens the
        broadlistening.org dashboard.
      </p>

      {failed ? (
        <div className="card-editorial" style={{ borderLeft: "3px solid var(--signal)" }}>
          <p className="text-sm" style={{ color: "var(--body)" }}>
            The network index is unreachable right now. Try again in a minute.
          </p>
        </div>
      ) : (
        <AnalysesBrowser feed={feed} />
      )}
    </div>
  );
}
