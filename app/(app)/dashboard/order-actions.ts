"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SWIGGY_LIMITS } from "@/lib/constants";
import { isSwiggyConnected } from "@/lib/swiggy/tokens";
import { checkOrder, loadAllergenProfile } from "@/lib/safeplate/filter";
import menus from "@/fixtures/mcp/menus.json";
import type { Json } from "@/types/database";
import type {
  ChatMessagePayload,
  OrderSummaryPayload,
} from "@/types/domain";

const menusById = menus as Record<
  string,
  {
    id: string;
    name: string;
    description?: string;
    allergen_tags: string[];
    is_veg: boolean;
  }[]
>;

export type PlaceOrderResult =
  | { ok: true; order: OrderSummaryPayload; orderId: string }
  | { ok: false; error: string };

/**
 * "YES — place order" handler.
 *
 * Phase 1: this writes the order into `orders_cache` (so SpendSmart and the
 * Overview drawer count it) and flips the chat message's payload status to
 * `placed`. Step 12 will additionally call Swiggy MCP `place_food_order` once
 * MCP_MODE=live and we have real credentials.
 */
export async function placeOrderFromMessage(
  messageId: string,
): Promise<PlaceOrderResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // A real order needs a linked Swiggy account. This is the server-side gate
  // behind the UI's "Connect Swiggy" CTA — even if the button is bypassed, no
  // order is placed without a valid token.
  if (!(await isSwiggyConnected(user.id))) {
    return {
      ok: false,
      error: "Connect your Swiggy account before placing an order.",
    };
  }

  // Pull the message + verify ownership via RLS-gated chat join.
  const { data: msg, error: msgErr } = await supabase
    .from("chat_messages")
    .select("id, chat_id, role, payload")
    .eq("id", messageId)
    .maybeSingle();
  if (msgErr || !msg) {
    return { ok: false, error: "Message not found." };
  }
  if (msg.role !== "agent") {
    return { ok: false, error: "Only agent messages can carry orders." };
  }

  const payload = msg.payload as ChatMessagePayload | null;
  if (!payload || payload.type !== "order_summary") {
    return { ok: false, error: "No order on this message." };
  }
  const order = payload.data;

  // Idempotency: if already placed, return the existing record.
  if (order.status === "placed" && order.swiggy_order_id) {
    return { ok: true, order, orderId: order.swiggy_order_id };
  }

  // Hard cap (defence-in-depth — schema already enforces).
  if (order.total > SWIGGY_LIMITS.CART_CAP_RUPEES) {
    return {
      ok: false,
      error: `Cart total ₹${order.total} exceeds Builders Club v1 cap of ₹${SWIGGY_LIMITS.CART_CAP_RUPEES}.`,
    };
  }

  // SafePlate hard guard. The agent's `safe` flags are advisory; we re-verify
  // server-side against the user's actual allergen + diet profile and reject
  // if anything fails. Defence-in-depth — even if the agent lied or got
  // confused about a tag, this catches it before any persistence.
  const profile = await loadAllergenProfile(user.id);
  const safeplateItems = order.items.map((it) => {
    // Try to look up the canonical allergen tags from fixtures via item name.
    // Falls back to whatever the agent flagged on the order card itself.
    const fixtureMatch = Object.values(menusById)
      .flat()
      .find((fi) => fi.name.toLowerCase() === it.name.toLowerCase());
    return {
      name: it.name,
      allergen_tags: fixtureMatch?.allergen_tags ?? [],
      // Feed the item's description into the deterministic keyword scan so an
      // allergen mentioned in the prose but missing from the tags is still
      // caught at checkout (dual-layer validation).
      ingredients_text: fixtureMatch?.description,
      is_veg: fixtureMatch?.is_veg,
      safe: it.safe,
    };
  });
  const verdict = checkOrder(safeplateItems, profile);
  if (!verdict.safe) {
    return {
      ok: false,
      error: `SafePlate blocked the order. ${verdict.reason}`,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // STEP 12 — replace with live MCP `place_food_order`. Spec contract:
  //
  //   `place_food_order` is NOT idempotent (docs §8, master rule #4). On 5xx
  //   or network failure DO NOT blind-retry — wait 2–5s, call `get_food_orders`,
  //   and treat the original call as success if the new order appears.
  //
  // Pseudocode for the live path:
  //
  //   const before = await mcp.callTool({ name: "get_food_orders" });
  //   try {
  //     order = await mcp.callTool({ name: "place_food_order",
  //                                  arguments: { paymentMethod: "COD" } });
  //   } catch (e) {
  //     if (e.status >= 500) {
  //       await sleep(3000);
  //       const after = await mcp.callTool({ name: "get_food_orders" });
  //       const placed = diffOrders(before, after);
  //       if (placed) order = placed; else throw e;   // genuine failure
  //     } else throw e;
  //   }
  //
  // Wall-clock retry budget capped at SWIGGY_LIMITS.RETRY_BUDGET_MS (30s).
  // ────────────────────────────────────────────────────────────────────────
  const mockOrderId = `mock_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  // Persist into orders_cache so SpendSmart + Overview drawer pick it up.
  const { error: cacheErr } = await supabase.from("orders_cache").insert({
    user_id: user.id,
    swiggy_order_id: mockOrderId,
    source: "food",
    total_amount: order.total,
    items: order.items as unknown as Json,
    restaurant_name: order.restaurant_name,
    ordered_at: new Date().toISOString(),
  });
  if (cacheErr) {
    return { ok: false, error: `Order log failed: ${cacheErr.message}` };
  }

  // Update the chat message's payload to "placed".
  const updatedOrder: OrderSummaryPayload = {
    ...order,
    status: "placed",
    swiggy_order_id: mockOrderId,
  };
  const updatedPayload: ChatMessagePayload = {
    type: "order_summary",
    data: updatedOrder,
  };
  const { data: updRows, error: updErr } = await supabase
    .from("chat_messages")
    .update({ payload: updatedPayload as unknown as Json })
    .eq("id", messageId)
    .select("id");
  if (updErr) {
    return { ok: false, error: `Status update failed: ${updErr.message}` };
  }
  if (!updRows || updRows.length === 0) {
    // Surfaced if RLS silently rejects the update — prevents the "looks placed
    // until refresh" bug from sneaking back in.
    return {
      ok: false,
      error:
        "Status update affected 0 rows — RLS policy missing? Run migration 0003.",
    };
  }

  revalidatePath("/dashboard");
  return { ok: true, order: updatedOrder, orderId: mockOrderId };
}

/** Cancel a draft order — flips status to 'cancelled'. */
export async function cancelDraftOrder(messageId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: msg } = await supabase
    .from("chat_messages")
    .select("payload")
    .eq("id", messageId)
    .maybeSingle();
  if (!msg) return;
  const payload = msg.payload as ChatMessagePayload | null;
  if (!payload || payload.type !== "order_summary") return;
  if (payload.data.status === "placed") return; // can't cancel a placed mock

  const updated: ChatMessagePayload = {
    type: "order_summary",
    data: { ...payload.data, status: "cancelled" },
  };
  await supabase
    .from("chat_messages")
    .update({ payload: updated as unknown as Json })
    .eq("id", messageId)
    .select("id");
  revalidatePath("/dashboard");
}
