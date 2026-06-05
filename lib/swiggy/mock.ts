/**
 * Fixture-backed Swiggy MCP mock. Read-only for discovery; cart/order tools
 * keep state via {@link "./cart-store"}. Step 12 swaps every export here for
 * real MCP calls when MCP_MODE=live.
 *
 * Fixtures live in `fixtures/mcp/`:
 *   - restaurants.json  (array of MockRestaurant)
 *   - menus.json        (record of restaurant_id → MockMenuItem[])
 */
import restaurantsJson from "@/fixtures/mcp/restaurants.json";
import menusJson from "@/fixtures/mcp/menus.json";
import {
  flushCart,
  readCart,
  tallyCart,
  writeCart,
  type MockCart,
} from "@/lib/swiggy/cart-store";
import { scanTextForAllergens } from "@/lib/safeplate/keywords";
import { SWIGGY_LIMITS } from "@/lib/constants";

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
      // Layer 1: structured tag match.
      const tags = item.allergen_tags.map((t) => t.toLowerCase());
      let hit = exclude.find((a) => tags.includes(a));
      // Layer 2: deterministic keyword scan over name + description, so an
      // allergen present in the prose but missing from the tags is still
      // filtered out before the agent ever sees the item.
      if (!hit) {
        const scanText = `${item.name}. ${item.description}`;
        hit = scanTextForAllergens(scanText, exclude)[0];
      }
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

// ─── get_addresses (Food MCP §6.1) ──────────────────────────────────────────
export interface MockAddress {
  addressId: string;
  label: string; // "Home" | "Work" | …
  display: string; // human-readable single line, no raw coordinates
}

/**
 * Synthetic address book. Live `get_addresses` returns label/addressId/display
 * with NO raw coordinates (docs §10.1 step 1). Mock surfaces a single "Home"
 * so the agent always has an addressId to pass downstream.
 */
export function getMockAddresses(): MockAddress[] {
  return [
    {
      addressId: "addr_home_mock",
      label: "Home",
      display: "Indiranagar, Bengaluru 560038",
    },
  ];
}

// ─── update_food_cart ───────────────────────────────────────────────────────
export interface UpdateFoodCartArgs {
  restaurantId: string;
  items: { itemId: string; quantity: number }[];
}

export interface UpdateFoodCartResult {
  ok: true;
  cart: ReturnType<typeof getFoodCart>;
  /** Set when adding items required flushing a prior restaurant's cart. */
  flushed_from?: string;
}

/**
 * Idempotent on session — re-running with the same args is safe. Cart is
 * per-restaurant; switching restaurants flushes (matches docs §5.1 + §11.2).
 */
export function updateFoodCart(
  userId: string,
  args: UpdateFoodCartArgs,
): UpdateFoodCartResult {
  const menu = menus[args.restaurantId] ?? [];
  const restaurant = restaurants.find((r) => r.id === args.restaurantId);
  if (!restaurant) {
    throw new Error(`restaurant ${args.restaurantId} not found`);
  }

  let cart = readCart(userId);
  let flushed_from: string | undefined;
  if (cart.restaurantId && cart.restaurantId !== args.restaurantId) {
    flushed_from = cart.restaurantName ?? cart.restaurantId;
    cart = {
      restaurantId: null,
      restaurantName: null,
      items: [],
      couponCode: null,
      couponDiscount: 0,
      placedOrderId: null,
    };
  }
  cart.restaurantId = restaurant.id;
  cart.restaurantName = restaurant.name;

  for (const next of args.items) {
    const meta = menu.find((m) => m.id === next.itemId);
    if (!meta) continue; // ignore unknown ids — keeps mock forgiving
    const existing = cart.items.find((l) => l.itemId === next.itemId);
    if (existing) {
      existing.quantity = next.quantity;
    } else {
      cart.items.push({
        itemId: meta.id,
        name: meta.name,
        quantity: next.quantity,
        unit_price: meta.price,
        is_veg: meta.is_veg,
        allergen_tags: meta.allergen_tags,
      });
    }
  }
  // Strip zero-qty lines so removing items via update is supported.
  cart.items = cart.items.filter((l) => l.quantity > 0);

  writeCart(userId, cart);
  return { ok: true, cart: getFoodCart(userId), flushed_from };
}

