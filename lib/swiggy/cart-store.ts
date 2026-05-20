/**
 * In-memory Food cart store for MCP_MODE=mock.
 *
 * The real Swiggy MCP keeps cart state server-side keyed to the OAuth session
 * (docs §11.2). Until we have live credentials, we stash carts process-locally,
 * keyed by user id, so the agent can compose the canonical 7-tool flow:
 *
 *   get_addresses → search_restaurants → get_restaurant_menu
 *     → update_food_cart → get_food_cart
 *       → fetch_food_coupons → apply_food_coupon
 *         → place_food_order → track_food_order
 *
 * Spec contract preserved:
 *   - Cart is per-restaurant (changing restaurant flushes).
 *   - `update_food_cart` is idempotent on session.
 *   - Cart total respects the ₹1000 Builders Club cap at read time.
 */

export interface MockCartLine {
  itemId: string;
  name: string;
  quantity: number;
  unit_price: number;
  is_veg?: boolean;
  allergen_tags?: string[];
}

export interface MockCart {
  restaurantId: string | null;
  restaurantName: string | null;
  items: MockCartLine[];
  couponCode: string | null;
  couponDiscount: number;
  /** Mock order id once placed; cart freezes after this. */
  placedOrderId: string | null;
}

const carts = new Map<string, MockCart>();

const empty = (): MockCart => ({
  restaurantId: null,
  restaurantName: null,
  items: [],
  couponCode: null,
  couponDiscount: 0,
  placedOrderId: null,
});

export function readCart(userId: string): MockCart {
  return carts.get(userId) ?? empty();
}

export function writeCart(userId: string, c: MockCart): void {
  carts.set(userId, c);
}

export function flushCart(userId: string): void {
  carts.set(userId, empty());
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  total: number;
  itemCount: number;
}

export function tallyCart(c: MockCart): CartTotals {
  const subtotal = c.items.reduce(
    (s, it) => s + it.unit_price * it.quantity,
    0,
  );
  const discount = Math.min(subtotal, c.couponDiscount);
  return {
    subtotal,
    discount,
    total: Math.max(0, subtotal - discount),
    itemCount: c.items.reduce((n, it) => n + it.quantity, 0),
  };
}
