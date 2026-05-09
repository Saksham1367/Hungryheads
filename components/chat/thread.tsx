"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatRupees } from "@/lib/utils/format";
import type { ChatMessageView } from "@/lib/chat/types";
import type { OrderSummaryPayload } from "@/types/domain";
import { placeOrderFromMessage } from "@/app/(app)/dashboard/order-actions";

/**
 * Renders a list of chat turns. Markdown-ish: **bold** is the only inline mark
 * we honour for now (matches the prototype's rich text). Step 6d will replace
 * with a proper renderer (react-markdown w/ a tiny plugin set).
 */
export function ChatThread({ messages }: { messages: ChatMessageView[] }) {
  return (
    <div className="flex-1 overflow-y-auto py-8">
      <div className="max-w-[780px] mx-auto px-7 flex flex-col gap-7">
        {messages.map((m) => (
          <Turn key={m.id} message={m} />
        ))}
      </div>
    </div>
  );
}

function Turn({ message }: { message: ChatMessageView }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end w-full">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-hh-orange text-white px-4 py-3 text-sm leading-relaxed shadow-md shadow-hh-orange/30">
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3.5">
      <span className="h-[30px] w-[30px] rounded-full bg-hh-orange text-white font-display font-extrabold text-[13px] flex items-center justify-center shrink-0 ring-[3px] ring-hh-orange/15">
        H
      </span>
      <div className="flex-1 min-w-0">
        {message.text && <RichText text={message.text} />}
        {message.tool && <ToolIndicator name={message.tool} />}
        {message.learned && (
          <span className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-b from-hh-orange-light to-white border border-hh-orange-light text-[11px] font-semibold text-hh-orange-dark">
            <Sparkles className="h-3 w-3" />
            Learned: {message.learned}
          </span>
        )}
        {message.order && (
          <OrderSummaryCard
            messageId={message.id}
            initialOrder={message.order}
          />
        )}
      </div>
    </div>
  );
}

/** Tiny **bold** + paragraph splitter. */
function RichText({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/);
  return (
    <div className="space-y-2.5 text-[14.5px] leading-[1.65] text-hh-charcoal">
      {paragraphs.map((p, i) => (
        <p key={i} className="m-0">
          {parseBold(p)}
        </p>
      ))}
    </div>
  );
}

/**
 * Inline tool indicator. Shows up in the agent's bubble while a tool is
 * running (or while we're waiting for the agent to resume streaming text
 * after a tool call). Claude.ai-style: lives inside the conversation flow,
 * not above the composer.
 */
function ToolIndicator({ name }: { name: string }) {
  const label = toolLabel(name);
  return (
    <div className="inline-flex items-center gap-2.5 mt-1 mb-1 text-[13px] text-hh-charcoal animate-fade-in">
      <span className="relative inline-flex items-center justify-center h-5 w-5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-hh-orange opacity-40 animate-ping" />
        <span className="relative h-2 w-2 rounded-full bg-hh-orange" />
      </span>
      <span className="font-medium">
        {label}
        <span className="inline-flex gap-0.5 ml-1 align-middle">
          <span className="h-1 w-1 rounded-full bg-hh-orange animate-pulse [animation-delay:0ms]" />
          <span className="h-1 w-1 rounded-full bg-hh-orange animate-pulse [animation-delay:200ms]" />
          <span className="h-1 w-1 rounded-full bg-hh-orange animate-pulse [animation-delay:400ms]" />
        </span>
      </span>
    </div>
  );
}

function toolLabel(name: string): string {
  switch (name) {
    case "search_restaurants":
      return "Searching Swiggy for restaurants";
    case "get_restaurant_menu":
      return "Reading the menu";
    default:
      return `Running ${name}`;
  }
}