// ─── get_food_cart ──────────────────────────────────────────────────────────
export interface FoodCartView extends MockCart {
  totals: ReturnType<typeof tallyCart>;
  /** True when total exceeds Builders Club ₹1000 cap and order can't be placed. */
  exceeds_cap: boolean;
}

export function getFoodCart(userId: string): FoodCartView {
  const cart = readCart(userId);
  const totals = tallyCart(cart);
  return {
    ...cart,
    totals,
    exceeds_cap: totals.total > SWIGGY_LIMITS.CART_CAP_RUPEES,
  };
}

// ─── flush_food_cart ────────────────────────────────────────────────────────
export function flushFoodCart(userId: string): { ok: true } {
  flushCart(userId);
  return { ok: true };
}

// ─── fetch_food_coupons ─────────────────────────────────────────────────────
export interface MockCoupon {
  code: string;
  title: string;
  discount: number;
  /** Spec critical: docs §10.1 step 5 — filter these out for COD-only v1. */
  requiresOnlinePayment: boolean;
}

/**
 * Returns one COD-eligible and one online-only coupon so the agent can
 * demonstrate the spec-mandated filter (docs §10.1 step 5 + master rule #10).
 */
export function fetchFoodCoupons(): MockCoupon[] {
  return [
    {
      code: "WELCOME50",
      title: "₹50 off your first order",
      discount: 50,
      requiresOnlinePayment: false,
    },
    {
      code: "UPI20",
      title: "20% off with UPI",
      discount: 100,
      requiresOnlinePayment: true,
    },
  ];
}

// ─── apply_food_coupon ──────────────────────────────────────────────────────
export interface ApplyCouponResult {
  ok: boolean;
  /** Set when the coupon was rejected (e.g. requires online payment in COD-only v1). */
  reason?: string;
  cart?: FoodCartView;
}

export function applyFoodCoupon(
  userId: string,
  code: string,
): ApplyCouponResult {
  const coupon = fetchFoodCoupons().find(
    (c) => c.code.toLowerCase() === code.toLowerCase(),
  );
  if (!coupon) return { ok: false, reason: "COUPON_INVALID" };
  if (coupon.requiresOnlinePayment) {
    return {
      ok: false,
      reason: "COUPON_REQUIRES_ONLINE_PAYMENT (Builders Club v1 is COD-only)",
    };
  }
  const cart = readCart(userId);
  cart.couponCode = coupon.code;
  cart.couponDiscount = coupon.discount;
  writeCart(userId, cart);
  return { ok: true, cart: getFoodCart(userId) };
}

// ─── place_food_order ───────────────────────────────────────────────────────
export interface PlaceFoodOrderResult {
  ok: boolean;
  orderId?: string;
  total?: number;
  status?: "PLACED";
  /** Surfaced rejection — agent should explain and not blind-retry. */
  reason?: string;
}

/**
 * Mock placement. Spec contract preserved:
 *   - COD only (v1, docs §5.1).
 *   - ₹1000 cart cap (docs §5.1 + master rule #9).
 *   - NOT idempotent in production — agent must run check-then-retry on 5xx
 *     (docs §8 + master rule #4). In mock this returns deterministically so we
 *     don't have to fake transient failures.
 *
 * The real allergen / diet guard still runs in
 * `placeOrderFromMessage` — that's our SafePlate layer, defense-in-depth.
 */
