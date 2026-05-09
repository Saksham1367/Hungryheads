"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Share2 } from "lucide-react";
import { ChatSidebar } from "@/components/chat/sidebar";
import { ModePicker } from "@/components/chat/mode-picker";
import { ChatThread } from "@/components/chat/thread";
import { Composer } from "@/components/chat/composer";
import { ChatSuggestions } from "@/components/chat/suggestions";
import { HuddleModal } from "@/components/chat/huddle-modal";
import { OverviewDrawer } from "@/components/chat/overview-drawer";
import { CHAT_MODES } from "@/lib/chat/modes";
import { streamChat } from "@/lib/chat/stream";
import type { ChatMode } from "@/types/domain";
import type {
  ChatMessageView,
  ChatView,
  HuddleView,
} from "@/lib/chat/types";
import type { OverviewData } from "@/lib/chat/overview";
import { updateChatMode } from "@/app/(app)/dashboard/actions";

export interface ChatShellProps {
  userInitial: string;
  userFullName: string;
  initialChats: ChatView[];
  initialHuddles: HuddleView[];
  initialActiveChat: ChatView | null;
  initialMessages: ChatMessageView[];
  budgetUsedPct: number | null;
  overview: OverviewData | null;
}

/**
 * Step 6c — wired to Supabase via server actions and the queries layer.
 * The active chat is driven by the `?chat=<id>` URL param so soft-navigations
 * re-run the server component and pull fresh state.
 */
