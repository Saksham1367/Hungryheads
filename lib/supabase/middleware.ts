/**
 * Supabase session refresh + route gate, run inside Next.js middleware.
 *
 * Why this file exists: server components can't refresh the auth cookie on
 * their own (they can read cookies but not set them). Without this, a token
 * that expired between requests would leave the user stuck. Middleware runs
 * before every matched request, refreshes the session if needed, and writes
 * the new cookie back onto the response.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/** Path prefixes that require an authenticated session. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/connect-swiggy",
  "/voiceorder",
  "/huddle",
  "/profile",
];

/** Path prefixes that authed users should NOT see (bounce them to /dashboard). */
const AUTH_ONLY_PUBLIC_PREFIXES = ["/auth/sign-in", "/auth/sign-up"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do NOT remove this getUser() call — it triggers the cookie
  // refresh that the rest of the app depends on.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Bounce unauthenticated users away from protected routes.
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Bounce authed users away from sign-in / sign-up pages.
  const isAuthPublic = AUTH_ONLY_PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (user && isAuthPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.delete("redirect");
    return NextResponse.redirect(url);
  }

  return response;
}
