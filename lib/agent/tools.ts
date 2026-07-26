/**
 * Anthropic tool definitions for the HungryHeads agent.
 *
 * Mirrors the canonical Swiggy Builders Club Food server surface (docs §6.1).
 * In MCP_MODE=mock we fulfil from `lib/swiggy/mock.ts` against fixtures + an
 * in-memory cart store. Step 12 will swap each dispatch entry for a live MCP
 * client call once Builders Club credentials are issued.
 *
 * Spec contract the agent honours:
 *   - `get_addresses` runs first (cardinal rule #1).
 *   - Cart is per-restaurant on Food; `update_food_cart` is idempotent.
 *   - Always `get_food_cart` before `place_food_order`.
 *   - Filter coupons with `requiresOnlinePayment` before applying (COD-only v1).
 *   - ₹1000 cart cap; `place_food_order` rejects above it.
 *   - `place_food_order` is NOT idempotent — Step 12 must implement
 *     check-then-retry via `get_food_orders` on 5xx (docs §8).
 *   - Never poll `track_food_order` faster than 10s.
 */
import type Anthropic from "@anthropic-ai/sdk";
import {
  applyFoodCoupon,
  fetchFoodCoupons,
  flushFoodCart,
  getFoodCart,
  getFoodOrders,
  getMockAddresses,
  getRestaurantMenu,
  placeFoodOrder,
  reportError,
  searchRestaurants,
  trackFoodOrder,
  updateFoodCart,
  type GetMenuArgs,
  type SearchRestaurantsArgs,
  type UpdateFoodCartArgs,
} from "@/lib/swiggy/mock";
import { logToolCall, hashUserId } from "@/lib/agent/logger";

// ─── Tool definitions (sent to Anthropic) ───────────────────────────────────

