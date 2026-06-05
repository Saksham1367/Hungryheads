/**
 * SafePlate — the allergy & diet safety net (brief §2.1, §12).
 *
 * Centralized library for "is this menu item / order safe for this user?"
 * The agent's system prompt + the `get_restaurant_menu` tool's
 * `exclude_allergens` filter + the huddle decision engine all do their own
 * upstream filtering — but the brief mandates a hard pre-checkout block, and
 * one centralized library means every order-place server action can call the
 * same defensive check before persisting.
 *
 * Server-only — pulls profile from Supabase via the user-scoped client.
 */
import { createClient } from "@/lib/supabase/server";
import { scanTextForAllergens } from "@/lib/safeplate/keywords";
import type { Allergen, Diet } from "@/types/domain";

export interface AllergenProfile {
  userId: string;
  /** Lowercased allergen names. */
  allergens: string[];
  /** Severity per allergen (defaults to 'high' for the strictest check). */
  severityByAllergen: Record<string, "high" | "medium" | "low">;
  /** Diet preference, if any. */
  diet: Diet | null;
  /** True when diet is one of the strict-veg variants. */
  isVeg: boolean;
}

/** Load the current user's profile. */
export async function loadAllergenProfile(
  userId: string,
): Promise<AllergenProfile> {
  const supabase = createClient();
  const [{ data: allergyRows }, { data: prefRow }] = await Promise.all([
    supabase
      .from("user_allergies")
      .select("allergen, severity")
      .eq("user_id", userId),
    supabase
      .from("user_preferences")
      .select("diet")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const severityByAllergen: Record<string, "high" | "medium" | "low"> = {};
  const allergens: string[] = [];
  for (const a of allergyRows ?? []) {
    const key = a.allergen.toLowerCase();
    allergens.push(key);
    severityByAllergen[key] =
      a.severity === "medium" || a.severity === "low" ? a.severity : "high";
  }
  const diet = (prefRow?.diet ?? null) as Diet | null;
  const isVeg =
    diet !== null && ["Vegetarian", "Vegan", "Jain"].includes(diet);

  return { userId, allergens, severityByAllergen, diet, isVeg };
}

// ─────────────────────────────────────────────────────────────────────────────
// Item-level check
// ─────────────────────────────────────────────────────────────────────────────

export interface SafeplateItem {
  /** Display name — used in error messages. */
  name: string;
  /** Allergen tags on the item (case-insensitive). */
  allergen_tags?: string[];
  /**
   * Free-form item text (description / ingredient list). Scanned by the
   * deterministic keyword layer so an allergen that's present in the prose but
   * MISSING from `allergen_tags` is still caught before checkout.
   */
  ingredients_text?: string;
  /** Item is vegetarian. */
  is_veg?: boolean;
  /** Optional pre-computed safe flag from the agent / engine — we re-verify. */
  safe?: boolean;
}

export type SafetyVerdict =
  | { safe: true }
  | { safe: false; reason: string; blockedBy: string[] };

/**
 * Check a single item against the profile.
 * Returns { safe: true } if all checks pass, otherwise a blocking verdict.
 */
export function checkItem(
  item: SafeplateItem,
  profile: AllergenProfile,
): SafetyVerdict {
  // Allergens that block hard = everything on the profile except 'low' severity
  // (which is a note, not a block).
  const blockingAllergens = profile.allergens.filter(
    (a) => (profile.severityByAllergen[a] ?? "high") !== "low",
  );

  // ── Layer 1: structured tag match ──────────────────────────────────────
  const tagHits = (item.allergen_tags ?? [])
    .map((t) => t.toLowerCase())
    .filter((tag) => blockingAllergens.includes(tag));

  // ── Layer 2: deterministic keyword scan over free-form text ────────────
  // Catches allergens present in the name/description but MISSING from the
  // tags. Scans against the same blocking set. This is the safety net for
  // when tags are incomplete or the agent overlooked a word.
  const scanText = [item.name, item.ingredients_text]
    .filter(Boolean)
    .join(". ");
  const keywordHits = scanTextForAllergens(scanText, blockingAllergens);

  // Union of both layers — order is rejected if EITHER catches an allergen.
  const blockedAllergens = Array.from(
    new Set([...tagHits, ...keywordHits]),
  );
  if (blockedAllergens.length > 0) {
    return {
      safe: false,
      reason: `${item.name} contains ${blockedAllergens.join(", ")}`,
      blockedBy: blockedAllergens,
    };
  }

  // Diet check — strict-veg users can't order non-veg items.
  if (profile.isVeg && item.is_veg === false) {
    return {
      safe: false,
      reason: `${item.name} is non-vegetarian`,
      blockedBy: ["non-vegetarian"],
    };
  }

  return { safe: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Order-level check
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderCheckResult {
  safe: boolean;
  /** First-line summary suitable for a user-facing error message. */
  reason: string;
  /** All offending items so the UI can flag each one if needed. */
  blockedItems: { name: string; reasons: string[] }[];
}

/** Check every item in a proposed order. Order is rejected if ANY item fails. */
export function checkOrder(
  items: SafeplateItem[],
  profile: AllergenProfile,
): OrderCheckResult {
  if (items.length === 0) {
    return { safe: false, reason: "Cart is empty.", blockedItems: [] };
  }
  const blockedItems: { name: string; reasons: string[] }[] = [];
  for (const it of items) {
    const verdict = checkItem(it, profile);
    if (!verdict.safe) {
      blockedItems.push({ name: it.name, reasons: verdict.blockedBy });
    }
  }
  if (blockedItems.length === 0) {
    return { safe: true, reason: "All items pass SafePlate.", blockedItems: [] };
  }
  const summary =
    blockedItems.length === 1
      ? `Blocked: ${blockedItems[0].name} (${blockedItems[0].reasons.join(", ")}).`
      : `Blocked: ${blockedItems.length} items contain flagged allergens — ${blockedItems
          .slice(0, 3)
          .map((b) => b.name)
          .join(", ")}${blockedItems.length > 3 ? "…" : ""}.`;
  return { safe: false, reason: summary, blockedItems };
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu filter — used by Diet mode + by tools that surface menus to the agent
// ─────────────────────────────────────────────────────────────────────────────

export interface FilterMenuResult<T extends SafeplateItem> {
  safe: T[];
  /** Items removed by SafePlate, with the reason. */
  filtered: { item: T; reason: string }[];
}

/** Drop unsafe items from a menu. Returns kept + dropped (with reasons). */
export function filterMenu<T extends SafeplateItem>(
  items: T[],
  profile: AllergenProfile,
): FilterMenuResult<T> {
  const safe: T[] = [];
  const filtered: { item: T; reason: string }[] = [];
  for (const it of items) {
    const verdict = checkItem(it, profile);
    if (verdict.safe) safe.push(it);
    else filtered.push({ item: it, reason: verdict.reason });
  }
  return { safe, filtered };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience — explain a profile in one short sentence (for logs / UI)
// ─────────────────────────────────────────────────────────────────────────────
export function describeProfile(profile: AllergenProfile): string {
  const parts: string[] = [];
  if (profile.allergens.length > 0) {
    parts.push(`avoid ${profile.allergens.join("/")}`);
  }
  if (profile.diet && profile.diet !== "No Preference") {
    parts.push(`${profile.diet.toLowerCase()}`);
  }
  return parts.length > 0
    ? parts.join(" · ")
    : "no allergens or diet rules on file";
}

/** Type re-export so callers don't need to know the source. */
export type { Allergen };
