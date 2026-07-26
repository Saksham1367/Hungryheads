/**
 * Live Swiggy Food dispatch (Step 12, MCP_MODE=live).
 *
 * Mirrors the mock dispatcher's tool surface (lib/swiggy/mock.ts) but routes
 * each call to the real Swiggy Food MCP server via {@link SwiggyMcpSession}.
 * One dispatcher (and one session) lives for the duration of a single chat
 * request's tool loop, then is closed.
 *
 * What is DOCUMENTED and fixed here (from the Builders Club spec):
 *   - param renames: restaurant_id→restaurantId, code→couponCode, items→cartItems
 *   - addressId is required on search / menu / cart / coupon calls
 *   - the { success, data } envelope (unwrapped inside SwiggyMcpSession)
 *
 * What is NOT fully documented and marked `VERIFY at creds-time`: the exact
 * RESPONSE field shapes per tool. We don't need most of them — the agent
 * consumes the JSON directly, so we pass `data` straight through. The only
 * places we read into a response are addressId resolution and (Phase C) the
 * SafePlate scan over menu text.
 */
import { SwiggyMcpError, type SwiggyMcpSession } from "@/lib/swiggy/mcp-client";
import { scanTextForAllergens } from "@/lib/safeplate/keywords";
import type { ToolDispatchResult } from "@/lib/agent/tools";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/**
 * Find the delivery addressId in a get_addresses response. VERIFY at creds-time:
 * confirm the field is `addressId` and the array location. We try the two most
 * likely shapes (top-level array, or `{ addresses: [...] }`) and prefer "Home".
 */
/**
 * SafePlate Layer-2 over a LIVE menu response. The live menu API exposes NO
 * allergen_tags, so the deterministic keyword scan (over item name + any
 * description text) is the only pre-checkout allergen defence on live data.
 * Items whose text hits an excluded allergen are dropped before the agent sees
 * them — mirroring the mock's menu-time filter.
 *
 * VERIFY at creds-time: confirm where menu items live in the real response and
 * the item text field names. We handle the two most likely shapes (a top-level
 * array, or `{ items: [...] }`); anything else is returned unfiltered and the
 * DETERMINISTIC checkout guard (placeOrderFromMessage → checkOrder) remains the
 * hard backstop, so an allergen can never actually reach the cart.
 */
function scanItemUnsafe(item: Record<string, unknown>, exclude: string[]): boolean {
  const name = asString(item.name) ?? asString(item.itemName) ?? "";
  const desc = asString(item.description) ?? asString(item.desc) ?? "";
  if (!name && !desc) return false; // not an item-like object — keep it
  return scanTextForAllergens(`${name}. ${desc}`, exclude).length > 0;
}

function filterMenuItems(arr: unknown[], exclude: string[]): unknown[] {
  return arr.filter((it) => !scanItemUnsafe(asRecord(it), exclude));
}

function applyLiveSafePlate(data: unknown, exclude: string[]): unknown {
  if (exclude.length === 0) return data;
  if (Array.isArray(data)) return filterMenuItems(data, exclude);
  const rec = asRecord(data);
  if (Array.isArray(rec.items)) {
    return { ...rec, items: filterMenuItems(rec.items as unknown[], exclude) };
  }
  return data; // unknown nesting → checkout guard is the backstop
}

function pickAddressId(data: unknown): string | null {
  const rec = asRecord(data);
  const list: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(rec.addresses)
      ? (rec.addresses as unknown[])
      : [];
  if (list.length === 0) return null;
  const home =
    list.find((a) => /home/i.test(asString(asRecord(a).label) ?? "")) ?? list[0];
  const h = asRecord(home);
  return asString(h.addressId) ?? asString(h.id);
}

export class LiveSwiggyDispatcher {
  private addressId: string | null = null;

  constructor(private readonly session: SwiggyMcpSession) {}

  /** Close the underlying MCP session. Call once the tool loop is done. */
  async close(): Promise<void> {
    await this.session.close();
  }

  /**
   * Resolve (and cache) the user's default delivery addressId — required by
   * most live Food tools. Uses the "Home" address, else the first.
   */
  private async resolveAddressId(): Promise<string> {
    if (this.addressId) return this.addressId;
    const data = await this.session.callTool("get_addresses", {});
    const id = pickAddressId(data);
    if (!id) {
      throw new SwiggyMcpError(
        "not_found",
        "No delivery address on your Swiggy account — add one in the Swiggy app first.",
      );
    }
    this.addressId = id;
    return id;
  }