export function ChatShell(props: ChatShellProps) {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  const [activeChat] = useState<ChatView | null>(props.initialActiveChat);
  const [messages, setMessages] = useState<ChatMessageView[]>(
    props.initialMessages,
  );
  const [mode, setMode] = useState<ChatMode>(
    props.initialActiveChat?.mode ?? "hungry",
  );
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [huddleModal, setHuddleModal] = useState<
    null | "create" | "join"
  >(null);
  const [overviewOpen, setOverviewOpen] = useState(false);

  const meta = CHAT_MODES[mode];
  const isEmpty = messages.length === 0 && !streaming;

  // ─── Sidebar handlers ──────────────────────────────────────────────────
  const onSelectChat = (id: string) => {
    if (id === activeChat?.id) return;
    abortRef.current?.abort();
    router.push(`/dashboard?chat=${id}`);
  };

  const onNewChat = () => {
    abortRef.current?.abort();
    setError(null);
    router.push(`/dashboard?new=1`);
  };

  // ─── Mode picker ──────────────────────────────────────────────────────
  const onChangeMode = (m: ChatMode) => {
    setMode(m);
    if (activeChat) {
      // Fire-and-forget — sidebar tag will update on next refresh.
      void updateChatMode(activeChat.id, m);
    }
  };

  // ─── Send: stream Anthropic via /api/chat ─────────────────────────────
  const onSend = async (text: string) => {
    if (streaming) return;
    setError(null);

    const optimisticUserId = `local-user-${Date.now()}`;
    const optimisticAgentId = `local-agent-${Date.now()}`;
    const sentMode = mode;
    setMessages((m) => [
      ...m,
      {
        id: optimisticUserId,
        role: "user",
        text,
        mode_at_send: sentMode,
        created_at: new Date().toISOString(),
      },
      {
        id: optimisticAgentId,
        role: "agent",
        text: "",
        mode_at_send: sentMode,
        created_at: new Date().toISOString(),
      },
    ]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStreaming(true);

    let resolvedChatId = activeChat?.id ?? null;
    let isNewChat = false;
    let assembled = "";
    let agentRowId: string | null = null;

    try {
      for await (const ev of streamChat(
        { chatId: activeChat?.id ?? null, text, mode: sentMode },
        ctrl.signal,
      )) {
        if (ev.type === "start") {
          resolvedChatId = ev.chatId;
          isNewChat = ev.isNewChat;
          // Replace optimistic user msg id with the real one
          setMessages((m) =>
            m.map((msg) =>
              msg.id === optimisticUserId
                ? { ...msg, id: ev.userMessageId }
                : msg,
            ),
          );
        } else if (ev.type === "delta") {
          assembled += ev.text;
          setMessages((m) =>
            m.map((msg) =>
              msg.id === optimisticAgentId
                ? { ...msg, text: assembled, tool: null }
                : msg,
            ),
          );
        } else if (ev.type === "tool_start") {
          // Stamp the tool name on the streaming agent bubble. Clears when
          // the next text delta arrives (or on done/error). Mock tools
          // finish in <10ms, so we DON'T clear on tool_end — the pill needs
          // to remain through the gap until Claude resumes streaming text.
          setMessages((m) =>
            m.map((msg) =>
              msg.id === optimisticAgentId ? { ...msg, tool: ev.name } : msg,
            ),
          );
        } else if (ev.type === "tool_end") {
          // No-op — tool_start → next delta is what controls visibility.
        } else if (ev.type === "done") {
          agentRowId = ev.agentMessageId;
          assembled = ev.content;
          setMessages((m) =>
            m.map((msg) =>
              msg.id === optimisticAgentId
                ? {
                    ...msg,
                    id: ev.agentMessageId,
                    text: ev.content,
                    order: ev.order ?? undefined,
                    learned: ev.learned ?? undefined,
                    payload: ev.order
                      ? { type: "order_summary", data: ev.order }
                      : undefined,
                  }
                : msg,
            ),
          );
        } else if (ev.type === "error") {
          throw new Error(ev.message);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Send failed";
      // AbortError fires when the user navigates away — silent
      if (msg !== "AbortError" && !msg.toLowerCase().includes("abort")) {
        setError(msg);
      }
      // If we never got a 'done', drop the empty optimistic agent bubble
      if (!agentRowId) {
        setMessages((m) => m.filter((msg) => msg.id !== optimisticAgentId));
      }
    } finally {
      setStreaming(false);
      // Clear any lingering tool indicator on the optimistic agent bubble.
      setMessages((m) =>
        m.map((msg) =>
          msg.id === optimisticAgentId ? { ...msg, tool: null } : msg,
        ),
      );
      abortRef.current = null;
    }

    // After a successful turn, sync the URL + sidebar order.
    if (agentRowId) {
      if (isNewChat && resolvedChatId) {
        router.push(`/dashboard?chat=${resolvedChatId}`);
      } else {
        router.refresh();
      }
    }
  };

  return (
    <div className="grid grid-cols-[280px_1fr] h-screen overflow-hidden bg-hh-cream">
      <ChatSidebar
        userInitial={props.userInitial}
        userFullName={props.userFullName}
        chats={props.initialChats}
        huddles={props.initialHuddles}
        activeChatId={activeChat?.id}
        budgetUsedPct={props.budgetUsedPct ?? undefined}
        onNewChat={onNewChat}
        onOpenOverview={() => setOverviewOpen(true)}
        onSelectChat={onSelectChat}
        onOpenHuddle={(code) => router.push(`/huddle/${code}`)}
        onCreateHuddle={() => setHuddleModal("create")}
        onJoinHuddle={() => setHuddleModal("join")}
      />

      <main className="flex flex-col min-w-0 min-h-0">
        <header className="px-6 py-3 border-b border-hh-gray-light bg-hh-cream/80 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h1 className="font-display text-base font-bold tracking-tight text-hh-black truncate">
              {activeChat?.title ?? "New chat"}
            </h1>
            <div className="text-[11px] text-hh-gray mt-0.5">
              {meta.label} mode
              {!isEmpty && ` · ${messages.length} messages`}
            </div>
          </div>
          <ModePicker value={mode} onChange={onChangeMode} />
          <div className="flex items-center gap-2">
            <IconBtn label="Share">
              <Share2 className="h-4 w-4" />
            </IconBtn>
            <IconBtn label="More">
              <MoreHorizontal className="h-4 w-4" />
            </IconBtn>
          </div>
        </header>

        {isEmpty ? (
          <EmptyState
            mode={mode}
            userFullName={props.userFullName}
            onPick={onSend}
          />
        ) : (
          <ChatThread messages={messages} />
        )}

        {error && (
          <div className="mx-7 mb-2 rounded-xl border border-hh-danger/40 bg-red-50 px-3 py-2 text-sm text-hh-danger shrink-0">
            {error}
          </div>
        )}

        <div className="shrink-0">
          {!isEmpty && <ChatSuggestions mode={mode} onPick={onSend} />}
          <Composer mode={mode} onSend={onSend} disabled={streaming} />
        </div>
      </main>

      <OverviewDrawer
        open={overviewOpen}
        onClose={() => setOverviewOpen(false)}
        data={props.overview}
      />

      <HuddleModal
        open={huddleModal !== null}
        initialTab={huddleModal ?? "create"}
        onClose={() => setHuddleModal(null)}
      />
    </div>
  );
}

function IconBtn({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="h-9 w-9 rounded-lg border border-hh-gray-light bg-white hover:bg-hh-orange-light hover:border-hh-orange-light hover:text-hh-orange-dark text-hh-charcoal flex items-center justify-center transition-colors"
    >
      {children}
    </button>
  );
}

function EmptyState({
  mode,
  userFullName,
  onPick,
}: {
  mode: ChatMode;
  userFullName: string;
  onPick: (text: string) => void;
}) {
  const meta = CHAT_MODES[mode];
  const firstName = userFullName.split(" ")[0] ?? "there";
  return (
    <div className="flex-1 overflow-y-auto py-16">
      <div className="max-w-[640px] mx-auto px-7 text-center space-y-5 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-hh-orange-light text-hh-orange-dark text-xs font-semibold uppercase tracking-wider">
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
          {meta.label} mode
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-hh-black text-balance">
          Hey {firstName} — what are we eating?
        </h2>
        <p className="text-hh-charcoal max-w-md mx-auto">
          {meta.hint}. Try one of these to start, or just type whatever&apos;s
          on your mind.
        </p>
        <div className="pt-4">
          <ChatSuggestions
            mode={mode}
            onPick={(text) => {
              const cleaned = text.replace(/^[^\s]+\s/, "");
              onPick(cleaned);
            }}
          />
        </div>
      </div>
    </div>
  );
}