export const AGENT_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "get_addresses",
    description:
      "Get all saved delivery addresses for the authenticated Swiggy user. Returns label, addressId, and display text. ALWAYS call this FIRST before any food / grocery search — every downstream tool needs the addressId.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "search_restaurants",
    description:
      "Search restaurants for food delivery at the user's address. Requires addressId from get_addresses. Filters by free-text, cuisines, veg-only, and max distance. Returns up to `limit` results sorted by rating then distance.",
    input_schema: {
      type: "object",
      properties: {
        addressId: {
          type: "string",
          description:
            "The user's delivery address id (from get_addresses). REQUIRED in live MCP; in mock it's accepted but unused.",
        },
        query: {
          type: "string",
          description:
            "Free-text matched against name, cuisines, neighborhood. Empty/omitted to list everything.",
        },
        cuisines: {
          type: "array",
          items: { type: "string" },
          description:
            "Cuisine filter — match any. Common: Biryani, North Indian, South Indian, Chinese, Italian, Pizza, Burgers, Healthy, Continental, Desserts.",
        },
        veg_only: { type: "boolean", description: "If true, only pure-veg restaurants." },
        max_distance_km: {
          type: "number",
          description: "Max km from user. Defaults to 10.",
        },
        limit: { type: "number", description: "Max results (1–20). Defaults to 8." },
      },
    },
  },
  {
    name: "get_restaurant_menu",
    description:
      "Fetch a restaurant's menu. Filter out items the user is allergic to via `exclude_allergens`. Use AFTER search_restaurants to pick items.",
    input_schema: {
      type: "object",
      properties: {
        restaurant_id: { type: "string", description: "Restaurant id from search_restaurants." },
        exclude_allergens: {
          type: "array",
          items: { type: "string" },
          description:
            "Allergen tags to remove. Examples: peanuts, tree nuts, dairy, gluten, eggs, shellfish, soy, sesame.",
        },
        veg_only: { type: "boolean", description: "If true, only veg items." },
        max_price: { type: "number", description: "Cap individual item price in rupees." },
      },
      required: ["restaurant_id"],
    },
  },
  {
    name: "update_food_cart",
    description:
      "Add items to (or update quantities in) the food delivery cart. Idempotent on session — retrying the same args won't double-add. Cart is per-restaurant; switching restaurants FLUSHES the previous cart and the response will set `flushed_from`.",
    input_schema: {
      type: "object",
      properties: {
        restaurantId: { type: "string", description: "Restaurant id the cart belongs to." },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              itemId: { type: "string" },
              quantity: { type: "number" },
            },
            required: ["itemId", "quantity"],
          },
        },
      },
      required: ["restaurantId", "items"],
    },
  },
  {
    name: "get_food_cart",
    description:
      "Read the current cart with items, totals, and whether it exceeds the ₹1000 Builders Club cap. ALWAYS call this before `place_food_order` to show the user a confirmation.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "flush_food_cart",
    description:
      "Empty the food cart. Use when the user wants to start over or when you're about to change restaurants and want to do it explicitly.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "fetch_food_coupons",
    description:
      "List coupons available for the current cart. CRITICAL: filter out coupons where `requiresOnlinePayment` is true — v1 is COD-only and those will fail.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "apply_food_coupon",
    description:
      "Apply a coupon code to the cart. Will reject coupons that require online payment with `COUPON_REQUIRES_ONLINE_PAYMENT`.",
    input_schema: {
      type: "object",
      properties: { code: { type: "string" } },
      required: ["code"],
    },
  },
  // NOTE: `place_food_order` is deliberately NOT an agent tool. Placing an
  // order spends real money, so it must never be reachable by the model (a
  // prompt-injected message/attachment could otherwise trigger it). The ONLY
  // path to a placed order is: agent calls `propose_order` -> user clicks the
  // "YES — place order" button -> the placeOrderFromMessage server action.
  // At Step 12 that server action (not the LLM) calls the live MCP
  // place_food_order behind the human confirmation, with check-then-retry.
  {
    name: "track_food_order",
    description:
      "Get the current status + ETA for a placed order. Do NOT poll faster than every 10 seconds (master rule #18 — the response carries `minPollIntervalMs` enforcing this).",
    input_schema: {
      type: "object",
      properties: { orderId: { type: "string" } },
      required: ["orderId"],
    },
  },
  {
    name: "get_food_orders",
    description:
      "Get the user's recent orders. Use to show history OR — after a 5xx on place_food_order — to verify the order didn't actually go through before retrying.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "report_error",
    description:
      "Open an in-session error report when the user explicitly says 'report this' / 'this is broken'. Returns a pre-filled diagnostic link with the session id pre-attached. Do NOT call this for routine errors you can recover from.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "One-line description of the issue from the user." },
      },
    },
  },
  {
    // NOTE: handled directly in app/api/chat/route.ts (async Supabase write to
    // user_allergies), NOT in the synchronous runTool dispatcher. HungryHeads-
    // internal, not a Swiggy MCP tool.
    name: "update_allergy",
    description:
      "Add or remove a food allergy / intolerance on the user's SafePlate profile. THIS IS A SAFETY ACTION — call it whenever the user states (or retracts) an allergy or a hard 'I can't eat X' intolerance, e.g. 'I'm allergic to peanuts', 'mushrooms make me sick', 'actually I'm fine with dairy now'. Saving here makes SafePlate HARD-BLOCK that ingredient at checkout — it is NOT the same as remember_preference (which is soft conversational memory). For allergies, ALWAYS use update_allergy. Call it immediately and silently, one call per allergen.",
    input_schema: {
      type: "object",
      properties: {
        allergen: {
          type: "string",
          description:
            "The ingredient to block, lowercase singular where natural. Examples: 'peanuts', 'mushrooms', 'dairy', 'shellfish', 'soy'.",
        },
        action: {
          type: "string",
          enum: ["add", "remove"],
          description:
            "'add' when the user reveals an allergy/intolerance (default); 'remove' only when they explicitly say it no longer applies.",
        },
        severity: {
          type: "string",
          enum: ["high", "medium", "low"],
          description:
            "How serious. 'high' = dangerous/anaphylactic (default, hard block). 'medium' = strong intolerance (hard block). 'low' = mild dislike (note only, does NOT block). When unsure, use 'high'.",
        },
      },
      required: ["allergen"],
    },
  },
  {
    // NOTE: handled directly in app/api/chat/route.ts (async Supabase write to
    // agent_memory), NOT in the synchronous runTool dispatcher below. It is a
    // HungryHeads-internal tool, not a Swiggy MCP tool, so it deliberately
    // stays out of the dispatch that Step 12 swaps for the live MCP client.
    name: "remember_preference",
    description:
      "Save a STABLE, long-term fact about the user so you can recall it in future conversations. Call this the moment the user reveals a durable preference or constraint — a cuisine or dish they love or hate, an allergy or dietary rule, a budget habit, a go-to restaurant, a recurring schedule. Call it immediately, without asking permission, and use one call per distinct fact. Do NOT save one-off moods ('wants pizza tonight'), and do NOT re-save something already listed in LONG-TERM MEMORY.",
    input_schema: {
      type: "object",
      properties: {
        fact: {
          type: "string",
          description:
            "One short, self-contained sentence written in third person about the user. Example: 'Loves Hyderabadi biryani', 'Allergic to peanuts (severe)', 'Keeps weekday dinners under ₹300'.",
        },
        category: {
          type: "string",
          enum: [
            "cuisine",
            "allergy",
            "diet",
            "budget",
            "place",
            "dislike",
            "schedule",
            "other",
          ],
          description: "Rough kind of fact — helps you keep memories tidy.",
        },
        confidence: {
          type: "number",
          description:
            "0–1 how sure you are this is stable. Explicit statements ('I'm allergic to X') are ~0.95; softer signals ('I usually go for…') are ~0.7.",
        },
      },
      required: ["fact"],
    },
  },
  {
    // NOTE: handled directly in app/api/chat/route.ts. The server computes the
    // arithmetic + enforces the ₹1000 cap from this input, then renders the
    // order card — so a truncated reply or bad math can't produce a broken card.
    // HungryHeads-internal, not a Swiggy MCP tool.
    name: "propose_order",
    description:
      "Show the user a confirmable order card with a 'YES — place order' button. Call this ONLY when you've decided on a specific restaurant + specific items (from a real search_restaurants / get_restaurant_menu result this turn) and want the user to confirm. Supply the items and fees; the SERVER computes subtotal and total and enforces the ₹1000 cap — do NOT pre-sum them yourself. One call per reply. After calling it, write a short 1–2 sentence pitch; don't restate the line items in prose.",
    input_schema: {
      type: "object",
      properties: {
        restaurant_name: {
          type: "string",
          description: "Restaurant name, e.g. 'Paradise — Indiranagar'.",
        },
        rating: { type: "number", description: "Restaurant rating 0–5, if known." },
        distance_km: { type: "number", description: "Distance in km, if known." },
        eta_min: { type: "number", description: "Delivery ETA in minutes, if known." },
        items: {
          type: "array",
          description: "The line items. The server multiplies price × qty.",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Dish name from the menu." },
              qty: { type: "number", description: "Quantity (1–20)." },
              price: {
                type: "number",
                description: "Per-unit price in rupees (NOT price × qty).",
              },
              safe: {
                type: "boolean",
                description:
                  "True if allergen-safe for this user. Default true; set false only if you must surface a flagged item (SafePlate will block placement).",
              },
            },
            required: ["name", "qty", "price"],
          },
        },
        delivery_gst: {
          type: "number",
          description: "Combined delivery fee + GST in rupees. Use 0 if unknown.",
        },
        coupon_discount: {
          type: "number",
          description:
            "Coupon discount as a POSITIVE rupee amount (e.g. 25 for −₹25). Omit or 0 if none.",
        },
        reasoning: {
          type: "string",
          description:
            "One short line shown on the card, e.g. 'Peanut-safe, fits your ₹400 budget.'",
        },
      },
      required: ["restaurant_name", "items"],
    },
  },
];

