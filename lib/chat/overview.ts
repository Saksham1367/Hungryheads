/**
 * Server-side loader for the Overview drawer.
 * One call returns everything the drawer needs in a single render pass.
 */
import { createClient } from "@/lib/supabase/server";
import { isSwiggyConnected } from "@/lib/swiggy/tokens";
import { PERSONALITIES } from "@/lib/constants";
import type { Json } from "@/types/database";

export interface OverviewOrderRow {
  id: string;
  restaurant_name: string | null;
  total_amount: number;
  items: Json;
  ordered_at: string;
  source: string; // 'food' | 'instamart' | 'dineout'
}

export interface OverviewMemory {
  id: string;
  fact: string;
  updated_at: string;
}

export interface OverviewData {
  fullName: string;
  email: string;
  // Onboarding answers
  cuisines: string[];
  diet: string | null;
  personality: { id: string; emoji: string; label: string; blurb: string } | null;
  monthlyBudget: number | null;
  deliveryRadiusKm: number;
  allergies: { allergen: string; severity: string }[];
  // Spend
  monthSpend: number;
  budgetUsedPct: number | null;
  // Orders
  recentOrders: OverviewOrderRow[];
  totalOrderCount: number;
  // Long-term memory
  recentMemories: OverviewMemory[];
  totalMemoryCount: number;
  // Connection
  swiggyConnected: boolean;
}

export async function loadOverviewData(userId: string): Promise<OverviewData | null> {
  const supabase = createClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    { data: profile },
    { data: prefs },
    { data: allergies },
    { data: monthOrders },
    { data: recentOrders, count: totalOrderCount },
    { data: recentMemories, count: totalMemoryCount },
    swiggyConnected,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("user_preferences")
      .select("cuisines, diet, monthly_budget, delivery_radius_km, personality")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("user_allergies")
      .select("allergen, severity")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("orders_cache")
      .select("total_amount")
      .eq("user_id", userId)
      .gte("ordered_at", startOfMonth.toISOString()),
    supabase
      .from("orders_cache")
      .select("id, restaurant_name, total_amount, items, ordered_at, source", {
        count: "exact",
      })
      .eq("user_id", userId)
      .order("ordered_at", { ascending: false })
      .limit(5),
    supabase
      .from("agent_memory")
      .select("id, fact, updated_at", { count: "exact" })
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(8),
    isSwiggyConnected(userId),
  ]);

  if (!profile) return null;

  const monthSpend = (monthOrders ?? []).reduce(
    (s, o) => s + (o.total_amount ?? 0),
    0,
  );
  const budget = prefs?.monthly_budget ?? null;
  const budgetUsedPct = budget
    ? Math.min(100, Math.round((monthSpend / budget) * 100))
    : null;

  const personality = prefs?.personality
    ? PERSONALITIES.find((p) => p.id === prefs.personality) ?? null
    : null;

  const fullName = profile.full_name?.trim() || profile.email.split("@")[0];

  return {
    fullName,
    email: profile.email,
    cuisines: prefs?.cuisines ?? [],
    diet: prefs?.diet ?? null,
    personality: personality
      ? { id: personality.id, emoji: personality.emoji, label: personality.label, blurb: personality.blurb }
      : null,
    monthlyBudget: budget,
    deliveryRadiusKm: prefs?.delivery_radius_km ?? 5,
    allergies: (allergies ?? []).map((a) => ({
      allergen: a.allergen,
      severity: a.severity,
    })),
    monthSpend,
    budgetUsedPct,
    recentOrders: (recentOrders ?? []).map((o) => ({
      id: o.id,
      restaurant_name: o.restaurant_name,
      total_amount: o.total_amount,
      items: o.items,
      ordered_at: o.ordered_at,
      source: o.source,
    })),
    totalOrderCount: totalOrderCount ?? 0,
    recentMemories: (recentMemories ?? []).map((m) => ({
      id: m.id,
      fact: m.fact,
      updated_at: m.updated_at,
    })),
    totalMemoryCount: totalMemoryCount ?? 0,
    swiggyConnected,
  };
}
