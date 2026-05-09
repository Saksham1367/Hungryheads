import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth gate for /(app)/* routes — no UI chrome.
 *
 * The dashboard chat shell is full-bleed and renders its own sidebar.
 * Other authed pages (onboarding, profile, connect-swiggy, voiceorder,
 * huddles) opt into a top header via `<AppHeader />` from
 * `@/components/app/header`.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense-in-depth: middleware already gates protected routes, but a Server
  // Component that depends on `user` should never assume.
  if (!user) redirect("/auth/sign-in");

  return <>{children}</>;
}
