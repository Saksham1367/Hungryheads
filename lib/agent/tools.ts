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
  {
    name: "place_food_order",
    description:
      "Place the order. COD only in v1. ₹1000 cap enforced. NOT idempotent: in production, on 5xx you MUST call get_food_orders to verify before retrying (docs §8). Always show the cart summary + total to the user and get explicit confirmation before invoking this.",
    input_schema: {
      type: "object",
      properties: {
        paymentMethod: { type: "string", enum: ["COD"] },
      },
    },
  },
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
];

// ─── Dispatcher (server-side) ───────────────────────────────────────────────

export interface ToolDispatchResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface ToolDispatchContext {
  /** Authenticated Supabase user id; required for cart-scoped tools. */
  userId: string;
}

export function runTool(
  name: string,
  input: unknown,
  ctx: ToolDispatchContext,
): ToolDispatchResult {
  const started = Date.now();
  const result = dispatch(name, input, ctx);
  logToolCall({
    tool: name,
    ok: result.ok,
    duration_ms: Date.now() - started,
    user_id_hash: hashUserId(ctx.userId),
  });
  return result;
}

function dispatch(
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
