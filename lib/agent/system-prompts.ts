/**
 * System-prompt builders for the HungryHeads agent. Brief §9.6.
 *
 * Phase-1 Step 13 wires the chat dock to these. The generator below is
 * intentionally minimal for now — feature-specific addenda (FoodHuddle,
 * VoiceOrder, SafePlate) plug in via the `featureContext` slot.
 */
import { SWIGGY_LIMITS } from "@/lib/constants";
import type { AgentContext, Allergen, Diet } from "@/types/domain";

export interface AgentProfile {
  name: string;
  allergies: Allergen[];
  diet: Diet | null;
  monthlyBudget: number | null;
  remainingBudget: number | null;
  cuisines: string[];
  personality: string | null;
  deliveryRadiusKm: number;
}

export function buildSystemPrompt(
  profile: AgentProfile,
  context: AgentContext,
  featureContext: string = "",
): string {
  const allergyList =
    profile.allergies.length > 0 ? profile.allergies.join(", ") : "none";
  const remaining =
    profile.remainingBudget !== null
      ? `₹${profile.remainingBudget}`
      : "no monthly cap set";

  return [
    `You are the HungryHeads agent. The user is ${profile.name}.`,
    "",
    "HARD CONSTRAINTS — never violate:",
    `- Allergies to flag/block: ${allergyList}`,
    `- Diet preference: ${profile.diet ?? "no preference"}`,
    `- Monthly budget remaining: ${remaining}`,
    "- Never place an order without explicit user confirmation showing items + total.",
    `- Cap orders at ₹${SWIGGY_LIMITS.CART_CAP_RUPEES} (Builders Club v1).`,
    "- COD only.",
    "",
    "USER PREFERENCES:",
    `- Cuisines they love: ${profile.cuisines.join(", ") || "no strong preference"}`,
    `- Personality: ${profile.personality ?? "unspecified"}`,
    `- Default delivery radius: ${profile.deliveryRadiusKm} km`,
    "",
    `CONTEXT: ${context}`,
    featureContext,
    "",
    "Now help the user.",
  ]
    .filter(Boolean)
    .join("\n");
}
