import { NodeOAuthClient } from "@atproto/oauth-client-node";
import { JoseKey } from "@atproto/jwk-jose";
import { env } from "@/lib/env";
import { getRawSession } from "@/lib/session";

/**
 * ATProto OAuth client (architecture §9).
 * - CONFIDENTIAL CLIENT (production): private-key JWT via ATPROTO_JWK_PRIVATE + PUBLIC_URL.
 * - PUBLIC CLIENT (dev fallback): RFC 8252 loopback client_id, no client auth.
 * Session persistence: OAuth session is serialized into the iron-session cookie,
 * so no server-side store is required across serverless invocations.
 */

const oauthClientKey = "globalOAuthClient";
if (process.env.NODE_ENV !== "production") {
  (global as Record<string, unknown>)[oauthClientKey] = null;
}

const globalStoreKey = "oauthSharedStore";
if (!(global as Record<string, unknown>)[globalStoreKey]) {
  (global as Record<string, unknown>)[globalStoreKey] = new Map();
}
const sharedStore = (global as Record<string, unknown>)[globalStoreKey] as Map<string, unknown>;

// State store — in-memory only, used during the short-lived OAuth flow
const stateStore = {
  async get(key: string) {
    return sharedStore.get(`state:${key}`) as never;
  },
  async set(key: string, value: unknown) {
    sharedStore.set(`state:${key}`, value);
  },
  async del(key: string) {
    sharedStore.delete(`state:${key}`);
  },
};

// Session store — syncs with the encrypted cookie for persistence
const sessionStore = {
  async get(key: string) {
    const memValue = sharedStore.get(`session:${key}`);
    if (memValue) return memValue as never;
    try {
      const session = await getRawSession();
      if (session.oauthSession && session.did === key) {
        const parsed = JSON.parse(session.oauthSession);
        sharedStore.set(`session:${key}`, parsed);
        return parsed as never;
      }
    } catch (err) {
      console.warn("Failed to restore OAuth session from cookie:", err);
    }
    return undefined as never;
  },
  async set(key: string, value: unknown) {
    sharedStore.set(`session:${key}`, value);
    try {
      const session = await getRawSession();
      session.oauthSession = JSON.stringify(value);
      await session.save();
    } catch (err) {
      console.warn("Failed to save OAuth session to cookie:", err);
    }
  },
  async del(key: string) {
    sharedStore.delete(`session:${key}`);
    try {
      const session = await getRawSession();
      session.oauthSession = undefined;
      await session.save();
    } catch (err) {
      console.warn("Failed to clear OAuth session from cookie:", err);
    }
  },
};

/**
 * Next.js patches global fetch in a way that loses the body when called with a
 * Request OBJECT ("fetch failed: expected non-null body source"). The ATProto
 * DPoP wrapper always builds `new Request(input, init)` — so every
 * DPoP-authenticated call with a body (e.g. uploadBlob) breaks. Normalize
 * Request inputs to (url, init) with a buffered body before the platform fetch.
 * Buffering is fine at our sizes (reports ≤ a few MB).
 */
const normalizedFetch: typeof globalThis.fetch = async (input, init) => {
  if (input instanceof Request && init === undefined) {
    const body = input.body === null ? undefined : await input.arrayBuffer();
    return globalThis.fetch(input.url, {
      method: input.method,
      headers: input.headers,
      body,
      redirect: input.redirect,
      signal: input.signal,
    });
  }
  return globalThis.fetch(input, init);
};

let cachedKeyset: Awaited<ReturnType<typeof JoseKey.fromImportable>>[] | null = null;

async function getKeyset() {
  if (cachedKeyset) return cachedKeyset;
  const jwkPrivate = env.ATPROTO_JWK_PRIVATE;
  if (!jwkPrivate) return null;
  try {
    const jwk = JSON.parse(jwkPrivate);
    const key = await JoseKey.fromImportable(jwk, jwk.kid || "key-1");
    cachedKeyset = [key];
    return cachedKeyset;
  } catch (err) {
    console.error("Failed to parse ATPROTO_JWK_PRIVATE:", err);
    return null;
  }
}

export const createClient = async () => {
  const publicUrl = env.PUBLIC_URL;
  // Must use 127.0.0.1 per RFC 8252 for ATProto OAuth localhost development
  const localhostUrl = `http://127.0.0.1:${env.PORT}`;
  const enc = encodeURIComponent;
  const isLocalDev = process.env.NODE_ENV !== "production";
  const url = isLocalDev ? localhostUrl : publicUrl || localhostUrl;

  let keyset = null;
  try {
    if (!isLocalDev && publicUrl) keyset = await getKeyset();
  } catch (err) {
    console.error("Error getting keyset:", err);
  }
  const isConfidentialClient = keyset !== null && !!publicUrl && !isLocalDev;

  const clientMetadata: Record<string, unknown> = {
    client_name: "Broad Listening",
    client_uri: url,
    dpop_bound_access_tokens: true,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: "atproto transition:generic",
    application_type: "web",
  };

  if (isConfidentialClient) {
    clientMetadata.client_id = `${publicUrl}/api/oauth/client-metadata.json`;
    clientMetadata.redirect_uris = [`${publicUrl}/api/oauth/callback`];
    clientMetadata.token_endpoint_auth_method = "private_key_jwt";
    clientMetadata.token_endpoint_auth_signing_alg = "ES256";
    clientMetadata.jwks_uri = `${publicUrl}/api/oauth/jwks.json`;
  } else {
    clientMetadata.client_id = `http://localhost?redirect_uri=${enc(`${url}/api/oauth/callback`)}&scope=${enc("atproto transition:generic")}`;
    clientMetadata.redirect_uris = [`${url}/api/oauth/callback`];
    clientMetadata.token_endpoint_auth_method = "none";
  }

  const clientConfig: Record<string, unknown> = {
    clientMetadata,
    stateStore,
    sessionStore,
    fetch: normalizedFetch,
  };
  if (keyset) clientConfig.keyset = keyset;

  return new NodeOAuthClient(clientConfig as ConstructorParameters<typeof NodeOAuthClient>[0]);
};

export const getGlobalOAuthClient = async () => {
  const currentClient = (global as Record<string, unknown>)[oauthClientKey];
  if (!currentClient) {
    const newClient = await createClient();
    (global as Record<string, unknown>)[oauthClientKey] = newClient;
    return newClient;
  }
  return currentClient as NodeOAuthClient;
};

export async function getJwks(): Promise<{ keys: unknown[] } | null> {
  const client = await getGlobalOAuthClient();
  if ("jwks" in client && client.jwks) {
    return client.jwks as { keys: unknown[] };
  }
  return null;
}
