"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { onboardingSchema, type OnboardingValues } from "@/lib/onboarding/schema";

export type UpdateProfileResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Profile editor — saves all five onboarding fields in one go.
 *
 * Allergies use a delete-all-then-insert pattern so removed allergens
 * actually disappear (not orphaned). user_preferences is a single-row
 * upsert. Both run inside the user-scoped client so RLS gates ownership.
 */
export async function updateProfile(
  values: OnboardingValues,
): Promise<UpdateProfileResult> {
  const parsed = onboardingSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid values.",
    };
  }
  const v = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

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

  // 2. user_allergies — replace prior with new selection
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

  revalidatePath("/", "layout");
  return { ok: true };
}
