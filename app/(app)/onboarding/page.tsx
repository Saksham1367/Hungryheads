import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Welcome" };

/**
 * Phase-1 Step 4 placeholder. Step 5 replaces this with the real 5-question
 * flow from brief §6. For now it lets a freshly signed-up user mark themselves
 * as onboarded so we can verify the middleware gate end-to-end.
 */
export default async function OnboardingPlaceholder() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  async function markOnboarded() {
    "use server";
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ onboarded: true })
      .eq("id", user.id);
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  return (
    <div className="container max-w-xl py-16 space-y-6">
      <div className="space-y-2">
        <span className="inline-block rounded-full bg-hh-orange-light px-3 py-1 text-xs font-semibold text-hh-orange-dark uppercase tracking-wider">
          Step 5 lands here
        </span>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-hh-black">
          Welcome to HungryHeads
        </h1>
        <p className="text-hh-charcoal">
          The real 5-question onboarding (cuisine prefs, allergies, budget,
          delivery radius, food personality) lands in the next phase. For now
          you can skip ahead to the dashboard to verify auth works end-to-end.
        </p>
      </div>
      <form action={markOnboarded}>
        <Button type="submit" variant="primary" size="md">
          Skip to dashboard
        </Button>
      </form>
    </div>
  );
}