// Prompt caching: the tool block is 100% static yet re-sent on every API call —
// and re-sent up to MAX_TOOL_TURNS times for a single user message inside the
// tool loop. Marking the FINAL tool with an ephemeral cache breakpoint tells
// Anthropic to cache the whole block (writes cost 1.25×, reads 0.1× — a 90%
// discount, 5-min TTL refreshed on each hit). Applied to the last element
// programmatically so it stays correct if tools are reordered.
if (AGENT_TOOLS.length > 0) {
  AGENT_TOOLS[AGENT_TOOLS.length - 1].cache_control = { type: "ephemeral" };
}

// ─── Dispatcher (server-side) ───────────────────────────────────────────────

export interface ToolDispatchResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface ToolDispatchContext {
  /** Authenticated Supabase user id; required for cart-scoped tools. */
  userId: string;
  /**
   * Live Swiggy dispatcher. Set only when MCP_MODE=live — tools then go to the
   * real Swiggy Food MCP server instead of the fixture mock. Null/undefined in
   * mock mode. Typed loosely to avoid a runtime import cycle with live.ts.
   */
  live?: LiveDispatcher | null;
}

/** Structural type for lib/swiggy/live.ts's LiveSwiggyDispatcher. */
export interface LiveDispatcher {
  dispatch(name: string, input: unknown): Promise<ToolDispatchResult>;
}

