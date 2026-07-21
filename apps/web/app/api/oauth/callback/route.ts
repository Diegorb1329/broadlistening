import { NextRequest } from "next/server";
import { Agent } from "@atproto/api";
import { getGlobalOAuthClient } from "@/lib/auth/client";
import { getRawSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const client = await getGlobalOAuthClient();
    const url = new URL(request.url);
    const params = new URLSearchParams(url.search);

    // Retry the callback up to 3 times on network errors (PDS metadata fetches flake)
    let oauthSession;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await client.callback(params);
        oauthSession = result.session;
        break;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`OAuth callback attempt ${attempt} failed:`, message);
        const isNetworkError =
          message.includes("UND_ERR_SOCKET") ||
          message.includes("fetch failed") ||
          message.includes("Failed to resolve OAuth server metadata");
        if (isNetworkError && attempt < 3) {
          await new Promise((r) => setTimeout(r, attempt * 1000));
          continue;
        }
        throw error;
      }
    }
    if (!oauthSession) throw lastError || new Error("Failed to create session after retries");

    let handle: string = oauthSession.did;
    let displayName: string | undefined;
    let avatar: string | undefined;
    try {
      const agent = new Agent(oauthSession);
      const profile = await agent.getProfile({ actor: oauthSession.did });
      if (profile.success) {
        handle = profile.data.handle;
        displayName = profile.data.displayName;
        avatar = profile.data.avatar;
      }
    } catch (err) {
      console.warn("Failed to fetch profile during login:", err);
    }

    const session = await getRawSession();
    const returnTo = session.returnTo || "/";
    session.did = oauthSession.did;
    session.handle = handle;
    session.displayName = displayName;
    session.avatar = avatar;
    session.returnTo = undefined;
    await session.save();

    const origin = new URL(request.url).origin;
    const redirectPath = returnTo.startsWith("/") ? returnTo : "/";
    return Response.redirect(`${origin}${redirectPath}`, 303);
  } catch (error) {
    console.error("OAuth callback failed:", error);
    const origin = new URL(request.url).origin;
    return Response.redirect(
      `${origin}/?error=${encodeURIComponent("Authentication failed - please try again")}`,
      303,
    );
  }
}
