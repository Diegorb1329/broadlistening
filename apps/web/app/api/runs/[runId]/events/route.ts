import { getRun } from "workflow/api";

/**
 * Progress stream: NDJSON passthrough of the workflow run's default stream.
 * The client reads it with fetch + ReadableStream (one JSON object per line).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await params;
  const run = getRun(runId);
  if (!(await run.exists)) {
    return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
  }
  const readable = run.getReadable<string>();
  const encoder = new TextEncoder();
  const stream = readable.pipeThrough(
    new TransformStream<string, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(
          typeof chunk === "string" ? encoder.encode(chunk) : (chunk as Uint8Array),
        );
      },
    }),
  );
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
