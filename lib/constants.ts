/**
 * HungryHeads — shared constants. Single source of truth for the brief's hard
 * limits and enumerations (§4, §6, §13).
 */

export const BRAND = {
  name: "HungryHeads",
  tagline: "Decide. Order. Eat. Together.",
  contactEmail: "builders@swiggy.in",
} as const;

/** Swiggy Builders Club v1 hard caps — see brief §9.4 / §13. */
export const SWIGGY_LIMITS = {
  /** Max cart total in rupees. Exceeding this should be blocked client-side. */
  CART_CAP_RUPEES: 1000,
  /** Track-order polling cadence floor in ms. */
  TRACK_POLL_MIN_MS: 10_000,
  /** Wall-clock retry budget for any single MCP call. */
  RETRY_BUDGET_MS: 30_000,
} as const;

/** Onboarding Q1 — cuisine chips, brief §6. */
export const CUISINES = [
  "North Indian",
  "South Indian",
  "Chinese",
  "Italian",
  "Continental",
  "Healthy",
  "Street Food",
  "Desserts",
  "Biryani",
  "Pizza",
  "Burgers",
  "Healthy Bowls",
] as const;

/** Onboarding Q2 — allergy multi-select. */
export const ALLERGENS = [
  "Peanuts",
  "Tree Nuts",
  "Dairy",
  "Gluten",
  "Eggs",
  "Shellfish",
  "Soy",
  "Sesame",
] as const;

/** Onboarding Q2 — diet single-select. */
export const DIETS = [
  "Vegetarian",
  "Non-Vegetarian",
  "Vegan",
  "Jain",
  "Halal",
  "No Preference",
] as const;

/** Onboarding Q3 — budget bands in rupees (null = no limit). */
export const BUDGET_BANDS = [2000, 5000, 10000, 15000, null] as const;

/** Onboarding Q4 — delivery radius cards. */
export const RADIUS_OPTIONS = [2, 5, 10, 50] as const; // 50 = "anywhere"

/** Onboarding Q5 — food personality. */
export const PERSONALITIES = [
  { id: "spice-hunter", emoji: "🌶️", label: "Spice Hunter", blurb: "Bring the heat" },
  { id: "health-first", emoji: "🥗", label: "Health First", blurb: "Clean and fresh" },
  { id: "comfort-crew", emoji: "🍔", label: "Comfort Crew", blurb: "Give me my favourites" },
  { id: "adventure-eater", emoji: "🌍", label: "Adventure Eater", blurb: "Try something new" },
] as const;

/** The four HungryHeads features, used by dashboard + marketing sections. */
export const FEATURES = [
  {
    id: "safeplate",
    name: "SafePlate",
    tagline: "Allergy & diet safety net",
    href: "/safeplate",
  },
  {
    id: "spendsmart",
    name: "SpendSmart",
    tagline: "Monthly budget guardrail",
    href: "/spendsmart",
  },
  {
    id: "voiceorder",
    name: "VoiceOrder",
    tagline: "Speak-to-order + smart reorder",
    href: "/voiceorder",
  },
  {
    id: "foodhuddle",
    name: "FoodHuddle",
    tagline: "Group decision engine",
    href: "/huddle/new",
  },
] as const;

export type FeatureId = (typeof FEATURES)[number]["id"];
