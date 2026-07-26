/**
 * Live server-side order placement (Step 12, MCP_MODE=live).
 *
 * SCAFFOLD. The check-then-retry CONTROL FLOW is complete and matches the spec:
 * `place_food_order` is NOT idempotent and has no idempotency key, so on a
 * retryable failure (5xx/timeout) we DON'T blind-retry — we wait, then verify
 * via `get_food_orders` whether the order actually went through before deciding
 * it failed (spec §8 / master rule #4).
 *
 * The SHAPE-SPECIFIC bits (how to read orderId/total out of the responses, and
 * whether the cart persists across requests) are marked `VERIFY at creds-time`
 * — they can only be finalised against real API responses.
 *
 * Called ONLY from placeOrderFromMessage (the human-clicked "YES" button) —
 * never by the agent. Server-only.
 */
import { openSwiggyMcpSession, SwiggyMcpError } from "@/lib/swiggy/mcp-client";
import type { OrderSummaryPayload } from "@/types/domain";

export interface LivePlacedOrder {
  orderId: string;
  total: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/** VERIFY at creds-time: confirm the addressId field + array location. */
function pickAddressId(data: unknown): string | null {
  const rec = asRecord(data);
  const list: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(rec.addresses)
      ? (rec.addresses as unknown[])
      : [];
  const home =
    list.find((a) => /home/i.test(asString(asRecord(a).label) ?? "")) ??
    list[0];
  const h = asRecord(home);
  return asString(h.addressId) ?? asString(h.id);
}

/** VERIFY at creds-time: confirm the orderId field name on the order object. */
function extractOrderId(data: unknown): string | null {
  const r = asRecord(data);
  return asString(r.orderId) ?? asString(r.order_id) ?? asString(r.id);
}

/** VERIFY at creds-time: confirm the total field name on the order object. */
function extractTotal(data: unknown): number | null {
  const r = asRecord(data);
  const t = r.total ?? r.totalAmount ?? r.total_amount;
  return typeof t === "number" ? t : null;
}

/** VERIFY at creds-time: confirm the orders array location for the diff. */
function orderIdSet(data: unknown): Set<string> {
  const rec = asRecord(data);
  const list: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(rec.orders)
      ? (rec.orders as unknown[])
      : [];
  const ids = new Set<string>();
  for (const o of list) {
    const id = extractOrderId(o);
    if (id) ids.add(id);
  }
  return ids;
}

/** An order id present in `after` but not `before` = the one we just placed. */
function findNewOrderId(before: unknown, after: unknown): string | null {
  const prior = orderIdSet(before);
  for (const id of orderIdSet(after)) {
    if (!prior.has(id)) return id;
  }
  return null;
}

/**
 * Place a confirmed order against the live Swiggy Food MCP server, with the
 * spec-mandated check-then-retry safety around the non-idempotent call.
 */
export async function placeLiveFoodOrder(
  userId: string,
  order: OrderSummaryPayload,
): Promise<LivePlacedOrder> {
  const session = await openSwiggyMcpSession(userId);
  try {
    const addresses = await session.callTool("get_addresses", {});
    const addressId = pickAddressId(addresses);
    if (!addressId) {
      throw new SwiggyMcpError(
        "not_found",
        "No delivery address on your Swiggy account.",
      );
    }

    // VERIFY at creds-time: the agent builds the cart via update_food_cart
    // during chat, and the Swiggy cart is server-side (should persist across
    // this separate request). If real testing shows it does NOT persist, re-
    // sync the cart here from `order.items` — which needs itemIds carried on the
    // order card (not stored today; add an `itemId` field to the order payload
    // + propose_order tool at that point).

    // Snapshot before placing so we can verify after a retryable failure.
    const before = await session.callTool("get_food_orders", {});

    try {
      const placed = await session.callTool("place_food_order", {
        addressId,
        paymentMethod: "COD",
      });
      const orderId = extractOrderId(placed);
      if (!orderId) {
        // VERIFY at creds-time: response shape. Fall back to a get_food_orders
        // diff rather than claiming success blindly.
        const after = await session.callTool("get_food_orders", {});
        const found = findNewOrderId(before, after);
        if (found) return { orderId: found, total: order.total };
        throw new SwiggyMcpError(
          "unknown",
          "Order response was missing an order id.",
        );
      }
      return { orderId, total: extractTotal(placed) ?? order.total };
    } catch (err) {
      // Non-idempotent: on a retryable failure, DON'T re-POST — verify instead.
      if (err instanceof SwiggyMcpError && err.retryable) {
        await sleep(3000);
        const after = await session.callTool("get_food_orders", {});
        const found = findNewOrderId(before, after);
        if (found) return { orderId: found, total: order.total };
      }
      throw err;
    }
  } finally {
    await session.close();
  }
}
