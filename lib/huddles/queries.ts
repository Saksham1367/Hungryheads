/**
 * Server-side reads for the huddle page.
 *
 * RLS gates everything to members. Non-member callers get null/empty back.
 */
import { createClient } from "@/lib/supabase/server";
import { huddleInitials, huddleVariant } from "@/lib/chat/util";
import type { Json } from "@/types/database";
import type { HuddleSessionStatus } from "@/types/domain";

export interface HuddleMember {
  user_id: string;
  full_name: string;
  email: string;
  initial: string;
  is_admin: boolean;
  joined_at: string;
}

export interface HuddleSessionView {
  id: string;
  status: HuddleSessionStatus;
  triggered_by_id: string;
  triggered_by_name: string;
  mode: string | null;
  created_at: string;
  closed_at: string | null;
  /** Number of poll responses submitted so far. */
  responseCount: number;
  winner_recommendation_id?: string | null;
}

export interface HuddleRecommendationView {
  id: string;
  rank: number;
  swiggy_id: string;
  name: string;
  cuisines: string[];
  rating: number | null;
  distance_km: number | null;
  reasoning: string | null;
}

export interface HuddleOrderView {
  id: string;
  restaurant_name: string | null;
  total_amount: number;
  items: Json;
  ordered_at: string;
  placed_by_name: string;
}

export interface HuddleDetail {
  id: string;
  code: string;
  name: string | null;
  admin_id: string;
  created_at: string;
  initials: string;
  variant: "g1" | "g2" | "g3";
  members: HuddleMember[];
  /** Open polling session, if any — drives the live banner + Step 10 flow. */
  activeSession: HuddleSessionView | null;
  /** Past sessions (most-recent first), excluding the active one. */
  pastSessions: HuddleSessionView[];
  /** Orders the group has placed together. */
  orders: HuddleOrderView[];
  /** Is the current viewer a member? */
  viewerIsMember: boolean;
  viewerIsAdmin: boolean;
  /** True if the current viewer has already submitted a response to the active session. */
  viewerHasResponded: boolean;
  /** Top-3 recommendations for the active session, in rank order. */
  activeRecommendations: HuddleRecommendationView[];
  /** Winner from the active session's spin, if one happened. */
  activeWinner: HuddleRecommendationView | null;
}

