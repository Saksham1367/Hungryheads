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

// ──────────────────── User profile primitives ──────────────────────────────
export type Cuisine = (typeof CUISINES)[number];
export type Allergen = (typeof ALLERGENS)[number];
export type Diet = (typeof DIETS)[number];
export type Personality = (typeof PERSONALITIES)[number]["id"];
export type AllergySeverity = "high" | "medium" | "low";

// ──────────────────── Chat ─────────────────────────────────────────────────
/** The three agent modes — Hungry (default) / Diet / Budget. */
export type ChatMode = "hungry" | "diet" | "budget";

/** Roles of a single chat message. */
export type ChatMessageRole = "user" | "agent" | "system";

/** Discriminated union for the `chat_messages.payload` JSONB column. */
export type ChatMessagePayload =
  | { type: "order_summary"; data: OrderSummaryPayload }
  | { type: "memory_learned"; fact: string }
  | { type: "huddle_decision"; sessionId: string }
  | { type: "error"; error: ChatTurnErrorPayload };

/**
 * Persisted shape for a failed agent turn. Mirrors {@link ChatErrorInfo} in
 * `lib/chat/errors.ts` but lives in `types/domain.ts` so the DB layer can
 * import it without dragging in client-side helpers.
 */
export interface ChatTurnErrorPayload {
  code: string;
  title: string;
  detail: string;
  retryable: boolean;
}

export interface OrderSummaryPayload {
  restaurant_name: string;
  rating?: number;
  distance_km?: number;
  eta_min?: number;
  items: { name: string; qty: number; price: number; safe: boolean }[];
  subtotal: number;
  delivery_gst: number;
  coupon: number; // negative = discount
  total: number;
  /** lifecycle */
  status: "draft" | "placed" | "cancelled";
  swiggy_order_id?: string | null;
  /** rationale shown above the card */
  reasoning?: string;
}

// ──────────────────── Huddles ──────────────────────────────────────────────
/**
 * Persistent group lifecycle. Note: the `huddles.status` column is kept for
 * backwards-compat with 0001 but the live state of a decision lives on the
 * per-session `huddle_sessions.status` column added in 0002.
 */
export type HuddleStatus = "open" | "polling" | "decided" | "ordered" | "closed";

/** Per-session decision status (matches huddle_sessions.status). */
export type HuddleSessionStatus =
  | "polling"
  | "decided"
  | "ordered"
  | "cancelled";

export type HuddleMode = "order_in" | "dine_out";

// ──────────────────── Misc ─────────────────────────────────────────────────
export type OrderSource = "food" | "instamart" | "dineout";

/** Where the agent is being invoked from — used to bias the system prompt. */
export type AgentContext = "chat" | "huddle" | "voice";
