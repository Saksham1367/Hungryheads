"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Menu, Share2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ChatSidebar } from "@/components/chat/sidebar";
import { ModePicker } from "@/components/chat/mode-picker";
import { ChatThread } from "@/components/chat/thread";
import { Composer } from "@/components/chat/composer";
import { ChatSuggestions } from "@/components/chat/suggestions";
import { HuddleModal } from "@/components/chat/huddle-modal";
import { OverviewDrawer } from "@/components/chat/overview-drawer";
import { CHAT_MODES } from "@/lib/chat/modes";
import { streamChat } from "@/lib/chat/stream";
import {
  categorizeClientError,
  describeChatError,
  isAbortError,
} from "@/lib/chat/errors";
import type { ChatMode } from "@/types/domain";
import type {
  ChatMessageView,
  ChatView,
  HuddleView,
} from "@/lib/chat/types";
import type { OverviewData } from "@/lib/chat/overview";
import {
  loadEarlierMessagesAction,
  shareChat,
  updateChatMode,
} from "@/app/(app)/dashboard/actions";

export interface ChatShellProps {
  userInitial: string;
  userFullName: string;
  initialChats: ChatView[];
  initialHuddles: HuddleView[];
  initialActiveChat: ChatView | null;
  initialMessages: ChatMessageView[];
  initialHasMore: boolean;
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
  const [hasMore, setHasMore] = useState(props.initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatMode>(
    props.initialActiveChat?.mode ?? "hungry",
  );
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [huddleModal, setHuddleModal] = useState<
    null | "create" | "join"
  >(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ─── Share: snapshot the current chat + copy URL to clipboard ──────────
  const onShare = async () => {
    if (!activeChat || sharing) return;
    setShareToast(null);
    setSharing(true);
    try {
      const res = await shareChat(activeChat.id);
      if (!res.ok) {
        setShareToast(res.error);
        return;
      }
      try {
        await navigator.clipboard.writeText(res.url);
        setShareToast("Link copied!");
      } catch {
        // Clipboard API blocked (e.g. insecure context) — surface the URL.
        setShareToast(res.url);
      }
    } catch (err) {
      console.error("[shareChat] threw:", err);
      setShareToast(
        err instanceof Error ? err.message : "Couldn't create share link.",
      );
    } finally {
      setSharing(false);
      setTimeout(() => setShareToast(null), 4000);
    }
  };

  // ─── Pagination: load older messages ─────────────────────────────────
  const onLoadMore = async () => {
    if (loadingMore || !hasMore || !activeChat) return;
    const oldest = messages.find((m) => m.created_at);
    if (!oldest?.created_at) return;
    setLoadingMore(true);
    try {
      const res = await loadEarlierMessagesAction(
        activeChat.id,
        oldest.created_at,
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessages((prev) => [...res.messages, ...prev]);
      setHasMore(res.hasMore);
    } catch (err) {
      console.error("[ChatShell] loadEarlier threw:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Esc closes the mobile sidebar.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);
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

  // ─── Shared stream consumer ───────────────────────────────────────────
  // Drives one streamChat() call against a freshly-inserted optimistic agent
  // bubble. Used by both onSend (new message) and onRegenerate (replay last).
  const runStream = async (
    streamInput: {
      chatId: string | null;
      text: string;
      mode: ChatMode;
      file?: File | null;
      regenerate?: boolean;
      editMessageId?: string | null;
    },
    optimisticAgentId: string,
    optimisticUserId: string | null,
  ) => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStreaming(true);

    let resolvedChatId = activeChat?.id ?? null;
    let isNewChat = false;
    let assembled = "";
    let agentRowId: string | null = null;
    let stopped = false;

    try {
      for await (const ev of streamChat(streamInput, ctrl.signal)) {
        if (ev.type === "start") {
          resolvedChatId = ev.chatId;
          isNewChat = ev.isNewChat;
          if (optimisticUserId) {
            setMessages((m) =>
              m.map((msg) =>
                msg.id === optimisticUserId
                  ? { ...msg, id: ev.userMessageId }
                  : msg,
              ),
            );
          }
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
          setMessages((m) =>
            m.map((msg) =>
              msg.id === optimisticAgentId ? { ...msg, tool: ev.name } : msg,
            ),
          );
        } else if (ev.type === "tool_end") {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === optimisticAgentId ? { ...msg, tool: null } : msg,
            ),
          );
        } else if (ev.type === "memory_saved") {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === optimisticAgentId
                ? { ...msg, learned: ev.fact }
                : msg,
            ),
          );
        } else if (ev.type === "allergy_saved") {
          const note =
            ev.action === "remove"
              ? `Removed ${ev.allergen} from SafePlate`
              : `SafePlate now blocks ${ev.allergen}`;
          setMessages((m) =>
            m.map((msg) =>
              msg.id === optimisticAgentId
                ? { ...msg, safeplateNote: note }
                : msg,
            ),
          );
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
                    tool: null,
                    payload: ev.order
                      ? { type: "order_summary", data: ev.order }
                      : undefined,
                  }
                : msg,
            ),
          );
        } else if (ev.type === "error") {
          const info = describeChatError(ev.code);
          if (ev.agentMessageId) agentRowId = ev.agentMessageId;
          if (ev.chatId) resolvedChatId = ev.chatId;
          setMessages((m) =>
            m.map((msg) =>
              msg.id === optimisticAgentId
                ? {
                    ...msg,
                    id: ev.agentMessageId ?? msg.id,
                    text: assembled,
                    error: info,
                    tool: null,
                  }
                : msg,
            ),
          );
          break;
        }
      }
    } catch (err) {
      if (isAbortError(err)) {
        // User hit Stop. Keep any partial text that already streamed in; just
        // drop the loading indicator. If nothing arrived yet, remove the empty
        // bubble so we don't leave a blank agent turn.
        stopped = true;
        setMessages((m) =>
          assembled
            ? m.map((msg) =>
                msg.id === optimisticAgentId
                  ? { ...msg, text: assembled, tool: null }
                  : msg,
              )
            : m.filter((msg) => msg.id !== optimisticAgentId),
        );
      } else {
        const code = categorizeClientError(err) ?? "unknown";
        const info = describeChatError(code);
        setMessages((m) =>
          m.map((msg) =>
            msg.id === optimisticAgentId
              ? { ...msg, text: assembled, error: info, tool: null }
              : msg,
          ),
        );
      }
    } finally {
      setStreaming(false);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === optimisticAgentId ? { ...msg, tool: null } : msg,
        ),
      );
      abortRef.current = null;
    }

    // Sync URL + sidebar after a completed turn (success or persisted error).
    // Skip on Stop — the partial bubble is local-only, a refresh would wipe it.
    if (agentRowId && !stopped) {
      if (isNewChat && resolvedChatId) {
        router.push(`/dashboard?chat=${resolvedChatId}`);
      } else {
        router.refresh();
      }
    }
  };

  // ─── Send: stream Anthropic via /api/chat ─────────────────────────────
  const onSend = async (text: string, file: File | null = null) => {
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
        attachment: file
          ? {
              filename: file.name,
              mime_type: file.type || "application/octet-stream",
              size_bytes: file.size,
            }
          : undefined,
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

    await runStream(
      { chatId: activeChat?.id ?? null, text, mode: sentMode, file },
      optimisticAgentId,
      optimisticUserId,
    );
  };

  // ─── Stop: abort the in-flight stream ─────────────────────────────────
  const onStop = () => {
    abortRef.current?.abort();
  };

  // ─── Regenerate: replay the last user turn, replacing the agent reply ──
  const onRegenerate = async () => {
    if (streaming) return;
    const chatId = activeChat?.id;
    if (!chatId) return;
    setError(null);

    // Drop the trailing agent message(s) locally and add a fresh empty bubble.
    // The server deletes the same rows and re-streams from the last user turn.
    const optimisticAgentId = `local-agent-${Date.now()}`;
    setMessages((m) => {
      const trimmed = [...m];
      while (trimmed.length && trimmed[trimmed.length - 1].role === "agent") {
        trimmed.pop();
      }
      return [
        ...trimmed,
        {
          id: optimisticAgentId,
          role: "agent",
          text: "",
          mode_at_send: mode,
          created_at: new Date().toISOString(),
        },
      ];
    });

    await runStream(
      { chatId, text: "", mode, regenerate: true },
      optimisticAgentId,
      null,
    );
  };

  // ─── Edit & resend: rewrite a user message, re-fork from there ─────────
  const onEditMessage = async (messageId: string, newText: string) => {
    if (streaming) return;
    const chatId = activeChat?.id;
    if (!chatId) return;
    const trimmedText = newText.trim();
    if (!trimmedText) return;
    setError(null);

    // Locally: update the edited bubble, drop everything after it, append a
    // fresh empty agent bubble. The server mirrors this and re-streams.
    const optimisticAgentId = `local-agent-${Date.now()}`;
    setMessages((m) => {
      const idx = m.findIndex((msg) => msg.id === messageId);
      if (idx === -1) return m;
      const kept = m.slice(0, idx + 1).map((msg) =>
        msg.id === messageId ? { ...msg, text: trimmedText } : msg,
      );
      return [
        ...kept,
        {
          id: optimisticAgentId,
          role: "agent",
          text: "",
          mode_at_send: mode,
          created_at: new Date().toISOString(),
        },
      ];
    });

    await runStream(
      { chatId, text: trimmedText, mode, editMessageId: messageId },
      optimisticAgentId,
      null,
    );
  };

  // Wrap every sidebar interaction so picking/creating a chat also closes
  // the mobile drawer.
  const closeMobile = () => setSidebarOpen(false);

  // Single source of truth for both sidebar instances (desktop + mobile).
  const sidebarProps = {
    userInitial: props.userInitial,
    userFullName: props.userFullName,
    chats: props.initialChats,
    huddles: props.initialHuddles,
    activeChatId: activeChat?.id,
    budgetUsedPct: props.budgetUsedPct ?? undefined,
    onNewChat: () => {
      closeMobile();
      onNewChat();
    },
    onOpenOverview: () => {
      closeMobile();
      setOverviewOpen(true);
    },
    onSelectChat: (id: string) => {
      closeMobile();
      onSelectChat(id);
    },
    onOpenHuddle: (code: string) => {
      closeMobile();
      router.push(`/huddle/${code}`);
    },
    onCreateHuddle: () => {
      closeMobile();
      setHuddleModal("create");
    },
    onJoinHuddle: () => {
      closeMobile();
      setHuddleModal("join");
    },
  };

  return (
    <div className="flex h-screen overflow-hidden bg-hh-cream">
      {/* ── Desktop sidebar — always visible, fixed-width flex item ─────── */}
      <div className="hidden md:flex md:flex-col md:w-[280px] md:shrink-0 md:h-full">
        <ChatSidebar {...sidebarProps} />
      </div>

      {/* ── Mobile sidebar — fixed overlay, toggleable ──────────────────── */}
      {sidebarOpen && (
        <div
          aria-hidden
          onClick={closeMobile}
          className="fixed inset-0 bg-black/40 z-30 md:hidden animate-fade-in"
        />
      )}
      <div
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-40 w-[280px] transition-transform duration-200 ease-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <ChatSidebar {...sidebarProps} />
      </div>

      <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full">
        <header className="px-3 sm:px-4 md:px-6 py-3 border-b border-hh-gray-light bg-hh-cream/80 backdrop-blur-md flex items-center justify-between gap-2 sm:gap-3 md:gap-4 shrink-0">
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 -ml-2 text-hh-charcoal rounded-lg hover:bg-hh-orange-light shrink-0"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-sm sm:text-base font-bold tracking-tight text-hh-black truncate">
              {activeChat?.title ?? "New chat"}
            </h1>
            <div className="text-[11px] text-hh-gray mt-0.5 truncate">
              {meta.label} mode
              {!isEmpty && ` · ${messages.length} messages`}
            </div>
          </div>
          <div className="shrink-0">
            <ModePicker value={mode} onChange={onChangeMode} />
          </div>
          <div className="relative flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onShare}
              disabled={!activeChat || sharing}
              title="Share this chat"
              aria-label="Share this chat"
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-hh-gray-light bg-white hover:bg-hh-orange-light hover:border-hh-orange-light hover:text-hh-orange-dark text-hh-charcoal text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sharing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Share</span>
            </button>
            {shareToast && (
              <div
                role="status"
                className="absolute right-0 top-11 z-20 inline-flex items-center gap-1.5 rounded-lg bg-hh-black text-white text-xs font-medium px-3 py-2 shadow-lg animate-fade-in max-w-[260px]"
              >
                <Check className="h-3.5 w-3.5 text-hh-success shrink-0" />
                <span className="truncate">{shareToast}</span>
              </div>
            )}
          </div>
        </header>

        {isEmpty ? (
          <EmptyState
            mode={mode}
            userFullName={props.userFullName}
            onPick={onSend}
          />
        ) : (
          <ChatThread
            messages={messages}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={onLoadMore}
            streaming={streaming}
            onRegenerate={onRegenerate}
            onEditMessage={onEditMessage}
          />
        )}

        {error && (
          <div className="mx-7 mb-2 rounded-xl border border-hh-danger/40 bg-red-50 px-3 py-2 text-sm text-hh-danger shrink-0">
            {error}
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-2 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="shrink-0">
          {!isEmpty && <ChatSuggestions mode={mode} onPick={onSend} />}
          <Composer
            mode={mode}
            onSend={onSend}
            disabled={streaming}
            streaming={streaming}
            onStop={onStop}
          />
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
    <div className="flex-1 overflow-y-auto py-10 sm:py-16">
      <div className="max-w-[640px] mx-auto px-4 sm:px-7 text-center space-y-5 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-hh-orange-light text-hh-orange-dark text-xs font-semibold uppercase tracking-wider">
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
          {meta.label} mode
        </div>
        <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-hh-black text-balance">
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
