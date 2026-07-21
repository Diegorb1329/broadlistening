import { NextResponse } from "next/server";
import { z } from "zod";
import { start } from "workflow/api";
import { inputCommentSchema, runParamsSchema } from "@broadlistening/schema";
import { analyzeWorkflow } from "@/workflows/analyze";
import { getSession } from "@/lib/session";

/** Hosted-run cap (architecture §11): 200 comments, consented truncation client-side. */
const MAX_WEB_COMMENTS = 200;

const bodySchema = z.object({
  comments: z.array(inputCommentSchema).min(1).max(MAX_WEB_COMMENTS),
  params: runParamsSchema,
});

export async function POST(request: Request): Promise<Response> {
  // Login-first: hosted runs require an authenticated ATProto session.
  const session = await getSession();
  if (!session.did) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: "invalid_request",
        detail: issue ? `${issue.path.join(".")}: ${issue.message}` : "invalid",
      },
      { status: 400 },
    );
  }
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "server_not_configured" }, { status: 503 });
  }
  const run = await start(analyzeWorkflow, [parsed.data.comments, parsed.data.params]);
  console.log(
    `[api/analyze] started run ${run.runId} (${parsed.data.comments.length} comments, "${parsed.data.params.title}")`,
  );
  return NextResponse.json({ runId: run.runId }, { status: 202 });
}
