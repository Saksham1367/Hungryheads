/**
 * Server-side reads for the chat shell. Always called from Server Components
 * or Server Actions — they go through `createClient()` which respects RLS.
 */
import { createClient } from "@/lib/supabase/server";
import { huddleInitials, huddleVariant, relativeTime } from "@/lib/chat/util";
import { isChatMode } from "@/lib/chat/modes";
import { loadOverviewData, type OverviewData } from "@/lib/chat/overview";
import type {
  ChatMessagePayload,
  OrderSummaryPayload,
} from "@/types/domain";
import type {
  ChatMessageView,
  ChatView,
  HuddleView,
} from "@/lib/chat/types";

// ─── Chats ──────────────────────────────────────────────────────────────────
export async function listChatsForCurrentUser(): Promise<ChatView[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chats")
    .select("id, title, mode, last_message_at")
    .order("last_message_at", { ascending: false });
  if (error) {
    console.error("listChatsForCurrentUser:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    mode: isChatMode(row.mode) ? row.mode : "hungry",
    last_message_at: row.last_message_at,
  }));
}

/** Returns null if not found (or RLS-hidden from this user). */
export async function loadChat(chatId: string): Promise<ChatView | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chats")
    .select("id, title, mode, last_message_at")
    .eq("id", chatId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    title: data.title,
    mode: isChatMode(data.mode) ? data.mode : "hungry",
    last_message_at: data.last_message_at,
  };
}

/** Page size for chat history. Tuned to keep the initial render snappy. */
export const CHAT_PAGE_SIZE = 50;

/**
 * Load the most-recent `limit` messages for a chat in chronological (asc) order.
 * Pulls newest-first then reverses, so very old turns are off-screen until the
 * user pages back via {@link loadEarlierChatMessages}.
 */
export async function loadChatMessages(
  chatId: string,
  limit: number = CHAT_PAGE_SIZE,
): Promise<{ messages: ChatMessageView[]; hasMore: boolean }> {
  const supabase = createClient();
  // +1 sentinel to detect "more available" without a count query.
  const { data, error } = await supabase
    .from("chat_messages")
    .select(
      "id, role, content, mode_at_send, payload, learned_fact, created_at",
    )
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  if (error) {
    console.error("loadChatMessages:", error.message);
    return { messages: [], hasMore: false };
  }
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;
  const messages = trimmed
    .filter((r) => r.role === "user" || r.role === "agent")
    .map(rowToMessageView)
    .reverse(); // back to ascending for the UI
  return { messages, hasMore };
}

/**
 * Load older messages (strictly before `beforeCreatedAt`) for "Load earlier"
 * pagination. Returns chronologically-ordered batch + whether more remain.
 */
export async function loadEarlierChatMessages(
  chatId: string,
  beforeCreatedAt: string,
  limit: number = CHAT_PAGE_SIZE,
): Promise<{ messages: ChatMessageView[]; hasMore: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select(
      "id, role, content, mode_at_send, payload, learned_fact, created_at",
    )
    .eq("chat_id", chatId)
    .lt("created_at", beforeCreatedAt)
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  if (error) {
    console.error("loadEarlierChatMessages:", error.message);
    return { messages: [], hasMore: false };
  }
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;
  const messages = trimmed
    .filter((r) => r.role === "user" || r.role === "agent")
    .map(rowToMessageView)
    .reverse();
  return { messages, hasMore };
}

function rowToMessageView(row: {
  id: string;
  role: string;
  content: string;
  mode_at_send: string;
  payload: unknown;
  learned_fact: string | null;
  created_at: string;
}): ChatMessageView {
  const payload = parsePayload(row.payload);
  return {
    id: row.id,
    role: row.role === "agent" ? "agent" : "user",
    text: row.content,
    mode_at_send: isChatMode(row.mode_at_send) ? row.mode_at_send : "hungry",
    order: payload?.type === "order_summary" ? payload.data : undefined,
    learned: row.learned_fact ?? undefined,
    payload: payload ?? undefined,
    created_at: row.created_at,
  };
}

function parsePayload(raw: unknown): ChatMessagePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as { type?: unknown; data?: unknown; fact?: unknown };
  if (p.type === "order_summary" && p.data && typeof p.data === "object") {
    return { type: "order_summary", data: p.data as OrderSummaryPayload };
  }
  if (p.type === "memory_learned" && typeof p.fact === "string") {
    return { type: "memory_learned", fact: p.fact };
  }
  return null;
}