export async function loadHuddleByCode(
  code: string,
): Promise<HuddleDetail | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // RLS gates this to members. Non-members get null.
  const { data: huddle } = await supabase
    .from("huddles")
    .select("id, code, name, admin_id, created_at")
    .eq("code", code)
    .maybeSingle();
  if (!huddle) return null;

  // Members + their profile rows (one query each — Supabase doesn't join freely
  // through anon-key RLS).
  const { data: memberRows } = await supabase
    .from("huddle_members")
    .select("user_id, joined_at")
    .eq("huddle_id", huddle.id)
    .order("joined_at", { ascending: true });

  const memberIds = (memberRows ?? []).map((r) => r.user_id);
  const profilesById = new Map<
    string,
    { full_name: string | null; email: string }
  >();
  if (memberIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", memberIds);
    for (const p of profiles ?? []) {
      profilesById.set(p.id, { full_name: p.full_name, email: p.email });
    }
  }

  const members: HuddleMember[] = (memberRows ?? []).map((m) => {
    const p = profilesById.get(m.user_id);
    const fullName =
      p?.full_name?.trim() || p?.email?.split("@")[0] || "Member";
    return {
      user_id: m.user_id,
      full_name: fullName,
      email: p?.email ?? "",
      initial: fullName.charAt(0).toUpperCase(),
      is_admin: m.user_id === huddle.admin_id,
      joined_at: m.joined_at,
    };
  });

  // Sessions — load all, split into active vs past.
  // Try the full column set first; if `winner_recommendation_id` is missing
  // (migration 0005 not applied yet) fall back to the older shape so the page
  // stays usable.
  let sessionRows: {
    id: string;
    status: string;
    triggered_by: string;
    mode: string | null;
    created_at: string;
    closed_at: string | null;
    winner_recommendation_id: string | null;
  }[] = [];
  {
    const { data, error } = await supabase
      .from("huddle_sessions")
      .select(
        "id, status, triggered_by, mode, created_at, closed_at, winner_recommendation_id",
      )
      .eq("huddle_id", huddle.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(
        "[loadHuddleByCode] sessions select failed (did migration 0005 run?):",
        error.message,
      );
      // Fallback without the new column — page still renders; spin won't persist.
      const { data: fallback } = await supabase
        .from("huddle_sessions")
        .select("id, status, triggered_by, mode, created_at, closed_at")
        .eq("huddle_id", huddle.id)
        .order("created_at", { ascending: false });
      sessionRows = (fallback ?? []).map((s) => ({
        ...s,
        winner_recommendation_id: null,
      }));
    } else {
      sessionRows = data ?? [];
    }
  }

  // Response counts per session — single batched query.
  const sessionIds = (sessionRows ?? []).map((s) => s.id);
  const responseCountBySession = new Map<string, number>();
  if (sessionIds.length > 0) {
    const { data: responses } = await supabase
      .from("huddle_responses")
      .select("huddle_session_id")
      .in("huddle_session_id", sessionIds);
    for (const r of responses ?? []) {
      responseCountBySession.set(
        r.huddle_session_id,
        (responseCountBySession.get(r.huddle_session_id) ?? 0) + 1,
      );
    }
  }

  const sessions: HuddleSessionView[] = (sessionRows ?? []).map((s) => {
    const triggererName =
      profilesById.get(s.triggered_by)?.full_name?.split(" ")[0] ?? "Someone";
    return {
      id: s.id,
      status: s.status as HuddleSessionStatus,
      triggered_by_id: s.triggered_by,
      triggered_by_name: triggererName,
      mode: s.mode,
      created_at: s.created_at,
      closed_at: s.closed_at,
      responseCount: responseCountBySession.get(s.id) ?? 0,
      winner_recommendation_id: s.winner_recommendation_id,
    };
  });

  // The "active" session here means the one currently in flight — could be
  // polling, decided-and-awaiting-spin, or decided-and-awaiting-order. Only
  // 'cancelled' or 'ordered' sessions are considered fully past.
  const activeSession =
    sessions.find(
      (s) => s.status === "polling" || s.status === "decided",
    ) ?? null;
  const pastSessions = sessions.filter((s) => s.id !== activeSession?.id);

  // Active session's recommendations + viewer's response status + winner.
  let viewerHasResponded = false;
  let activeRecommendations: HuddleRecommendationView[] = [];
  let activeWinner: HuddleRecommendationView | null = null;
  if (activeSession) {
    const { data: viewerResp } = await supabase
      .from("huddle_responses")
      .select("id")
      .eq("huddle_session_id", activeSession.id)
      .eq("user_id", user.id)
      .maybeSingle();
    viewerHasResponded = !!viewerResp;

    if (
      activeSession.status === "decided" ||
      activeSession.status === "ordered"
    ) {
      const { data: recRows } = await supabase
        .from("huddle_recommendations")
        .select(
          "id, rank, swiggy_id, name, cuisines, rating, distance_km, reasoning",
        )
        .eq("huddle_session_id", activeSession.id)
        .order("rank", { ascending: true });
      activeRecommendations = (recRows ?? []).map((r) => ({
        id: r.id,
        rank: r.rank,
        swiggy_id: r.swiggy_id,
        name: r.name,
        cuisines: r.cuisines ?? [],
        rating: r.rating,
        distance_km: r.distance_km,
        reasoning: r.reasoning,
      }));
      if (activeSession.winner_recommendation_id) {
        activeWinner =
          activeRecommendations.find(
            (r) => r.id === activeSession.winner_recommendation_id,
          ) ?? null;
      }
    }
  }

  // Orders — most-recent first.
  const { data: orderRows } = await supabase
    .from("huddle_orders")
    .select("id, restaurant_name, total_amount, items, ordered_at, placed_by")
    .eq("huddle_id", huddle.id)
    .order("ordered_at", { ascending: false })
    .limit(20);

  const orders: HuddleOrderView[] = (orderRows ?? []).map((o) => ({
    id: o.id,
    restaurant_name: o.restaurant_name,
    total_amount: o.total_amount,
    items: o.items,
    ordered_at: o.ordered_at,
    placed_by_name:
      profilesById.get(o.placed_by)?.full_name?.split(" ")[0] ?? "Someone",
  }));

  return {
    id: huddle.id,
    code: huddle.code,
    name: huddle.name,
    admin_id: huddle.admin_id,
    created_at: huddle.created_at,
    initials: huddleInitials(huddle.name, huddle.code),
    variant: huddleVariant(huddle.id),
    members,
    activeSession,
    pastSessions,
    orders,
    viewerIsMember: members.some((m) => m.user_id === user.id),
    viewerIsAdmin: huddle.admin_id === user.id,
    viewerHasResponded,
    activeRecommendations,
    activeWinner,
  };
}
