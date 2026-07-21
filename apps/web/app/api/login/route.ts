import { NextRequest, NextResponse } from "next/server";
import { isValidHandle } from "@atproto/syntax";
import { OAuthResolverError } from "@atproto/oauth-client-node";
import { getGlobalOAuthClient } from "@/lib/auth/client";
import { getRawSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const client = await getGlobalOAuthClient();
    const body = await request.json();
    const handle = typeof body?.handle === "string" ? body.handle.replace(/^@/, "").trim() : "";
    const returnTo = body?.returnTo;

    if (!isValidHandle(handle)) {
      return NextResponse.json({ error: "Invalid handle" }, { status: 400 });
    }
    if (returnTo && typeof returnTo === "string") {
      const session = await getRawSession();
      session.returnTo = returnTo;
      await session.save();
    }
    const url = await client.authorize(handle, { scope: "atproto transition:generic" });
    return NextResponse.json({ redirectUrl: url.toString() });
  } catch (error) {
    console.error("OAuth authorize failed:", error);
    const message = error instanceof OAuthResolverError ? error.message : "Couldn't initiate login";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
