"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SWIGGY_LIMITS } from "@/lib/constants";
import { isSwiggyConnected } from "@/lib/swiggy/tokens";
import { isMcpMockMode } from "@/lib/swiggy/oauth";
import { placeLiveFoodOrder } from "@/lib/swiggy/place-order-live";
import { checkRateLimitDistributed } from "@/lib/ratelimit";
import { categorizeSdkError, describeChatError } from "@/lib/chat/errors";
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

  // Rate-limit order placement per user — a placed order is a real,
  // money-spending, non-idempotent action, so cap automated/abusive retries.
  const rl = await checkRateLimitDistributed(`order:${user.id}`, 15, 60_000);
  if (!rl.ok) {
    return {
      ok: false,
      error: `Too many order attempts — try again in ${rl.retryAfterSeconds}s.`,
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
  // Resolve the order id. In live mode we place against the real Swiggy MCP
  // here — behind this human-confirmed action, never the agent — with the
  // spec's check-then-retry (see place-order-live.ts). In mock mode we mint a
  // synthetic id. Either way, placement happens BEFORE we persist below.
  let orderId: string;
  if (isMcpMockMode()) {
    orderId = `mock_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  } else {
    try {
      const placed = await placeLiveFoodOrder(user.id, order);
      orderId = placed.orderId;
    } catch (err) {
      // Sugar-coated, code-mapped message (reauth → "reconnect Swiggy", etc.).
      return { ok: false, error: describeChatError(categorizeSdkError(err)).detail };
    }
  }
  const updatedOrder: OrderSummaryPayload = {
    ...order,
    status: "placed",
    swiggy_order_id: orderId,
  };
  const updatedPayload: ChatMessagePayload = {
    type: "order_summary",
    data: updatedOrder,
  };

  // Idempotency guard against a double-order (e.g. two concurrent clicks):
  // atomically CLAIM the message by flipping it to "placed" ONLY if it isn't
  // already. The DB serialises these, so exactly one caller wins the update;
  // the loser gets 0 rows and returns the already-placed order instead of
  // logging a second one. This claim happens BEFORE the orders_cache insert so
  // we never write two order rows for one message.
  const { data: claimRows, error: claimErr } = await supabase
    .from("chat_messages")
    .update({ payload: updatedPayload as unknown as Json })
    .eq("id", messageId)
    .neq("payload->>status", "placed")
    .select("id");
  if (claimErr) {
    return { ok: false, error: `Status update failed: ${claimErr.message}` };
  }
  if (!claimRows || claimRows.length === 0) {
    // Lost the claim (already placed) OR RLS blocked us. Re-read: if it's
    // placed, return that order idempotently; otherwise surface the RLS hint.
    const { data: fresh } = await supabase
      .from("chat_messages")
      .select("payload")
      .eq("id", messageId)
      .maybeSingle();
    const freshPayload = fresh?.payload as ChatMessagePayload | null;
    if (
      freshPayload?.type === "order_summary" &&
      freshPayload.data.status === "placed" &&
      freshPayload.data.swiggy_order_id
    ) {
      return {
        ok: true,
        order: freshPayload.data,
        orderId: freshPayload.data.swiggy_order_id,
      };
    }
    return {
      ok: false,
      error:
        "Status update affected 0 rows — RLS policy missing? Run migration 0003.",
    };
  }

  // We won the claim — record the order for SpendSmart + the Overview drawer.
  const { error: cacheErr } = await supabase.from("orders_cache").insert({
    user_id: user.id,
    swiggy_order_id: orderId,
    source: "food",
    total_amount: order.total,
    items: order.items as unknown as Json,
    restaurant_name: order.restaurant_name,
    ordered_at: new Date().toISOString(),
  });
  if (cacheErr) {
    // Roll the claim back to a draft so the user can retry cleanly.
    const revertPayload: ChatMessagePayload = {
      type: "order_summary",
      data: order,
    };
    await supabase
      .from("chat_messages")
      .update({ payload: revertPayload as unknown as Json })
      .eq("id", messageId);
    return { ok: false, error: `Order log failed: ${cacheErr.message}` };
  }

  revalidatePath("/dashboard");
  return { ok: true, order: updatedOrder, orderId };
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
