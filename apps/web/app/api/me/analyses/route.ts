import { NextResponse } from "next/server";
import { ANALYSIS_COLLECTION } from "@broadlistening/schema";
import { getAuthenticatedAgent } from "@/lib/agent";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** "My analyses" = listRecords on the user's own repo — no database anywhere. */
export async function GET(): Promise<Response> {
  const session = await getSession();
  const agent = await getAuthenticatedAgent();
  if (!agent || !session.did) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  try {
    const res = await agent.com.atproto.repo.listRecords({
      repo: session.did,
      collection: ANALYSIS_COLLECTION,
      limit: 50,
    });
    return NextResponse.json({
      did: session.did,
      analyses: res.data.records.map((r) => ({ uri: r.uri, cid: r.cid, value: r.value })),
    });
  } catch (error) {
    console.error("[api/me/analyses] list failed:", error);
    return NextResponse.json({ error: "list_failed" }, { status: 502 });
  }
}

/**
 * Delete one of the user's own analysis records (body: {uri}).
 * Only records in the caller's own repo can be deleted — the repo in the URI
 * must match the session DID; the PDS enforces this again server-side.
 */
export async function DELETE(request: Request): Promise<Response> {
  const session = await getSession();
  const agent = await getAuthenticatedAgent();
  if (!agent || !session.did) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { uri?: string } | null;
  const uri = body?.uri;
  const match = uri ? /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(uri) : null;
  if (!match) {
    return NextResponse.json({ error: "invalid_uri" }, { status: 400 });
  }
  const [, repo, collection, rkey] = match;
  if (repo !== session.did || collection !== ANALYSIS_COLLECTION) {
    return NextResponse.json({ error: "not_your_record" }, { status: 403 });
  }
  try {
    await agent.com.atproto.repo.deleteRecord({ repo: session.did, collection, rkey: rkey! });
    console.log(`[api/me/analyses] deleted ${uri} for ${session.handle}`);
    return NextResponse.json({ deleted: uri });
  } catch (error) {
    console.error("[api/me/analyses] delete failed:", error);
    return NextResponse.json({ error: "delete_failed" }, { status: 502 });
  }
}
