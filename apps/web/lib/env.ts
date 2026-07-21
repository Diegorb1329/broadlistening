/** Server-side environment (plain reads; validation happens where values are used). */
export const env = {
  COOKIE_SECRET: process.env.COOKIE_SECRET ?? "development-secret-at-least-32-chars!!",
  PUBLIC_URL: process.env.PUBLIC_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? (process.env.PUBLIC_URL ?? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
    : "",
  PORT: Number(process.env.PORT ?? 3000),
  ATPROTO_JWK_PRIVATE: process.env.ATPROTO_JWK_PRIVATE ?? "",
};
