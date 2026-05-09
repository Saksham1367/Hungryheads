/**
 * POST /api/swiggy-oauth/disconnect
 * Form-based — bounces back to /connect-swiggy. Tearing down a token is
 * always allowed; the user can re-connect at any time.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteSwiggyToken } from "@/lib/swiggy/tokens";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    return NextResponse.redirect(url, { status: 303 });
  }

  await deleteSwiggyToken(user.id);

  const dest = request.nextUrl.clone();
  dest.pathname = "/connect-swiggy";
  dest.search = "?disconnected=1";
  return NextResponse.redirect(dest, { status: 303 });
}
