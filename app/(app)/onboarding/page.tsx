import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { AppHeader } from "@/components/app/header";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  // Already onboarded — bounce to dashboard. Avoids re-running the flow.
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded")
    .eq("id", user.id)
    .single();
  if (profile?.onboarded) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-hh-cream">
    <AppHeader />
    <div className="container max-w-2xl py-10 md:py-16 space-y-8">
      <div className="space-y-2 text-center">
        <span className="inline-block rounded-full bg-hh-orange-light px-3 py-1 text-xs font-semibold text-hh-orange-dark uppercase tracking-wider">
          Set up your profile
        </span>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-hh-black">
          5 questions, 60 seconds.
        </h1>
        <p className="text-hh-gray">
          We&apos;ll use these to filter every menu, respect your budget, and
          make group decisions painless.
        </p>
      </div>

      <OnboardingWizard />
    </div>
    </div>
  );
}
