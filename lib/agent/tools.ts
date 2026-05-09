/**
 * Anthropic tool definitions for the HungryHeads agent.
 *
 * The agent calls these to fetch real restaurant + menu data instead of
 * inventing it. Phase 1: dispatched against fixtures via `lib/swiggy/mock.ts`.
 * Step 12 wires them to the live Swiggy MCP HTTP client.
 */
import type Anthropic from "@anthropic-ai/sdk";
import {
  getRestaurantMenu,
  searchRestaurants,
  type GetMenuArgs,
  type SearchRestaurantsArgs,
} from "@/lib/swiggy/mock";

// ─── Tool definitions (sent to Anthropic) ───────────────────────────────────

export const AGENT_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "search_restaurants",
    description:
      "Search restaurants on Swiggy by free-text query, cuisine, veg-only, and max distance. Returns up to `limit` results sorted by rating desc then distance asc. Use this BEFORE proposing any order — never invent restaurants.",
    input_schema: {
      type: "object",
      properties: {
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
        veg_only: {
          type: "boolean",
          description: "If true, only pure-veg restaurants.",
        },
        max_distance_km: {
          type: "number",
          description: "Max km from user. Defaults to 10.",
        },
        limit: {
          type: "number",
          description: "Max results (1–20). Defaults to 8.",
        },
      },
    },
  },
  {
    name: "get_restaurant_menu",
    description:
      "Fetch a restaurant's menu. Filter out items the user is allergic to via `exclude_allergens`. Use this AFTER search_restaurants to choose specific items for an order.",
    input_schema: {
      type: "object",
      properties: {
        restaurant_id: {
          type: "string",
          description: "The restaurant's id from search_restaurants.",
        },
        exclude_allergens: {
          type: "array",
          items: { type: "string" },
          description:
            "Allergen tags to remove. Examples: peanuts, tree nuts, dairy, gluten, eggs, shellfish, soy, sesame.",
        },
        veg_only: {
          type: "boolean",
          description: "If true, only veg items.",
        },
        max_price: {
          type: "number",
          description: "Cap individual item price in rupees.",
        },
      },
      required: ["restaurant_id"],
    },
  },
];

// ─── Dispatcher (server-side) ───────────────────────────────────────────────

export interface ToolDispatchResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export function runTool(name: string, input: unknown): ToolDispatchResult {
  try {
    switch (name) {
      case "search_restaurants": {
        const args = (input ?? {}) as SearchRestaurantsArgs;
        const data = searchRestaurants(args);
        return { ok: true, data };
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
