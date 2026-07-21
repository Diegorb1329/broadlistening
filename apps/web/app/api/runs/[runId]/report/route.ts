import { NextResponse } from "next/server";
import { getRun } from "workflow/api";
import type { AnalyzeResult } from "@/workflows/analyze";

/**
 * The finished report as plain JSON — which makes an unpublished run viewable
 * with the standard viewer: /dashboard?report=<origin>/api/runs/<id>/report
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await params;
  const run = getRun<AnalyzeResult>(runId);
  if (!(await run.exists)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const status = await run.status;
  if (status !== "completed") {
    return NextResponse.json({ error: "not_ready", status }, { status: 409 });
  }
  const result = await run.returnValue;
  return NextResponse.json(result.report, {
    headers: { "Cache-Control": "private, max-age=3600" },
  });
}
