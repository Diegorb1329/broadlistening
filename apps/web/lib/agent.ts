import { Agent } from "@atproto/api";
import { getGlobalOAuthClient } from "@/lib/auth/client";
import { getSession } from "@/lib/session";

/**
 * Authenticated ATProto agent for the current user, restored from the OAuth
 * session in the cookie. Returns null when not logged in.
 */
export async function getAuthenticatedAgent(): Promise<Agent | null> {
  const session = await getSession();
  if (!session.did) return null;
  try {
    const client = await getGlobalOAuthClient();
    const oauthSession = await client.restore(session.did);
    if (!oauthSession) return null;
    return new Agent(oauthSession);
  } catch (err) {
    console.error("Failed to restore authenticated agent:", err);
    return null;
  }
}
