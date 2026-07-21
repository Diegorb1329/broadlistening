import { NextResponse } from "next/server";
import { getJwks } from "@/lib/auth/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const jwks = await getJwks();
  if (!jwks) {
    return NextResponse.json({ keys: [] }, { status: 404 });
  }
  return NextResponse.json(jwks, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
