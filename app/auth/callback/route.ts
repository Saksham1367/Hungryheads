/**
 * Supabase auth callback. Used by:
 *   - Google OAuth redirect
 *   - Email confirmation links (when enabled)
 *
 * Exchanges the `?code=...` query param for a session, then redirects to
 * `next` (defaults to /dashboard).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/utils/url";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  // Validate before use — `next` is attacker-influenced (via the sign-in
  // ?redirect=). String-concatenating an unchecked value onto origin enables
  // "origin@evil.com" / "origin.evil.com" host-swap open redirects.
  const next = safeInternalPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      `${origin}/auth/sign-in?error=missing_code`,
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/sign-in?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
