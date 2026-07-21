import { NextResponse } from "next/server";
import { getGlobalOAuthClient } from "@/lib/auth/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const client = await getGlobalOAuthClient();
  return NextResponse.json(client.clientMetadata, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
