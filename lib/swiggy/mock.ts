/**
 * Fixture-backed Swiggy MCP mock. Read-only. Step 12 swaps in real MCP calls
 * when MCP_MODE=live.
 *
 * Fixtures live in `fixtures/mcp/`:
 *   - restaurants.json  (array of MockRestaurant)
 *   - menus.json        (record of restaurant_id → MockMenuItem[])
 */
import restaurantsJson from "@/fixtures/mcp/restaurants.json";
import menusJson from "@/fixtures/mcp/menus.json";

export interface MockRestaurant {
  id: string;
  name: string;
  neighborhood: string;
  cuisines: string[];
  rating: number;
  distance_km: number;
  delivery_time_min: number;
  cost_for_two: number;
  veg: boolean;
  open: boolean;
  image_url?: string;
}

export interface MockMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  is_veg: boolean;
  allergen_tags: string[];
}

const restaurants = restaurantsJson as MockRestaurant[];
const menus = menusJson as Record<string, MockMenuItem[]>;

// ─── search_restaurants ─────────────────────────────────────────────────────
export interface SearchRestaurantsArgs {
  /** Free-text — matches name OR cuisine substring case-insensitively. */
  query?: string;
  /** Filter to one or more cuisine names (matches any). */
  cuisines?: string[];
  /** Pure-veg only. */
  veg_only?: boolean;
  /** Max kilometers from user. */
  max_distance_km?: number;
  /** Cap result list. */
  limit?: number;
}

export function searchRestaurants(
  args: SearchRestaurantsArgs,
): MockRestaurant[] {
  const q = args.query?.trim().toLowerCase() ?? "";
  const filterCuisines = args.cuisines?.map((c) => c.toLowerCase()) ?? [];
  const limit = Math.min(Math.max(args.limit ?? 8, 1), 20);

  return restaurants
    .filter((r) => r.open)
    .filter((r) => {
      if (args.veg_only && !r.veg) return false;
      if (
        args.max_distance_km != null &&
        r.distance_km > args.max_distance_km
      ) {
        return false;
      }
      if (filterCuisines.length > 0) {
        const lowered = r.cuisines.map((c) => c.toLowerCase());
        const hit = filterCuisines.some((c) => lowered.includes(c));
        if (!hit) return false;
      }
      if (q) {
        const hay =
          r.name.toLowerCase() +
          " " +
          r.cuisines.join(" ").toLowerCase() +
          " " +
          r.neighborhood.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Simple relevance: rating desc, then distance asc.
      if (b.rating !== a.rating) return b.rating - a.rating;
      return a.distance_km - b.distance_km;
    })
    .slice(0, limit);
}

// ─── get_restaurant_menu ────────────────────────────────────────────────────
export interface GetMenuArgs {
  restaurant_id: string;
  /** Filter out items with these allergens (case-insensitive). */
  exclude_allergens?: string[];
  /** Pure-veg only. */
  veg_only?: boolean;
  /** Max price per item. */
  max_price?: number;
}

export interface MenuResult {
  restaurant: MockRestaurant;
  items: MockMenuItem[];
  /** Items removed by filters — surfaced so the agent can mention substitutions. */
  filtered_out: { item: MockMenuItem; reason: string }[];
}

export function getRestaurantMenu(args: GetMenuArgs): MenuResult | null {
  const restaurant = restaurants.find((r) => r.id === args.restaurant_id);
  if (!restaurant) return null;

  const all = menus[args.restaurant_id] ?? [];
  const exclude = (args.exclude_allergens ?? []).map((a) => a.toLowerCase());
  const items: MockMenuItem[] = [];
  const filtered_out: { item: MockMenuItem; reason: string }[] = [];

  for (const item of all) {
    if (args.veg_only && !item.is_veg) {
      filtered_out.push({ item, reason: "non-veg" });
      continue;
    }
    if (args.max_price != null && item.price > args.max_price) {
      filtered_out.push({ item, reason: `> ₹${args.max_price}` });
      continue;
    }
    if (exclude.length) {
      const tags = item.allergen_tags.map((t) => t.toLowerCase());
      const hit = exclude.find((a) => tags.includes(a));
      if (hit) {
        filtered_out.push({ item, reason: `contains ${hit}` });
        continue;
      }
    }
    items.push(item);
  }
  return { restaurant, items, filtered_out };
}

// ─── your_go_to_items (Instamart, Phase 2 stub) ─────────────────────────────
export function yourGoToItems(): { name: string; price: number; cadence_days: number }[] {
  // Phase-1 placeholder — Phase 2 wires real Instamart history.
  return [
    { name: "Amul Taaza Milk 1L", price: 68, cadence_days: 5 },
    { name: "Britannia Brown Bread", price: 55, cadence_days: 7 },
    { name: "Aashirvaad Atta 5kg", price: 320, cadence_days: 21 },
  ];
}