  /** Dispatch one agent tool call to the live MCP server. */
  async dispatch(name: string, input: unknown): Promise<ToolDispatchResult> {
    try {
      const data = await this.route(name, asRecord(input));
      return { ok: true, data };
    } catch (err) {
      if (err instanceof SwiggyMcpError) {
        // The agent sees this as a tool error and can relay it. Reauth is also
        // surfaced by the route (session open) so the user gets a reconnect CTA.
        return { ok: false, error: err.message };
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : "tool_failed",
      };
    }
  }

  private async route(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    switch (name) {
      case "get_addresses": {
        const data = await this.session.callTool("get_addresses", {});
        const id = pickAddressId(data);
        if (id) this.addressId = id; // cache for downstream calls
        return data;
      }

      case "search_restaurants": {
        const addressId = await this.resolveAddressId();
        // Live requires a non-empty query. Fall back to the cuisine list, then
        // a generic term, so a bare "find me food" still returns results.
        const cuisines = Array.isArray(args.cuisines)
          ? (args.cuisines as unknown[]).map(String).join(", ")
          : "";
        const query =
          (asString(args.query) ?? "").trim() || cuisines || "restaurants";
        const params: Record<string, unknown> = { addressId, query };
        if (typeof args.offset === "number") params.offset = args.offset;
        return this.session.callTool("search_restaurants", params);
      }

      case "get_restaurant_menu": {
        const addressId = await this.resolveAddressId();
        const restaurantId =
          asString(args.restaurant_id) ?? asString(args.restaurantId);
        if (!restaurantId) {
          throw new SwiggyMcpError("validation", "restaurant id is required");
        }
        const menu = await this.session.callTool("get_restaurant_menu", {
          addressId,
          restaurantId,
        });
        // Live menu has NO allergen_tags → run the SafePlate keyword scan over
        // item text and drop unsafe items before the agent sees them.
        const exclude = Array.isArray(args.exclude_allergens)
          ? (args.exclude_allergens as unknown[]).map(String)
          : [];
        return applyLiveSafePlate(menu, exclude);
      }

      case "update_food_cart": {
        const addressId = await this.resolveAddressId();
        const restaurantId = asString(args.restaurantId);
        if (!restaurantId) {
          throw new SwiggyMcpError("validation", "restaurantId is required");
        }
        // Map our simple {itemId, quantity} lines to live `cartItems`. VERIFY at
        // creds-time: items with variants/variantsV2/addons need the SAME shape
        // the menu item exposes — extend this once we see real menu payloads.
        const rawItems = Array.isArray(args.items) ? args.items : [];
        const cartItems = rawItems.map((it) => {
          const r = asRecord(it);
          return { itemId: r.itemId, quantity: r.quantity };
        });
        return this.session.callTool("update_food_cart", {
          addressId,
          restaurantId,
          cartItems,
        });
      }

      case "get_food_cart": {
        const addressId = await this.resolveAddressId();
        return this.session.callTool("get_food_cart", { addressId });
      }

      case "flush_food_cart": {
        const addressId = await this.resolveAddressId();
        return this.session.callTool("flush_food_cart", { addressId });
      }

      case "fetch_food_coupons": {
        const addressId = await this.resolveAddressId();
        return this.session.callTool("fetch_food_coupons", { addressId });
      }

      case "apply_food_coupon": {
        const addressId = await this.resolveAddressId();
        const couponCode = asString(args.code) ?? asString(args.couponCode);
        if (!couponCode) {
          throw new SwiggyMcpError("validation", "coupon code is required");
        }
        return this.session.callTool("apply_food_coupon", {
          addressId,
          couponCode,
        });
      }

      case "track_food_order": {
        const orderId = asString(args.orderId);
        return this.session.callTool(
          "track_food_order",
          orderId ? { orderId } : {},
        );
      }

      case "get_food_orders":
        return this.session.callTool("get_food_orders", {});

      case "report_error": {
        const summary =
          asString(args.summary) ?? "User-reported issue from HungryHeads.";
        return this.session.callTool("report_error", { summary });
      }

      default:
        throw new SwiggyMcpError("validation", `unknown tool: ${name}`);
    }
  }
}
