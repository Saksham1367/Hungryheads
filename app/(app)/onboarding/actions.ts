"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { onboardingSchema, type OnboardingValues } from "@/lib/onboarding/schema";

export type OnboardingActionState = {
  ok: boolean;
  error?: string;
};

export async function completeOnboarding(
  values: OnboardingValues,
): Promise<OnboardingActionState> {
  const parsed = onboardingSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid answers.",
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const v = parsed.data;

  // 1. user_preferences (upsert by user_id)
  const { error: prefsErr } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: user.id,
        cuisines: v.cuisines,
        diet: v.diet,
        monthly_budget: v.monthlyBudget,
        delivery_radius_km: v.deliveryRadiusKm,
        personality: v.personality,
      },
      { onConflict: "user_id" },
    );
  if (prefsErr) return { ok: false, error: prefsErr.message };

  // 2. user_allergies — replace prior answers with the new selection
  const { error: delErr } = await supabase
    .from("user_allergies")
    .delete()
    .eq("user_id", user.id);
  if (delErr) return { ok: false, error: delErr.message };

  if (v.allergies.length > 0) {
    const rows = v.allergies.map((a) => ({
      user_id: user.id,
      allergen: a,
      severity: "high" as const,
    }));
    const { error: insErr } = await supabase
      .from("user_allergies")
      .insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  // 3. flip profiles.onboarded
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({ onboarded: true })
    .eq("id", user.id);
  if (profileErr) return { ok: false, error: profileErr.message };

  revalidatePath("/", "layout");
  redirect("/connect-swiggy");
}
