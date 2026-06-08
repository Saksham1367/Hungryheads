/**
 * GET /api/swiggy-oauth/callback?code=...&state=...
 *
 * Live mode only — receives Swiggy's redirect, validates state against the
 * cookie, exchanges the code (with PKCE verifier) for an access token, and
 * persists it. Mock mode bypasses this entirely (see start/route.ts).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { persistSwiggyToken } from "@/lib/swiggy/tokens";
import {
  PKCE_COOKIES,
  SWIGGY_TOKEN_URL,
  sanitizeReturnTo,
  type SwiggyTokenResponse,
} from "@/lib/swiggy/oauth";

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.searchParams.set("redirect", "/connect-swiggy");
    return NextResponse.redirect(url);
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return redirectWithError(request, oauthError);
  }
  if (!code || !state) {
    return redirectWithError(request, "missing_code_or_state");
  }

  const cookieVerifier = request.cookies.get(PKCE_COOKIES.verifier)?.value;
  const cookieState = request.cookies.get(PKCE_COOKIES.state)?.value;

  if (!cookieVerifier || !cookieState) {
    return redirectWithError(request, "missing_pkce_cookie");
  }
  if (cookieState !== state) {
    return redirectWithError(request, "state_mismatch");
  }

  const clientId = process.env.SWIGGY_CLIENT_ID;
  const redirectUri = process.env.SWIGGY_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return redirectWithError(request, "missing_env");
  }

  // Exchange code for token. Brief §13: cap retries at 30s wall-clock.
  const tokenRes = await fetchWithBudget(SWIGGY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: cookieVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => "");
    return redirectWithError(
      request,
      `token_exchange_${tokenRes.status}`,
      text.slice(0, 200),
    );
  }

  const token = (await tokenRes.json()) as SwiggyTokenResponse;
  if (!token.access_token || !token.expires_in) {
    return redirectWithError(request, "malformed_token_response");
  }

  await persistSwiggyToken(user.id, token);

  // If the user started from a chat's "Connect Swiggy" CTA, return them to that
  // exact chat; otherwise show the connect screen's success state.
  const returnTo = sanitizeReturnTo(
    request.cookies.get(PKCE_COOKIES.returnTo)?.value,
  );
  const dest = returnTo
    ? new URL(returnTo, request.nextUrl.origin)
    : (() => {
        const u = request.nextUrl.clone();
        u.pathname = "/connect-swiggy";
        u.search = "?connected=1";
        return u;
      })();
  const response = NextResponse.redirect(dest);
  response.cookies.delete(PKCE_COOKIES.verifier);
  response.cookies.delete(PKCE_COOKIES.state);
  response.cookies.delete(PKCE_COOKIES.returnTo);
  return response;
}

function redirectWithError(
  request: NextRequest,
  code: string,
  detail?: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = "/connect-swiggy";
  url.search = "";
  url.searchParams.set("error", code);
  if (detail) url.searchParams.set("detail", detail);
  return NextResponse.redirect(url);
}

/** Fetch with a 30s wall-clock budget per brief §13. */
async function fetchWithBudget(url: string, init: RequestInit) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}
