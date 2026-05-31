"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Loader2,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils/cn";
import { formatRupees } from "@/lib/utils/format";
import { classifyAttachment, formatBytes } from "@/lib/chat/attachments";
import type { ChatErrorInfo } from "@/lib/chat/errors";
import type { ChatAttachmentMeta, ChatMessageView } from "@/lib/chat/types";
import type { OrderSummaryPayload } from "@/types/domain";
import { placeOrderFromMessage } from "@/app/(app)/dashboard/order-actions";

/**
 * Renders a list of chat turns. Markdown-ish: **bold** is the only inline mark
 * we honour for now (matches the prototype's rich text). Step 6d will replace
 * with a proper renderer (react-markdown w/ a tiny plugin set).
 */
export function ChatThread({
  messages,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  streaming = false,
  onRegenerate,
  onEditMessage,
}: {
  messages: ChatMessageView[];
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  streaming?: boolean;
  onRegenerate?: () => void;
  onEditMessage?: (messageId: string, newText: string) => void;
}) {
  // The last agent message is the only one that can be regenerated.
  const lastAgentId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "agent") return messages[i].id;
    }
    return null;
  })();
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // True while the user is parked near the bottom — only then do we auto-follow
  // new content. If they scroll up to read history, we leave them alone.
  const stickToBottom = useRef(true);

  // Track the latest streamed text length so the effect re-runs as tokens
  // arrive (not just when a message is added/removed).
  const lastText = messages[messages.length - 1]?.text ?? "";

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distanceFromBottom < 120;
  };

  useEffect(() => {
    if (!stickToBottom.current) return;
    // Jump to the sentinel at the very bottom. "auto" (not "smooth") so it
    // keeps pace with fast token streaming without lagging behind.
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, lastText]);

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto py-8"
    >
      <div className="max-w-[780px] mx-auto px-4 sm:px-7 flex flex-col gap-7">
        {hasMore && onLoadMore && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-1.5 rounded-full border border-hh-gray-light bg-white px-3 py-1.5 text-xs font-medium text-hh-charcoal hover:bg-hh-orange-light hover:border-hh-orange-light hover:text-hh-orange-dark disabled:opacity-60 transition-colors"
            >
              {loadingMore ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ChevronUp className="h-3 w-3" />
              )}
              {loadingMore ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        )}
        {messages.map((m) => (
          <Turn
            key={m.id}
            message={m}
            canRegenerate={
              m.id === lastAgentId && !streaming && !!onRegenerate
            }
            onRegenerate={onRegenerate}
            // Editing only applies to real (persisted) user messages — skip the
            // optimistic `local-*` ids that haven't hit the DB yet, and disable
            // while a reply is streaming.
            canEdit={
              m.role === "user" &&
              !streaming &&
              !!onEditMessage &&
              !m.id.startsWith("local-")
            }
            onEditMessage={onEditMessage}
            // The active streaming agent bubble shows a "Thinking…" indicator
            // whenever there's a processing gap with nothing else on screen.
            isStreamingTurn={streaming && m.id === lastAgentId}
          />
        ))}
        {/* Scroll sentinel — auto-scroll targets this so the newest content
            stays in view as the agent streams. */}
        <div ref={endRef} aria-hidden className="h-0" />
      </div>
    </div>
  );
}

/**
 * A user turn — file pill (if any) + the message bubble. Hovering reveals an
 * Edit button; clicking it swaps the bubble for an inline textarea with
 * Save / Cancel. Saving re-forks the conversation from this message.
 */
