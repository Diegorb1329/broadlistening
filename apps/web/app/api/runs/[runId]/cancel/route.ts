import { NextResponse } from "next/server";
import { getRun } from "workflow/api";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await params;
  const run = getRun(runId);
  if (!(await run.exists)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  await run.cancel();
  return NextResponse.json({ runId, status: "canceled" });
}
