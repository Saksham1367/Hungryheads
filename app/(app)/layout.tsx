import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

/**
 * Authenticated shell for /(app)/* routes.
 *
 * Phase-1 Step 4 ships a minimal header with sign-out. Step 6 expands this
 * with the dashboard sidebar and the agent chat dock.
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

  return (
    <div className="min-h-screen flex flex-col bg-hh-cream">
      <header className="border-b border-hh-gray-light bg-white sticky top-0 z-30">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/dashboard" aria-label="HungryHeads dashboard">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-hh-charcoal">
              {user.email}
            </span>
            <form action="/auth/sign-out" method="post">
              <Button type="submit" variant="ghost" size="sm">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