function UserTurn({
  message,
  canEdit,
  onEditMessage,
}: {
  message: ChatMessageView;
  canEdit: boolean;
  onEditMessage?: (messageId: string, newText: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const hasText = message.text.trim().length > 0;

  const startEdit = () => {
    setDraft(message.text);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setDraft(message.text);
  };
  const save = () => {
    const t = draft.trim();
    if (!t || t === message.text.trim()) {
      cancel();
      return;
    }
    setEditing(false);
    onEditMessage?.(message.id, t);
  };

  // Focus + grow the textarea when the editor opens.
  useEffect(() => {
    if (!editing) return;
    const el = taRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [editing]);

  if (editing) {
    return (
      <div className="flex flex-col items-end w-full gap-1.5">
        <div className="w-full max-w-[80%] rounded-2xl rounded-br-sm bg-white border border-hh-orange shadow-md shadow-hh-orange/20 p-2.5">
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                save();
              }
              if (e.key === "Escape") cancel();
            }}
            rows={1}
            className="w-full resize-none border-none outline-none bg-transparent text-sm text-hh-black leading-relaxed max-h-[200px]"
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={cancel}
              className="px-3 py-1 rounded-lg text-[12px] font-semibold text-hh-charcoal hover:bg-hh-cream"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!draft.trim()}
              className="px-3 py-1 rounded-lg text-[12px] font-semibold bg-hh-orange text-white hover:bg-hh-orange-dark disabled:opacity-50"
            >
              Save &amp; resend
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col items-end w-full gap-1.5">
      {message.attachment && (
        <UserAttachmentPill attachment={message.attachment} />
      )}
      {hasText && (
        <div className="flex items-end gap-1.5 max-w-[85%]">
          {canEdit && (
            <button
              type="button"
              onClick={startEdit}
              aria-label="Edit message"
              title="Edit message"
              className="mb-1 h-7 w-7 inline-flex items-center justify-center rounded-lg text-hh-gray opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-hh-orange-dark hover:bg-hh-cream transition-all shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="rounded-2xl rounded-br-sm bg-hh-orange text-white px-4 py-3 text-sm leading-relaxed shadow-md shadow-hh-orange/30">
            {message.text}
          </div>
        </div>
      )}
    </div>
  );
}

function Turn({
  message,
  canRegenerate = false,
  onRegenerate,
  canEdit = false,
  onEditMessage,
  isStreamingTurn = false,
}: {
  message: ChatMessageView;
  canRegenerate?: boolean;
  onRegenerate?: () => void;
  canEdit?: boolean;
  onEditMessage?: (messageId: string, newText: string) => void;
  isStreamingTurn?: boolean;
}) {
  if (message.role === "user") {
    return (
      <UserTurn
        message={message}
        canEdit={canEdit}
        onEditMessage={onEditMessage}
      />
    );
  }
  const hasError = !!message.error;
  // Show "Thinking…" when this is the active streaming turn and there's a
  // processing gap: no visible prose yet, no tool pill running, no order
  // being built, no error. Covers the dead air before the first token AND the
  // pause between a tool finishing and the model resuming text.
  const prepForGap = prepareAgentText(message.text);
  const showThinking =
    isStreamingTurn &&
    !hasError &&
    !message.tool &&
    !prepForGap.visible &&
    !prepForGap.buildingOrder;
  return (
    <div className="flex gap-3.5">
      <span
        className={cn(
          "h-[30px] w-[30px] rounded-full font-display font-extrabold text-[13px] flex items-center justify-center shrink-0 ring-[3px]",
          hasError
            ? "bg-red-100 text-hh-danger ring-hh-danger/15"
            : "bg-hh-orange text-white ring-hh-orange/15",
        )}
      >
        {hasError ? "!" : "H"}
      </span>
      <div className="flex-1 min-w-0">
        {(() => {
          // Sanitise streaming text: hide the in-progress <order-summary>
          // JSON and the trailing `LEARNED:` line — both are server-handled
          // markers, not user-facing prose. The `done` event later replaces
          // `message.text` with the fully-cleaned version from the server.
          const prep = prepareAgentText(message.text);
          return (
            <>
              {prep.visible && <RichText text={prep.visible} />}
              {prep.buildingOrder && !message.order && <OrderBuildingPill />}
            </>
          );
        })()}
        {/* Thinking indicator — fills the processing gap (before the first
            token, or between a tool finishing and text resuming) so the screen
            never looks frozen. */}
        {showThinking && <ThinkingIndicator />}
        {/* Live tool activity — one animated pill at a time, shown BELOW the
            prose. Same visual language as the "Building your order card…"
            pill: it appears while a tool runs, then vanishes; the next tool's
            pill takes its place; the last one vanishes when work is done. */}
        {message.tool && <ToolIndicator name={message.tool} />}
        {message.error && <AgentErrorCard error={message.error} />}
        {message.safeplateNote && !hasError && (
          <span className="mt-2.5 mr-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-hh-success/30 text-[11px] font-semibold text-hh-success">
            <ShieldCheck className="h-3 w-3" />
            {message.safeplateNote}
          </span>
        )}
        {message.learned && !hasError && (
          <span className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-b from-hh-orange-light to-white border border-hh-orange-light text-[11px] font-semibold text-hh-orange-dark">
            <Sparkles className="h-3 w-3" />
            Learned: {message.learned}
          </span>
        )}
        {message.order && !hasError && (
          <OrderSummaryCard
            messageId={message.id}
            initialOrder={message.order}
          />
        )}
        {canRegenerate && !message.tool && (
          <button
            type="button"
            onClick={onRegenerate}
            className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium text-hh-gray hover:text-hh-orange-dark hover:bg-hh-cream transition-colors"
            title="Regenerate this response"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {hasError ? "Try again" : "Regenerate"}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Inline error card for agent turns that couldn't complete. Shows a friendly
 * title + detail; never the raw SDK error string. Lives inside the agent
 * bubble — same column as a normal reply, so layout doesn't shift.
 */
function AgentErrorCard({ error }: { error: ChatErrorInfo }) {
  return (
    <div
      role="alert"
      className="mt-2 max-w-[680px] rounded-2xl border border-hh-danger/30 bg-red-50/80 px-4 py-3"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-hh-danger shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="text-[13.5px] font-bold text-hh-danger leading-snug">
            {error.title}
          </div>
          <div className="text-[13px] text-hh-charcoal/85 mt-1 leading-relaxed">
            {error.detail}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Splits a streaming agent reply into a user-facing prose half and a flag
 * indicating that an order card is currently being assembled (the model is
 * mid-`<order-summary>`-JSON). Also drops any visible `LEARNED:` line so the
 * pill is the only surface for that signal.
 */
function prepareAgentText(text: string): {
  visible: string;
  buildingOrder: boolean;
} {
  if (!text) return { visible: "", buildingOrder: false };

  let visible = text;
  let buildingOrder = false;

  // Order-summary marker. While the closing tag hasn't streamed yet, hide
  // everything from the opening tag onwards and show the "building order"
  // pill. Once both tags are present, hide the whole block — the parsed
  // <OrderSummaryCard> renders below.
  const openIdx = visible.indexOf("<order-summary>");
  if (openIdx >= 0) {
    const closeIdx = visible.indexOf("</order-summary>", openIdx);
    if (closeIdx >= 0) {
      visible =
        visible.slice(0, openIdx) +
        visible.slice(closeIdx + "</order-summary>".length);
    } else {
      visible = visible.slice(0, openIdx);
      buildingOrder = true;
    }
  }

  // Strip every `LEARNED: <fact>` line (rendered as its own pill).
  visible = visible.replace(/^[ \t]*LEARNED:[ \t]*.+$/gim, "").trimEnd();
  // Collapse blank-line debris left behind by the strips.
  visible = visible.replace(/\n{3,}/g, "\n\n");

  return { visible, buildingOrder };
}

/**
 * "Thinking…" indicator shown during a processing gap (before the first token,
 * or while the model works between tool calls). The label cycles every ~2.5s so
 * it reads as live activity, with three pulsing dots — Claude.ai style.
 */
const THINKING_LABELS = ["Thinking", "Working", "Processing"] as const;

function ThinkingIndicator() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setIdx((i) => (i + 1) % THINKING_LABELS.length),
      2500,
    );
    return () => clearInterval(t);
  }, []);
  return (
    <div className="inline-flex items-center gap-1.5 text-[14px] text-hh-gray animate-fade-in">
      <span className="font-medium">{THINKING_LABELS[idx]}</span>
      <span className="inline-flex gap-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-hh-orange animate-pulse [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-hh-orange animate-pulse [animation-delay:200ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-hh-orange animate-pulse [animation-delay:400ms]" />
      </span>
    </div>
  );
}

function UserAttachmentPill({
  attachment,
}: {
  attachment: ChatAttachmentMeta;
}) {
  const kind = classifyAttachment(attachment.mime_type, attachment.filename);
  const isImage = kind === "image";
  const isSheet = kind === "xls" || kind === "xlsx" || kind === "csv";
  const Icon = isImage ? ImageIcon : isSheet ? FileSpreadsheet : FileText;
  const tone = isImage
    ? "text-violet-600"
    : isSheet
      ? "text-emerald-600"
      : "text-hh-orange-dark";
  return (
    <div className="inline-flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border border-hh-gray-light shadow-sm max-w-[80%]">
      <span
        className={cn(
          "inline-flex items-center justify-center h-8 w-8 rounded-lg bg-hh-cream border border-hh-gray-light shrink-0",
          tone,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold text-hh-charcoal truncate max-w-[240px]">
          {attachment.filename}
        </div>
        <div className="text-[10.5px] text-hh-gray tabular">
          {formatBytes(attachment.size_bytes)} ·{" "}
          {isImage ? "IMAGE" : kind ? kind.toUpperCase() : "FILE"}
        </div>
      </div>
    </div>
  );
}

function OrderBuildingPill() {
  return (
    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-hh-orange-light/60 border border-hh-orange-light px-3 py-1.5 text-[11px] font-semibold text-hh-orange-dark">
      <Loader2 className="h-3 w-3 animate-spin" />
      Building your order card…
    </div>
  );
}

/**
 * Markdown renderer for agent messages. Supports bold, italic, lists,
 * inline code, code blocks, links, and GitHub-flavored extras (tables,
 * task lists). Each element is styled with the brand palette so the prose
 * feels native to the app, not "library output."
 */
function RichText({ text }: { text: string }) {
  return (
    <div className="text-[15px] leading-[1.65] text-hh-charcoal space-y-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="m-0">{children}</p>,
          h1: ({ children }) => (
            <h1 className="font-display text-xl font-extrabold text-hh-black mt-1 mb-1">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-display text-lg font-bold text-hh-black mt-1 mb-1">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-display text-base font-bold text-hh-black mt-1 mb-0.5">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="font-display text-[15px] font-bold text-hh-black mt-1">
              {children}
            </h4>
          ),
          strong: ({ children }) => (
            <strong className="text-hh-black font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="my-0.5 ml-5 list-disc marker:text-hh-orange-dark space-y-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-0.5 ml-5 list-decimal marker:text-hh-orange-dark marker:font-semibold space-y-1">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-hh-orange-dark underline underline-offset-2 hover:no-underline"
            >
              {children}
            </a>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className?.includes("language-");
            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-hh-orange-light/50 text-hh-orange-dark font-mono text-[0.85em]"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className="block p-3 rounded-xl bg-hh-cream border border-hh-gray-light font-mono text-[0.85em] overflow-x-auto"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-2 rounded-xl bg-hh-cream border border-hh-gray-light overflow-x-auto">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-[3px] border-hh-orange pl-3 italic text-hh-charcoal/85 my-1.5">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-hh-gray-light" />,
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-xl border border-hh-gray-light">
              <table className="w-full text-[13.5px] border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-hh-cream text-hh-black font-display">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="text-left px-3 py-2 font-semibold border-b border-hh-gray-light">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-hh-gray-light last:border-b-0 align-top">
              {children}
            </td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Live tool indicator — one animated pill at a time, mirroring the
 * "Building your order card…" pill (same size, shape, colours, spinner).
 * Shown above the prose while a tool runs; it vanishes when the tool finishes
 * (cleared on the next tool_start, the first text delta, or done). The next
 * tool's pill takes its place; the last one vanishes when work is done.
 */
function ToolIndicator({ name }: { name: string }) {
  const label = toolLabel(name);
  return (
    <div className="mt-1 mb-2.5 inline-flex items-center gap-2 rounded-full bg-hh-orange-light/60 border border-hh-orange-light px-3 py-1.5 text-[11px] font-semibold text-hh-orange-dark animate-fade-in">
      <Loader2 className="h-3 w-3 animate-spin" />
      {label}…
    </div>
  );
}

/** Present-tense label for the live, animated in-progress indicator. */
function toolLabel(name: string): string {
  switch (name) {
    case "get_addresses":
      return "Getting your address";
    case "search_restaurants":
      return "Searching Swiggy for restaurants";
    case "get_restaurant_menu":
      return "Reading the menu";
    case "update_food_cart":
      return "Updating your cart";
    case "get_food_cart":
      return "Checking your cart";
    case "flush_food_cart":
      return "Clearing your cart";
    case "fetch_food_coupons":
      return "Looking for coupons";
    case "apply_food_coupon":
      return "Applying a coupon";
    case "place_food_order":
      return "Placing your order";
    case "track_food_order":
      return "Tracking your order";
    case "get_food_orders":
      return "Checking your order history";
    case "report_error":
      return "Filing a report";
    case "remember_preference":
      return "Saving to memory";
    case "update_allergy":
      return "Updating SafePlate";
    case "propose_order":
      return "Building your order";
    default:
      return `Running ${name}`;
  }
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
  const flaggedCount = order.items.filter((it) => !it.safe).length;
  const hasFlagged = flaggedCount > 0;
  const canAct = !placed && !cancelled && !isPending && !hasFlagged;

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
              "flex justify-between items-baseline gap-2 py-2 text-[13px]",
              i < order.items.length - 1 && "border-b border-dashed border-hh-gray-light",
              !it.safe && "bg-red-50/40 -mx-4 px-4",
            )}
          >
            <span className="min-w-0 text-hh-charcoal flex items-baseline gap-1.5 flex-wrap">
              <span className="break-words">{it.name}</span>
              <span className="font-mono text-[11px] text-hh-gray shrink-0">× {it.qty}</span>
              {it.safe ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-hh-success bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                  <Check className="h-3 w-3" /> safe
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-hh-danger bg-red-100 px-1.5 py-0.5 rounded shrink-0">
                  <AlertTriangle className="h-3 w-3" /> flagged
                </span>
              )}
            </span>
            <span className="tabular text-hh-black font-semibold shrink-0">
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
            label="Coupon discount"
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
          {hasFlagged && (
            <div className="mx-4 my-2 px-3 py-2 rounded-xl border border-hh-danger/40 bg-red-50 text-xs text-hh-danger flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                <strong>SafePlate blocked the order.</strong>{" "}
                {flaggedCount} item
                {flaggedCount === 1 ? "" : "s"} contain
                {flaggedCount === 1 ? "s" : ""} an allergen on your profile.
                Ask the agent to swap before placing.
              </span>
            </div>
          )}
          {error && (
            <div className="px-4 pt-3 pb-1 text-xs text-hh-danger">
              {error}
            </div>
          )}
          {/* Mobile: primary button full-width on top, Edit/Swap split below.
              sm+: single inline row [primary | Edit | Swap]. */}
          <div className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto] gap-2 px-4 py-3 border-t border-hh-gray-light">
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
            <div className="grid grid-cols-2 gap-2 sm:contents">
              <button
                type="button"
                disabled
                title="Edit — Phase 2"
                className="rounded-xl bg-white border border-hh-gray-light py-2.5 sm:py-0 px-4 text-[13px] font-semibold text-hh-charcoal/40 cursor-not-allowed"
              >
                Edit
              </button>
              <button
                type="button"
                disabled
                title="Swap — Phase 2"
                className="rounded-xl bg-white border border-hh-gray-light py-2.5 sm:py-0 px-4 text-[13px] font-semibold text-hh-charcoal/40 cursor-not-allowed"
              >
                Swap
              </button>
            </div>
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
