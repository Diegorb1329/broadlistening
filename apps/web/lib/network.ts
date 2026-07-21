import { ANALYSIS_COLLECTION } from "@broadlistening/schema";

/**
 * Network view (architecture §3): discover every analysis published under our
 * lexicon, across the whole AT Protocol network — no database, no firehose.
 * Relay `listReposByCollection` finds repos; each repo's PDS lists the records.
 */

export interface NetworkAnalysis {
  uri: string;
  did: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
  title: string;
  description: string;
  createdAt: string;
  language?: string;
  counts?: { comments: number; claims: number; topics: number };
  tool?: string;
  /** Plain-HTTPS URL of the report blob (viewer-ready), when resolvable */
  blobUrl?: string;
}

const RELAYS = ["https://relay1.us-east.bsky.network", "https://bsky.network"];
const MAX_REPOS = 25;
const MAX_RECORDS_PER_REPO = 10;

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": "BroadListening/1.0" },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

async function listReposWithCollection(): Promise<string[]> {
  for (const relay of RELAYS) {
    try {
      const data = await fetchJson<{ repos?: { did: string }[] }>(
        `${relay}/xrpc/com.atproto.sync.listReposByCollection?collection=${ANALYSIS_COLLECTION}&limit=${MAX_REPOS}`,
      );
      if (data.repos) return data.repos.map((r) => r.did);
    } catch (err) {
      console.warn(`[network] relay ${relay} failed:`, (err as Error).message);
    }
  }
  return [];
}

async function resolvePds(did: string): Promise<string | undefined> {
  try {
    if (did.startsWith("did:plc:")) {
      const doc = await fetchJson<{ service?: { id: string; serviceEndpoint: string }[] }>(
        `https://plc.directory/${did}`,
      );
      return doc.service?.find((s) => s.id === "#atproto_pds")?.serviceEndpoint;
    }
    if (did.startsWith("did:web:")) {
      const domain = did.slice("did:web:".length);
      const doc = await fetchJson<{ service?: { id: string; serviceEndpoint: string }[] }>(
        `https://${domain}/.well-known/did.json`,
      );
      return doc.service?.find((s) => s.id === "#atproto_pds")?.serviceEndpoint;
    }
  } catch (err) {
    console.warn(`[network] PDS resolution failed for ${did}:`, (err as Error).message);
  }
  return undefined;
}

interface RawRecord {
  uri: string;
  value: {
    title?: string;
    description?: string;
    createdAt?: string;
    language?: string;
    counts?: { comments: number; claims: number; topics: number };
    tool?: string;
    report?: { ref?: { $link?: string } };
    /** V2-era records: blob under `data`, flat counts */
    data?: { ref?: { $link?: string } };
    commentCount?: number;
    claimCount?: number;
  };
}

function countsOf(v: RawRecord["value"]): NetworkAnalysis["counts"] {
  if (v.counts) return v.counts;
  if (v.commentCount || v.claimCount) {
    return { comments: v.commentCount ?? 0, claims: v.claimCount ?? 0, topics: 0 };
  }
  return undefined;
}

export async function fetchNetworkAnalyses(): Promise<NetworkAnalysis[]> {
  const dids = await listReposWithCollection();
  const results = await Promise.allSettled(
    dids.map(async (did): Promise<NetworkAnalysis[]> => {
      const pds = await resolvePds(did);
      if (!pds) return [];
      const [records, profile] = await Promise.all([
        fetchJson<{ records?: RawRecord[] }>(
          `${pds}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=${ANALYSIS_COLLECTION}&limit=${MAX_RECORDS_PER_REPO}`,
        ),
        fetchJson<{ handle?: string; displayName?: string; avatar?: string }>(
          `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
        ).catch(() => ({}) as { handle?: string; displayName?: string; avatar?: string }),
      ]);
      return (records.records ?? []).map((r) => {
        const blobCid = r.value.report?.ref?.$link ?? r.value.data?.ref?.$link;
        return {
          uri: r.uri,
          did,
          handle: profile.handle,
          displayName: profile.displayName,
          avatar: profile.avatar,
          title: r.value.title ?? "Untitled analysis",
          description: r.value.description ?? "",
          createdAt: r.value.createdAt ?? "",
          language: r.value.language,
          counts: countsOf(r.value),
          tool: r.value.tool,
          blobUrl: blobCid
            ? `${pds}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(blobCid)}`
            : undefined,
        };
      });
    }),
  );
  const analyses = results
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  console.log(`[network] ${analyses.length} analyses from ${dids.length} repos`);
  return analyses;
}
