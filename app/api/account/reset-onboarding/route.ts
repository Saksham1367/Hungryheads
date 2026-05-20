/**
 * POST /api/account/reset-onboarding
 *
 * Flips `profiles.onboarded = false` for the signed-in user and 303-redirects
 * them to /onboarding. Form-based so it works without JS — used by the "Re-run
 * onboarding" button in the Overview drawer.
 *
 * Existing user_preferences + user_allergies rows are preserved; the wizard's
 * submit will UPSERT/replace them anyway.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  await supabase
    .from("profiles")
    .update({ onboarded: false })
    .eq("id", user.id);

  const url = request.nextUrl.clone();
  url.pathname = "/onboarding";
  url.search = "";
  return NextResponse.redirect(url, { status: 303 });
}
