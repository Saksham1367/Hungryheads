/**
 * GET /api/swiggy-oauth/start
 *
 * Initiates the Swiggy Builders Club OAuth 2.1 PKCE flow (brief §7).
 *
 * - MCP_MODE=mock (default): synthesise a fake 5-day token and bounce home.
 *   Lets us build everything downstream of OAuth without real credentials.
 * - MCP_MODE=live: generate PKCE pair, persist verifier in HttpOnly cookie,
 *   redirect to Swiggy's authorize endpoint.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { persistSwiggyToken } from "@/lib/swiggy/tokens";
import {
  PKCE_COOKIES,
  PKCE_COOKIE_TTL_S,
  SWIGGY_AUTHORIZE_URL,
  SWIGGY_SCOPES,
  deriveCodeChallenge,
  generateCodeVerifier,
  generateState,
  isMcpMockMode,
  sanitizeReturnTo,
} from "@/lib/swiggy/oauth";

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Optional: where to send the user once connected (e.g. back to the chat
  // they were ordering from). Validated against an open-redirect allowlist.
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get("returnTo"));

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.searchParams.set("redirect", returnTo ?? "/connect-swiggy");
    return NextResponse.redirect(url);
  }

  // ─── Mock path ────────────────────────────────────────────────────────────
  if (isMcpMockMode()) {
    await persistSwiggyToken(user.id, {
      access_token: `mock_${user.id.slice(0, 8)}_${Date.now()}`,
      expires_in: 5 * 24 * 60 * 60, // 5 days, matches Swiggy v1
      scope: SWIGGY_SCOPES.join(" "),
    });
    // If we came from a chat's "Connect Swiggy" CTA, go straight back there;
    // otherwise show the connect screen's success state.
    const url = request.nextUrl.clone();
    if (returnTo) {
      return NextResponse.redirect(new URL(returnTo, request.nextUrl.origin));
    }
    url.pathname = "/connect-swiggy";
    url.search = "";
    url.searchParams.set("mock", "1");
    return NextResponse.redirect(url);
  }

  // ─── Live path ────────────────────────────────────────────────────────────
  const clientId = process.env.SWIGGY_CLIENT_ID;
  const redirectUri = process.env.SWIGGY_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error:
          "MCP_MODE=live but SWIGGY_CLIENT_ID or SWIGGY_OAUTH_REDIRECT_URI is missing.",
      },
      { status: 500 },
    );
  }

  const verifier = generateCodeVerifier();
  const challenge = await deriveCodeChallenge(verifier);
  const state = generateState();

  const authorize = new URL(SWIGGY_AUTHORIZE_URL);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", SWIGGY_SCOPES.join(" "));
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("state", state);

  const response = NextResponse.redirect(authorize.toString());

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: PKCE_COOKIE_TTL_S,
  };
  response.cookies.set(PKCE_COOKIES.verifier, verifier, cookieOpts);
  response.cookies.set(PKCE_COOKIES.state, state, cookieOpts);
  // Stash the return target so the callback can bounce the user back to the
  // exact chat after Swiggy redirects home.
  if (returnTo) {
    response.cookies.set(PKCE_COOKIES.returnTo, returnTo, cookieOpts);
  }
  return response;
}