function parseBold(text: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="text-hh-black font-semibold">
        {p}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Order summary card (the YES-to-place card from the prototype)
// ─────────────────────────────────────────────────────────────────────────────
function OrderSummaryCard({
  messageId,
  initialOrder,
}: {
  messageId: string;
  initialOrder: OrderSummaryPayload;
}) {
  const [order, setOrder] = useState<OrderSummaryPayload>(initialOrder);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const placed = order.status === "placed";
  const cancelled = order.status === "cancelled";
  const canAct = !placed && !cancelled && !isPending;

  const onPlace = () => {
    setError(null);
    startTransition(async () => {
      const result = await placeOrderFromMessage(messageId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOrder(result.order);
    });
  };

  const ratingText = order.rating != null ? `★ ${order.rating.toFixed(1)}` : null;
  const distanceText =
    order.distance_km != null ? `${order.distance_km.toFixed(1)} km` : null;
  const meta = [ratingText, distanceText, order.reasoning].filter(Boolean).join(" · ");
  return (
    <div
      className={cn(
        "mt-3.5 rounded-2xl border bg-white shadow-[0_8px_24px_-10px_rgba(0,0,0,0.12)] overflow-hidden transition-opacity",
        placed && "border-hh-success/40",
        cancelled && "border-hh-gray-light opacity-60",
        !placed && !cancelled && "border-hh-gray-light",
      )}
    >
      {/* Gradient header */}
      <div className="px-4 py-3 bg-gradient-to-br from-hh-orange to-hh-orange-dark text-white flex items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">
            Order summary · {order.restaurant_name.split("—")[0].trim()}
          </div>
          <div className="font-display font-extrabold text-[17px] leading-tight">
            {order.restaurant_name}
          </div>
          {meta && <div className="text-[11px] opacity-90 tabular">{meta}</div>}
        </div>
        {order.eta_min != null && (
          <div className="text-right shrink-0">
            <div className="font-display font-extrabold text-lg leading-none tabular">
              {order.eta_min}
              <span className="text-[11px] font-semibold ml-0.5">min</span>
            </div>
            <div className="text-[9px] uppercase tracking-wider opacity-85 mt-0.5">
              delivery
            </div>
          </div>
        )}
      </div>

      {/* Item rows */}
      <div className="px-4 py-2">
        {order.items.map((it, i) => (
          <div
            key={i}
            className={cn(
              "flex justify-between items-baseline py-2 text-[13px]",
              i < order.items.length - 1 && "border-b border-dashed border-hh-gray-light",
            )}
          >
            <span className="text-hh-charcoal flex items-baseline gap-1.5">
              {it.name}
              <span className="font-mono text-[11px] text-hh-gray">× {it.qty}</span>
              {it.safe && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-hh-success">
                  <Check className="h-3 w-3" /> safe
                </span>
              )}
            </span>
            <span className="tabular text-hh-black font-semibold">
              {formatRupees(it.price)}
            </span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="px-4 pt-2.5 pb-3 bg-hh-cream space-y-1">
        <TotalRow label="Subtotal" value={formatRupees(order.subtotal)} />
        <TotalRow label="Delivery + GST" value={formatRupees(order.delivery_gst)} />
        {order.coupon < 0 && (
          <TotalRow
            label="Founder coupon"
            value={`−${formatRupees(Math.abs(order.coupon))}`}
            valueClass="text-hh-success"
          />
        )}
        <div className="flex justify-between items-baseline pt-1.5 mt-1 border-t border-hh-gray-light">
          <span className="text-[15px] font-bold text-hh-black">Total · COD</span>
          <span className="font-display font-extrabold text-lg text-hh-orange tabular">
            {formatRupees(order.total)}
          </span>
        </div>
      </div>

      {/* Status banner / CTAs */}
      {placed ? (
        <div className="px-4 py-3 border-t border-hh-gray-light bg-emerald-50 flex items-center gap-2 text-sm">
          <Check className="h-4 w-4 text-hh-success shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-hh-success">
              Order placed · COD
            </div>
            <div className="text-[11px] text-hh-charcoal font-mono truncate">
              {order.swiggy_order_id}
            </div>
          </div>
        </div>
      ) : cancelled ? (
        <div className="px-4 py-3 border-t border-hh-gray-light text-sm text-hh-gray italic">
          Order cancelled.
        </div>
      ) : (
        <>
          {error && (
            <div className="px-4 pt-3 pb-1 text-xs text-hh-danger">
              {error}
            </div>
          )}
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-3 border-t border-hh-gray-light">
            <button
              type="button"
              onClick={onPlace}
              disabled={!canAct}
              className="inline-flex items-center justify-center gap-2 bg-hh-orange hover:bg-hh-orange-dark text-white rounded-xl py-3 px-3 text-sm font-bold shadow-md shadow-hh-orange/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {isPending ? "Placing…" : "YES — place order"}
            </button>
            <button
              type="button"
              disabled
              title="Edit — Phase 2"
              className="rounded-xl bg-white border border-hh-gray-light px-4 text-[13px] font-semibold text-hh-charcoal/40 cursor-not-allowed"
            >
              Edit
            </button>
            <button
              type="button"
              disabled
              title="Swap — Phase 2"
              className="rounded-xl bg-white border border-hh-gray-light px-4 text-[13px] font-semibold text-hh-charcoal/40 cursor-not-allowed"
            >
              Swap
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function TotalRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between text-[12px] tabular text-hh-gray">
      <span>{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}
