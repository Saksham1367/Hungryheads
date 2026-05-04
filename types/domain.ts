/**
 * HungryHeads domain types. Hand-written, stable across the app.
 * (Database row types live in `types/database.ts`, MCP wire types in `types/swiggy.ts`.)
 */

import type {
  ALLERGENS,
  CUISINES,
  DIETS,
  PERSONALITIES,
} from "@/lib/constants";

export type Cuisine = (typeof CUISINES)[number];
export type Allergen = (typeof ALLERGENS)[number];
export type Diet = (typeof DIETS)[number];
export type Personality = (typeof PERSONALITIES)[number]["id"];

export type AllergySeverity = "high" | "medium" | "low";

export type HuddleStatus =
  | "open"
  | "polling"
  | "decided"
  | "ordered"
  | "closed";

export type HuddleMode = "order_in" | "dine_out";

export type OrderSource = "food" | "instamart" | "dineout";

export type AgentContext = "dashboard" | "huddle" | "voice";
