import { NextResponse } from "next/server";
import { z } from "zod";
import { getRun } from "workflow/api";
import { ANALYSIS_COLLECTION } from "@broadlistening/schema";
import { getAuthenticatedAgent } from "@/lib/agent";
import { getSession } from "@/lib/session";
import type { AnalyzeResult } from "@/workflows/analyze";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ runId: z.string().min(1) });

/**
 * Publish a finished run's report to the user's ATProto repo (architecture §5):
 * report JSON → uploadBlob, thin analysis record → createRecord. Publishing is
 * PUBLIC — the UI states this before the button is pressed.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  const agent = await getAuthenticatedAgent();
  if (!agent || !session.did) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const run = getRun<AnalyzeResult>(parsed.data.runId);
  if (!(await run.exists) || (await run.status) !== "completed") {
    return NextResponse.json({ error: "run_not_ready" }, { status: 409 });
  }
  const { report } = await run.returnValue;
  const [, data] = report.data;

  try {
    const bytes = new TextEncoder().encode(JSON.stringify(report));
    const upload = await agent.uploadBlob(bytes, { encoding: "application/json" });

    const claimCount = data.topics.reduce(
      (n, t) =>
        n +
        t.subtopics.reduce(
          (m, s) => m + s.claims.reduce((k, c) => k + 1 + c.similarClaims.length, 0),
          0,
        ),
      0,
    );

    const record = {
      $type: ANALYSIS_COLLECTION,
      formatVersion: "t3c-v0.2",
      title: data.title,
      description: data.description ?? "",
      createdAt: new Date().toISOString(),
      language: "en",
      counts: { comments: data.sources.length, claims: claimCount, topics: data.topics.length },
      tool: "web",
      report: upload.data.blob,
    };

    const created = await agent.com.atproto.repo.createRecord({
      repo: session.did,
      collection: ANALYSIS_COLLECTION,
      record,
    });

    // Resolve the PDS endpoint so the blob has a plain-HTTPS URL the viewer can load.
    const blobCid = upload.data.blob.ref.toString();
    let blobUrl: string | undefined;
    try {
      const didDoc = (await fetch(`https://plc.directory/${session.did}`).then((r) =>
        r.json(),
      )) as { service?: { id: string; serviceEndpoint: string }[] };
      const pds = didDoc.service?.find((s) => s.id === "#atproto_pds")?.serviceEndpoint;
      if (pds) {
        blobUrl = `${pds}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(session.did)}&cid=${encodeURIComponent(blobCid)}`;
      }
    } catch (err) {
      console.warn("[api/publish] PDS resolution failed:", err);
    }

    console.log(`[api/publish] published ${created.data.uri} for ${session.handle}`);
    return NextResponse.json({
      atUri: created.data.uri,
      cid: created.data.cid,
      blobCid,
      blobUrl,
      viewerPath: blobUrl ? `/dashboard?report=${encodeURIComponent(blobUrl)}` : undefined,
    });
  } catch (error) {
    console.error("[api/publish] failed:", error);
    return NextResponse.json({ error: "publish_failed" }, { status: 502 });
  }
}
