import Link from "next/link";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

/**
 * Top header used by non-chat authed pages (onboarding, profile,
 * connect-swiggy, voiceorder, huddle pages, coming-soon).
 *
 * The dashboard chat shell does NOT use this — the sidebar replaces it.
 */
export async function AppHeader() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-hh-gray-light bg-white sticky top-0 z-30">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/dashboard" aria-label="HungryHeads dashboard">
          <Logo />
        </Link>
        <div className="flex items-center gap-3">
          {user?.email && (
            <span className="hidden sm:inline text-sm text-hh-charcoal">
              {user.email}
            </span>
          )}
          <form action="/auth/sign-out" method="post">
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