// ─── Huddles ────────────────────────────────────────────────────────────────
export async function listHuddlesForCurrentUser(): Promise<HuddleView[]> {
  const supabase = createClient();

  // Pull the user's memberships, then their huddle rows.
  const { data: memberships, error: memErr } = await supabase
    .from("huddle_members")
    .select("huddle_id, joined_at")
    .order("joined_at", { ascending: false });
  if (memErr) {
    console.error("listHuddles memberships:", memErr.message);
    return [];
  }
  const huddleIds = (memberships ?? []).map((m) => m.huddle_id);
  if (huddleIds.length === 0) return [];

  const { data: huddles, error: huErr } = await supabase
    .from("huddles")
    .select("id, code, name, created_at")
    .in("id", huddleIds);
  if (huErr) {
    console.error("listHuddles rows:", huErr.message);
    return [];
  }

  // Member counts (one query, batched).
  const { data: memberRows } = await supabase
    .from("huddle_members")
    .select("huddle_id")
    .in("huddle_id", huddleIds);
  const memberCount = new Map<string, number>();
  for (const r of memberRows ?? []) {
    memberCount.set(r.huddle_id, (memberCount.get(r.huddle_id) ?? 0) + 1);
  }

  // Active sessions (status='polling') per huddle.
  const { data: sessions } = await supabase
    .from("huddle_sessions")
    .select("id, huddle_id, status, created_at")
    .in("huddle_id", huddleIds)
    .order("created_at", { ascending: false });
  const liveSession = new Map<string, { id: string; status: string; created_at: string }>();
  for (const s of sessions ?? []) {
    if (s.status === "polling" && !liveSession.has(s.huddle_id)) {
      liveSession.set(s.huddle_id, s);
    }
  }

  return (huddles ?? []).map((h) => {
    const live = liveSession.get(h.id);
    const count = memberCount.get(h.id) ?? 1;
    const sub = live
      ? `${count} members · poll live`
      : `${count} members · ${relativeTime(h.created_at)}`;
    return {
      id: h.id,
      code: h.code,
      name: h.name ?? h.code,
      member_count: count,
      poll_live: !!live,
      initials: huddleInitials(h.name, h.code),
      variant: huddleVariant(h.id),
      sub,
      active_session: live
        ? {
            id: live.id,
            status: "polling",
            created_at: live.created_at,
          }
        : undefined,
    };
  });
}

// ─── Budget consumed % for sidebar Overview badge ───────────────────────────
export async function loadBudgetUsedPct(): Promise<number | null> {
  const supabase = createClient();
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("monthly_budget")
    .maybeSingle();
  const budget = prefs?.monthly_budget;
  if (!budget) return null;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: orders } = await supabase
    .from("orders_cache")
    .select("total_amount")
    .gte("ordered_at", startOfMonth.toISOString());
  const spent = (orders ?? []).reduce((s, o) => s + (o.total_amount ?? 0), 0);
  return Math.min(100, Math.round((spent / budget) * 100));
}

// ─── Initial dashboard payload helper ───────────────────────────────────────
export interface DashboardData {
  chats: ChatView[];
  huddles: HuddleView[];
  activeChat: ChatView | null;
  activeMessages: ChatMessageView[];
  /** True when the active chat has older messages not yet loaded. */
  activeHasMore: boolean;
  budgetUsedPct: number | null;
  overview: OverviewData | null;
}

export async function loadDashboard(
  activeChatIdParam?: string,
  forceNew = false,
): Promise<DashboardData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id;

  const [chats, huddles, budgetUsedPct, overview] = await Promise.all([
    listChatsForCurrentUser(),
    listHuddlesForCurrentUser(),
    loadBudgetUsedPct(),
    userId ? loadOverviewData(userId) : Promise.resolve(null),
  ]);

  // Pick the active chat:
  //   - ?new=1            → always blank slate (the "+ New chat" button uses this)
  //   - ?chat=<id>        → that specific chat
  //   - bare /dashboard   → most-recent chat (so bookmarks land somewhere useful)
  //   - no chats yet      → blank slate
  let activeChat: ChatView | null = null;
  if (forceNew) {
    activeChat = null;
  } else if (activeChatIdParam) {
    activeChat = await loadChat(activeChatIdParam);
  } else if (chats.length > 0) {
    activeChat = chats[0];
  }

  const page = activeChat
    ? await loadChatMessages(activeChat.id)
    : { messages: [], hasMore: false };

  return {
    chats,
    huddles,
    activeChat,
    activeMessages: page.messages,
    activeHasMore: page.hasMore,
    budgetUsedPct,
    overview,
  };
}