export function placeFoodOrder(
  userId: string,
  paymentMethod: "COD" = "COD",
): PlaceFoodOrderResult {
  if (paymentMethod !== "COD") {
    return { ok: false, reason: "PAYMENT_METHOD_UNSUPPORTED (v1 is COD-only)" };
  }
  const view = getFoodCart(userId);
  if (view.items.length === 0) {
    return { ok: false, reason: "CART_EMPTY" };
  }
  if (view.exceeds_cap) {
    return {
      ok: false,
      reason: `CART_OVER_CAP (₹${view.totals.total} > ₹${SWIGGY_LIMITS.CART_CAP_RUPEES})`,
    };
  }
  if (view.placedOrderId) {
    // Idempotent re-call returns the existing order id.
    return {
      ok: true,
      orderId: view.placedOrderId,
      total: view.totals.total,
      status: "PLACED",
    };
  }
  const orderId = `mock_${Date.now().toString(36)}`;
  const cart = readCart(userId);
  cart.placedOrderId = orderId;
  writeCart(userId, cart);
  return { ok: true, orderId, total: view.totals.total, status: "PLACED" };
}

// ─── track_food_order ───────────────────────────────────────────────────────
export interface MockOrderStatus {
  orderId: string;
  status:
    | "PLACED"
    | "ACCEPTED_BY_RESTAURANT"
    | "FOOD_PREPARING"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED";
  etaMinutes: number;
  /** Polling rate ceiling — docs master rule #18: never poll faster than 10s. */
  minPollIntervalMs: number;
}

/**
 * Mock progression — synthesises a status that advances with time-since-placed
 * so the demo video can show the timeline.
 */
export function trackFoodOrder(orderId: string): MockOrderStatus {
  // Decode the timestamp we packed into the mock id.
  const created = decodeMockOrderTimestamp(orderId);
  const ageSec = (Date.now() - created) / 1000;
  let status: MockOrderStatus["status"] = "PLACED";
  if (ageSec > 60 * 25) status = "DELIVERED";
  else if (ageSec > 60 * 15) status = "OUT_FOR_DELIVERY";
  else if (ageSec > 60 * 5) status = "FOOD_PREPARING";
  else if (ageSec > 30) status = "ACCEPTED_BY_RESTAURANT";
  const etaMinutes = Math.max(0, 30 - Math.floor(ageSec / 60));
  return {
    orderId,
    status,
    etaMinutes,
    minPollIntervalMs: SWIGGY_LIMITS.TRACK_POLL_MIN_MS,
  };
}

function decodeMockOrderTimestamp(id: string): number {
  const stripped = id.replace(/^mock_/, "");
  const ts = parseInt(stripped, 36);
  return Number.isFinite(ts) && ts > 0 ? ts : Date.now();
}

// ─── get_food_orders ────────────────────────────────────────────────────────
export interface MockOrderSummary {
  orderId: string;
  restaurantName: string;
  total: number;
  placedAt: string;
  status: MockOrderStatus["status"];
}

/**
 * Recent orders for the user. In mock we surface the in-memory cart's placed
 * order if one exists, plus an empty list otherwise. Step 12 reads from the
 * live MCP `get_food_orders` response.
 */
export function getFoodOrders(userId: string): MockOrderSummary[] {
  const cart = readCart(userId);
  if (!cart.placedOrderId || !cart.restaurantName) return [];
  const status = trackFoodOrder(cart.placedOrderId);
  const totals = tallyCart(cart);
  return [
    {
      orderId: cart.placedOrderId,
      restaurantName: cart.restaurantName,
      total: totals.total,
      placedAt: new Date(
        decodeMockOrderTimestamp(cart.placedOrderId),
      ).toISOString(),
      status: status.status,
    },
  ];
}

// ─── report_error (Support, docs §6.1.Support) ──────────────────────────────
export interface MockErrorReport {
  reportId: string;
  reportLink: string;
}

/**
 * Mock parallel to Swiggy's in-session error reporter (docs §6.1.Support).
 * Step 12 forwards to the real MCP `report_error` tool which returns a
 * pre-filled diagnostic link with the session id linked.
 */
export function reportError(): MockErrorReport {
  const reportId = `rep_${Math.random().toString(36).slice(2, 10)}`;
  return {
    reportId,
    reportLink: `https://hungryheads.example/mock-report/${reportId}`,
  };
}
