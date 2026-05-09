/**
 * Loads the slice of user state that goes into the system prompt.
 * Server-only.
 */
import { createClient } from "@/lib/supabase/server";
import { isSwiggyConnected } from "@/lib/swiggy/tokens";
import type { Allergen, Diet, Personality } from "@/types/domain";

export interface AgentUserProfile {
  userId: string;
  fullName: string;
  firstName: string;
  email: string;
  // Onboarding answers
  cuisines: string[];
  diet: Diet | null;
  monthlyBudget: number | null;
  deliveryRadiusKm: number;
  personality: Personality | null;
  allergies: { name: Allergen | string; severity: string }[];
  // Spend so far this month (rupees) — null if no budget set
  monthSpend: number | null;
  // Live Swiggy connection?
  swiggyConnected: boolean;
}

export async function loadAgentUserProfile(
  userId: string,
): Promise<AgentUserProfile | null> {
  const supabase = createClient();

  const [
    { data: profile },
    { data: prefs },
    { data: allergies },
    { data: orders },
    swiggyConnected,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("user_preferences")
      .select(
        "cuisines, diet, monthly_budget, delivery_radius_km, personality",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("user_allergies")
      .select("allergen, severity")
      .eq("user_id", userId),
    monthOrders(userId),
    isSwiggyConnected(userId),
  ]);

  if (!profile) return null;

  const monthSpend =
    prefs?.monthly_budget != null
      ? (orders ?? []).reduce((s, o) => s + (o.total_amount ?? 0), 0)
      : null;

  const fullName = profile.full_name?.trim() || profile.email.split("@")[0];

  return {
    userId,
    fullName,
    firstName: fullName.split(" ")[0] ?? fullName,
    email: profile.email,
    cuisines: prefs?.cuisines ?? [],
    diet: (prefs?.diet ?? null) as Diet | null,
    monthlyBudget: prefs?.monthly_budget ?? null,
    deliveryRadiusKm: prefs?.delivery_radius_km ?? 5,
    personality: (prefs?.personality ?? null) as Personality | null,
    allergies: (allergies ?? []).map((a) => ({
      name: a.allergen,
      severity: a.severity,
    })),
    monthSpend,
    swiggyConnected,
  };
}

async function monthOrders(userId: string) {
  const supabase = createClient();
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return supabase
    .from("orders_cache")
    .select("total_amount")
    .eq("user_id", userId)
    .gte("ordered_at", start.toISOString());
}
