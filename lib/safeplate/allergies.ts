/**
 * SafePlate allergy writes — the structured `user_allergies` table that powers
 * the HARD checkout gate (see `auditOrder` in ./filter.ts).
 *
 * This is deliberately separate from `agent_memory` (conversational memory).
 * Allergies MUST live here so `loadUserAllergens` → `auditOrder` blocks unsafe
 * orders, and so `loadAgentUserProfile` surfaces them as HARD CONSTRAINTS in
 * the system prompt. One source of truth, used by both the safety gate and the
 * agent's awareness.
 *
 * Writes are dedupe-aware (case-insensitive) so the agent calling
 * `update_allergy` repeatedly never creates duplicate rows.
 */
import { createClient } from "@/lib/supabase/server";

export type AllergySeverity = "high" | "medium" | "low";

/** Normalise for display: trim, collapse spaces, capitalise each word. */
function canonicalizeAllergen(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface AllergyWriteResult {
  ok: boolean;
  /** Canonicalised allergen label actually stored / removed. */
  allergen: string;
  /** True when this call changed the table (insert or delete happened). */
  changed: boolean;
  error?: string;
}

/**
 * Add an allergen to the user's SafePlate list. Idempotent: if an equivalent
 * allergen (case-insensitive) already exists, it's a no-op success and we bump
 * severity upward only (never downgrade an existing stricter severity).
 */
export async function addUserAllergy(
  userId: string,
  rawAllergen: string,
  severity: AllergySeverity = "high",
): Promise<AllergyWriteResult> {
  const allergen = canonicalizeAllergen(rawAllergen);
  if (!allergen || allergen.length > 60) {
    return { ok: false, allergen, changed: false, error: "invalid_allergen" };
  }

  const supabase = createClient();
  const { data: existing, error: readErr } = await supabase
    .from("user_allergies")
    .select("id, allergen, severity")
    .eq("user_id", userId);
  if (readErr) {
    console.error("addUserAllergy read:", readErr.message);
    return { ok: false, allergen, changed: false, error: readErr.message };
  }

  const match = (existing ?? []).find(
    (r) => r.allergen.toLowerCase() === allergen.toLowerCase(),
  );

  if (match) {
    // Already present — only escalate severity if the new one is stricter.
    const rank: Record<string, number> = { low: 1, medium: 2, high: 3 };
    if ((rank[severity] ?? 3) > (rank[match.severity] ?? 0)) {
      const { error: upErr } = await supabase
        .from("user_allergies")
        .update({ severity })
        .eq("id", match.id);
      if (upErr) {
        console.error("addUserAllergy escalate:", upErr.message);
        return { ok: false, allergen, changed: false, error: upErr.message };
      }
      return { ok: true, allergen, changed: true };
    }
    return { ok: true, allergen, changed: false };
  }

  const { error: insErr } = await supabase
    .from("user_allergies")
    .insert({ user_id: userId, allergen, severity });
  if (insErr) {
    console.error("addUserAllergy insert:", insErr.message);
    return { ok: false, allergen, changed: false, error: insErr.message };
  }
  return { ok: true, allergen, changed: true };
}

/**
 * Remove an allergen from the user's SafePlate list (case-insensitive match).
 * No-op success if it wasn't there.
 */
export async function removeUserAllergy(
  userId: string,
  rawAllergen: string,
): Promise<AllergyWriteResult> {
  const allergen = canonicalizeAllergen(rawAllergen);
  if (!allergen) {
    return { ok: false, allergen, changed: false, error: "invalid_allergen" };
  }

  const supabase = createClient();
  const { data: existing, error: readErr } = await supabase
    .from("user_allergies")
    .select("id, allergen")
    .eq("user_id", userId);
  if (readErr) {
    console.error("removeUserAllergy read:", readErr.message);
    return { ok: false, allergen, changed: false, error: readErr.message };
  }

  const match = (existing ?? []).find(
    (r) => r.allergen.toLowerCase() === allergen.toLowerCase(),
  );
  if (!match) return { ok: true, allergen, changed: false };

  const { error: delErr } = await supabase
    .from("user_allergies")
    .delete()
    .eq("id", match.id);
  if (delErr) {
    console.error("removeUserAllergy delete:", delErr.message);
    return { ok: false, allergen, changed: false, error: delErr.message };
  }
  return { ok: true, allergen, changed: true };
}
