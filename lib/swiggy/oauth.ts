/**
 * OAuth 2.1 PKCE helpers for the Swiggy Builders Club flow (brief §7 + §13).
 *
 * Flow:
 *   1. /api/swiggy-oauth/start  generates a code_verifier + code_challenge,
 *      sets the verifier as an HttpOnly cookie, and 302s the user to Swiggy's
 *      authorize endpoint with the challenge.
 *   2. Swiggy redirects back to /api/swiggy-oauth/callback?code=...&state=...
 *   3. The callback reads the verifier from the cookie, posts to Swiggy's
 *      token endpoint, persists the access token in Supabase, and bounces
 *      the user to /dashboard.
 *
 * MCP_MODE=mock short-circuits this — we don't have real Swiggy credentials
 * until the Builders Club application is approved. See start/route.ts.
 */

const VERIFIER_BYTES = 64; // 64 random bytes -> ~86-char base64url, well within RFC 7636 [43, 128]

/** Base64url-encode a Uint8Array (no padding, URL-safe alphabet). */
function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const bin = new Uint8Array(
    bytes instanceof ArrayBuffer ? bytes : bytes.buffer,
  );
  let s = "";
  for (let i = 0; i < bin.length; i++) s += String.fromCharCode(bin[i]);
  return Buffer.from(s, "binary")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(VERIFIER_BYTES);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export async function deriveCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64url(digest);
}

/** Random state token to defend against CSRF on the callback. */
export function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/** Endpoint URLs — env-overridable for staging vs production Swiggy MCP. */
export const SWIGGY_AUTHORIZE_URL =
  process.env.SWIGGY_OAUTH_AUTHORIZE_URL ??
  "https://mcp.swiggy.com/oauth/authorize";

export const SWIGGY_TOKEN_URL =
  process.env.SWIGGY_OAUTH_TOKEN_URL ?? "https://mcp.swiggy.com/oauth/token";

/** Default scope set per Builders Club v1. */
export const SWIGGY_SCOPES = ["mcp:tools", "mcp:resources", "mcp:prompts"];

/** HttpOnly cookies set during the start of the PKCE flow. */
export const PKCE_COOKIES = {
  verifier: "hh_swiggy_pkce_verifier",
  state: "hh_swiggy_pkce_state",
} as const;

export const PKCE_COOKIE_TTL_S = 600; // 10 minutes

export interface SwiggyTokenResponse {
  access_token: string;
  token_type: string; // "Bearer"
  expires_in: number; // seconds (~432_000 = 5 days per brief §7.3)
  scope?: string;
  // Brief: no refresh tokens in v1
}

export function isMcpMockMode(): boolean {
  return (process.env.MCP_MODE ?? "mock").toLowerCase() !== "live";
}
