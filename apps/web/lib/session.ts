import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/** Session data stored in the encrypted cookie. */
export interface Session {
  did?: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
  returnTo?: string;
  /** Serialized OAuth session — persists DPoP-bound tokens across serverless invocations */
  oauthSession?: string;
}

const isProduction = process.env.NODE_ENV === "production";

const sessionOptions: SessionOptions = {
  cookieName: "bl_sid",
  password: env.COOKIE_SECRET,
  cookieOptions: {
    secure: isProduction,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};

export async function getSession(): Promise<Session> {
  const cookieStore = await cookies();
  return getIronSession<Session>(cookieStore, sessionOptions);
}

export async function getRawSession() {
  const cookieStore = await cookies();
  return getIronSession<Session>(cookieStore, sessionOptions);
}

export async function clearSession(): Promise<void> {
  const session = await getRawSession();
  session.destroy();
}
