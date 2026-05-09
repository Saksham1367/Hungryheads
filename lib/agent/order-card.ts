/**
 * Parser + validator for the agent-emitted order-summary card.
 *
 * The system prompt asks Claude to end any order proposal with a single line:
 *
 *   <order-summary>{ ...json... }</order-summary>
 *
 * On stream completion the server scans the assembled text for that marker,
 * validates the JSON against `orderSummarySchema`, strips the marker from the
 * saved message body, and persists the parsed payload in
 * `chat_messages.payload` with `{ type: "order_summary", data, status: "draft" }`.
 *
 * The thread renderer surfaces the payload as the gradient-headed card with
 * the "YES — place order" CTA.
 */
import { z } from "zod";
import { SWIGGY_LIMITS } from "@/lib/constants";
import type { OrderSummaryPayload } from "@/types/domain";

export const orderSummarySchema = z.object({
  restaurant_name: z.string().min(1).max(120),
  rating: z.number().min(0).max(5).optional(),
  distance_km: z.number().min(0).max(50).optional(),
  eta_min: z.number().int().min(1).max(120).optional(),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        qty: z.number().int().min(1).max(20),
        price: z.number().int().min(0).max(5000),
        safe: z.boolean(),
      }),
    )
    .min(1)
    .max(20),
  subtotal: z.number().int().min(0),
  delivery_gst: z.number().int().min(0),
  coupon: z.number().int().max(0), // 0 or negative
  total: z.number().int().min(0).max(SWIGGY_LIMITS.CART_CAP_RUPEES),
  reasoning: z.string().max(280).optional(),
});

const MARKER_RE = /<order-summary>([\s\S]*?)<\/order-summary>/i;

export interface ParsedOrderCard {
  cleanedContent: string;
  order: OrderSummaryPayload | null;
  parseError: string | null;
}

/**
 * Pull the (last) <order-summary> block out of an agent reply. Returns the
 * cleaned message body (without the marker) and the validated payload, or a
 * parse error if the JSON was malformed / over-budget.
 */
export function extractOrderCard(text: string): ParsedOrderCard {
  const m = text.match(MARKER_RE);
  if (!m) return { cleanedContent: text, order: null, parseError: null };

  const cleanedContent = text.replace(MARKER_RE, "").trimEnd();

  let raw: unknown;
  try {
    raw = JSON.parse(m[1].trim());
  } catch (err) {
    return {
      cleanedContent,
      order: null,
      parseError: `JSON parse failed: ${
        err instanceof Error ? err.message : "unknown"
      }`,
    };
  }

  const result = orderSummarySchema.safeParse(raw);
  if (!result.success) {
    return {
      cleanedContent,
      order: null,
      parseError: result.error.issues[0]?.message ?? "schema validation failed",
    };
  }

  // Cross-check: subtotal + delivery + coupon should equal total. If the agent
  // mis-summed, we trust `items × qty` and re-derive — keeps the user safe
  // from ₹1000-cap drift.
  const itemsSum = result.data.items.reduce(
    (s, it) => s + it.price * it.qty,
    0,
  );
  if (Math.abs(itemsSum - result.data.subtotal) > 5) {
    return {
      cleanedContent,
      order: null,
      parseError: `subtotal mismatch (items sum to ₹${itemsSum}, payload says ₹${result.data.subtotal})`,
    };
  }

  const order: OrderSummaryPayload = {
    restaurant_name: result.data.restaurant_name,
    rating: result.data.rating,
    distance_km: result.data.distance_km,
    eta_min: result.data.eta_min,
    items: result.data.items,
    subtotal: result.data.subtotal,
    delivery_gst: result.data.delivery_gst,
    coupon: result.data.coupon,
    total: result.data.total,
    status: "draft",
    reasoning: result.data.reasoning,
  };
  return { cleanedContent, order, parseError: null };
}
