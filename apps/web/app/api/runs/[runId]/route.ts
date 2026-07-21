import { NextResponse } from "next/server";
import { getRun } from "workflow/api";

/** Status snapshot — the polling fallback when the event stream drops. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await params;
  const run = getRun(runId);
  if (!(await run.exists)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const status = await run.status;
  return NextResponse.json({ runId, status });
}
