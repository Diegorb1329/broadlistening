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
      analyses: res.data.records.map((r) => ({ uri: r.uri, cid: r.cid, value: r.value })),
    });
  } catch (error) {
    console.error("[api/me/analyses] failed:", error);
    return NextResponse.json({ error: "list_failed" }, { status: 502 });
  }
}