export async function runTool(
  name: string,
  input: unknown,
  ctx: ToolDispatchContext,
): Promise<ToolDispatchResult> {
  const started = Date.now();
  const result = ctx.live
    ? await ctx.live.dispatch(name, input)
    : dispatchMock(name, input, ctx);
  logToolCall({
    tool: name,
    ok: result.ok,
    duration_ms: Date.now() - started,
    user_id_hash: hashUserId(ctx.userId),
  });
  return result;
}

function dispatchMock(
  name: string,
  input: unknown,
  ctx: ToolDispatchContext,
): ToolDispatchResult {
  try {
    switch (name) {
      case "get_addresses":
        return { ok: true, data: getMockAddresses() };

      case "search_restaurants": {
        const args = (input ?? {}) as SearchRestaurantsArgs;
        return { ok: true, data: searchRestaurants(args) };
      }

      case "get_restaurant_menu": {
        const args = (input ?? {}) as GetMenuArgs;
        if (!args.restaurant_id) {
          return { ok: false, error: "restaurant_id is required" };
        }
        const data = getRestaurantMenu(args);
        if (!data) return { ok: false, error: "restaurant not found" };
        return { ok: true, data };
      }

      case "update_food_cart": {
        const args = (input ?? {}) as UpdateFoodCartArgs;
        if (!args.restaurantId || !Array.isArray(args.items)) {
          return { ok: false, error: "restaurantId and items are required" };
        }
        return { ok: true, data: updateFoodCart(ctx.userId, args) };
      }

      case "get_food_cart":
        return { ok: true, data: getFoodCart(ctx.userId) };

      case "flush_food_cart":
        return { ok: true, data: flushFoodCart(ctx.userId) };

      case "fetch_food_coupons":
        return { ok: true, data: fetchFoodCoupons() };

      case "apply_food_coupon": {
        const args = (input ?? {}) as { code?: string };
        if (!args.code) return { ok: false, error: "code is required" };
        const r = applyFoodCoupon(ctx.userId, args.code);
        return r.ok ? { ok: true, data: r } : { ok: false, error: r.reason };
      }

      case "place_food_order": {
        const args = (input ?? {}) as { paymentMethod?: "COD" };
        const r = placeFoodOrder(ctx.userId, args.paymentMethod ?? "COD");
        return r.ok ? { ok: true, data: r } : { ok: false, error: r.reason };
      }

      case "track_food_order": {
        const args = (input ?? {}) as { orderId?: string };
        if (!args.orderId) return { ok: false, error: "orderId is required" };
        return { ok: true, data: trackFoodOrder(args.orderId) };
      }

      case "get_food_orders":
        return { ok: true, data: getFoodOrders(ctx.userId) };

      case "report_error":
        return { ok: true, data: reportError() };

      default:
        return { ok: false, error: `unknown tool: ${name}` };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "tool_run_failed",
    };
  }
}
