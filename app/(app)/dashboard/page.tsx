import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FEATURES } from "@/lib/constants";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Phase-1 Step 4 placeholder dashboard. Confirms the middleware gate works
 * end-to-end. Step 6 replaces this with the real four-card dashboard + chat
 * dock.
 */
export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  // Onboarding gate — once Step 5 lands, this routes new users to /onboarding.
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded, full_name")
    .eq("id", user.id)
    .single();

  if (profile && !profile.onboarded) {
    redirect("/onboarding");
  }

  const greeting = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="container py-10 space-y-8">
      <div className="space-y-1">
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-hh-black">
          Hey {greeting} 👋
        </h1>
        <p className="text-hh-gray">
          Phase-1 dashboard placeholder. Step 6 fills this in for real.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {FEATURES.map((f) => (
          <div
            key={f.id}
            className="rounded-xl border border-hh-gray-light bg-white p-5 hover:shadow-md transition-shadow"
          >
            <div className="font-display font-bold text-hh-black">
              {f.name}
            </div>
            <div className="text-sm text-hh-gray mt-1">{f.tagline}</div>
            <div className="mt-3 text-xs text-hh-gray-light">Coming soon</div>
          </div>
        ))}
      </div>
    </div>
  );
}
