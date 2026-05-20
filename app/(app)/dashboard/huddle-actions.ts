"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateHuddleCode,
  isValidHuddleCode,
  normaliseHuddleCode,
} from "@/lib/huddles/code-generator";
import { decide } from "@/lib/huddles/decision-engine";
import { filterMenu, loadAllergenProfile } from "@/lib/safeplate/filter";
import menus from "@/fixtures/mcp/menus.json";
import { CUISINES, SWIGGY_LIMITS } from "@/lib/constants";
import type { Json } from "@/types/database";

const huddleMenusById = menus as Record<
  string,
  { id: string; name: string; allergen_tags: string[]; is_veg: boolean }[]
>;

const nameSchema = z
  .string()
  .trim()
  .min(2, "Give your huddle a name (2+ chars)")
  .max(48, "Keep it under 48 characters.");

export type CreateHuddleResult =
  | { ok: true; huddleId: string; code: string }
  | { ok: false; error: string };

/**
 * Create a new huddle. Auto-adds the creator as the first member.
 * Generates unique 6-letter codes with up to 5 retries on collision.
 */
export async function createHuddle(name: string): Promise<CreateHuddleResult> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Insert the huddle row with a unique code (retry on collision).
  let huddleId: string | null = null;
  let code: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateHuddleCode();
    const { data, error } = await supabase
      .from("huddles")
      .insert({
        code: candidate,
        name: parsed.data,
        admin_id: user.id,
      })
      .select("id, code")
      .single();

    if (!error && data) {
      huddleId = data.id;
      code = data.code;
      break;
    }
    // 23505 = unique_violation — retry. Other errors → bail.
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      return { ok: false, error: error.message };
    }
  }
  if (!huddleId || !code) {
    return { ok: false, error: "Couldn't generate a unique code. Try again." };
  }

  // Add creator as first member. Use admin client because RLS would otherwise
  // require the user already be a member to see their own membership row,
  // and we're inserting that row right now.
  const admin = createAdminClient();
  const { error: memErr } = await admin.from("huddle_members").insert({
    huddle_id: huddleId,
    user_id: user.id,
  });
  if (memErr) {
    // Best-effort cleanup on partial failure.
    await admin.from("huddles").delete().eq("id", huddleId);
    return { ok: false, error: `Member insert failed: ${memErr.message}` };
  }

  revalidatePath("/dashboard");
  return { ok: true, huddleId, code };
}

// ─────────────────────────────────────────────────────────────────────────────

export type JoinHuddleResult =
  | { ok: true; huddleId: string; code: string; alreadyMember: boolean }
  | { ok: false; error: string };

/** Join an existing huddle by 6-letter code. Idempotent. */
export async function joinHuddleByCode(rawCode: string): Promise<JoinHuddleResult> {
  if (!isValidHuddleCode(rawCode)) {
    return { ok: false, error: "Code must be 6 letters/numbers." };
  }
  const code = normaliseHuddleCode(rawCode);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Look up the huddle by code via service-role — RLS would only return rows
  // for users already in the huddle, but the join flow needs to find non-
  // members too.
  const admin = createAdminClient();
  const { data: huddle, error: huErr } = await admin
    .from("huddles")
    .select("id, code, admin_id")
    .eq("code", code)
    .maybeSingle();
  if (huErr) return { ok: false, error: huErr.message };
  if (!huddle) return { ok: false, error: "No huddle with that code." };

  // Already a member?
  const { data: existing } = await admin
    .from("huddle_members")
    .select("user_id")
    .eq("huddle_id", huddle.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      huddleId: huddle.id,
      code: huddle.code,
      alreadyMember: true,
    };
  }

  const { error: insErr } = await admin.from("huddle_members").insert({
    huddle_id: huddle.id,
    user_id: user.id,
  });
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/dashboard");
  return {
    ok: true,
    huddleId: huddle.id,
    code: huddle.code,
    alreadyMember: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export type TriggerDecisionResult =
  | { ok: true; sessionId: string; alreadyOpen: boolean }
  | { ok: false; error: string };

/**
 * "Decide!" — opens a new polling session for the huddle. If one is already
 * polling, returns its id so we never have two open at once. Step 10 wires
 * the live poll banner + response-collection flow on top of this.
 */
export async function triggerHuddleDecision(
  huddleId: string,
  mode: "order_in" | "dine_out" = "order_in",
): Promise<TriggerDecisionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Already an open session? Don't double-open.
  const { data: openSession, error: lookupErr } = await supabase
    .from("huddle_sessions")
    .select("id")
    .eq("huddle_id", huddleId)
    .eq("status", "polling")
    .maybeSingle();
  if (lookupErr) {
    console.error("[triggerHuddleDecision] lookup error:", lookupErr.message);
    return { ok: false, error: `Lookup failed: ${lookupErr.message}` };
  }
  if (openSession) {
    await revalidateBoth(huddleId);
    return { ok: true, sessionId: openSession.id, alreadyOpen: true };
  }

  // Insert. RLS requires the user be a huddle member (huddle_sessions_member_insert).
  const { data, error } = await supabase
    .from("huddle_sessions")
    .insert({
      huddle_id: huddleId,
      triggered_by: user.id,
      status: "polling",
      mode,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error(
      "[triggerHuddleDecision] insert failed:",
      error?.message ?? "no data returned",
    );
    return {
      ok: false,
      error:
        error?.message ??
        "Failed to start session — most likely an RLS issue. Check the server console.",
    };
  }

  await revalidateBoth(huddleId);
  return { ok: true, sessionId: data.id, alreadyOpen: false };
}

/** Revalidate dashboard sidebar + the active huddle page. */
async function revalidateBoth(huddleId: string) {
  revalidatePath("/dashboard");
  // Look up the code so we can revalidate the specific huddle URL.
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("huddles")
      .select("code")
      .eq("id", huddleId)
      .maybeSingle();
    if (data?.code) {
      revalidatePath(`/huddle/${data.code}`);
      revalidatePath(`/huddle/${data.code.toLowerCase()}`);
      revalidatePath(`/huddle/${data.code.toUpperCase()}`);
    }
  } catch (err) {
    console.error("[revalidateBoth] code lookup failed:", err);
  }
}

/** Cancel an open polling session. Admin or triggerer only (RLS enforces). */
export async function cancelHuddleSession(sessionId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("huddle_sessions")
    .update({
      status: "cancelled",
      closed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
  revalidatePath("/dashboard");
}

/** Leave a huddle. Idempotent — silent if you're not a member. */
export async function leaveHuddle(huddleId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("huddle_members")
    .delete()
    .eq("huddle_id", huddleId)
    .eq("user_id", user.id);
  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────────────────────────────────────
// POLL submit
// ─────────────────────────────────────────────────────────────────────────────

const cuisineEnum = z.enum(CUISINES);

const pollSchema = z.object({
  cuisines: z.array(cuisineEnum).min(1, "Pick at least one cuisine"),
  mood: z
    .enum(["light", "heavy", "spicy", "sweet", "try-something-new"])
    .nullable(),
  veg_only: z.boolean().nullable(),
  budget: z.number().int().min(50).max(SWIGGY_LIMITS.CART_CAP_RUPEES).nullable(),
  max_distance: z.number().int().min(1).max(50).nullable(),
});

export type PollResponseInput = z.infer<typeof pollSchema>;

export type SubmitPollResult =
  | { ok: true; alreadySubmitted: boolean }
  | { ok: false; error: string };

/** Submit (or update) the current user's response to an open polling session. */
export async function submitPollResponse(
  sessionId: string,
  input: PollResponseInput,
): Promise<SubmitPollResult> {
  const parsed = pollSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid response.",
    };
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Confirm the session is still open.
  const { data: session } = await supabase
    .from("huddle_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { ok: false, error: "Session not found." };
  if (session.status !== "polling") {
    return { ok: false, error: "Poll already closed." };
  }

  const { data: existing } = await supabase
    .from("huddle_responses")
    .select("id")
    .eq("huddle_session_id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error: updErr } = await supabase
      .from("huddle_responses")
      .update({
        cuisines: parsed.data.cuisines,
        mood: parsed.data.mood,
        veg_only: parsed.data.veg_only,
        budget: parsed.data.budget,
        max_distance: parsed.data.max_distance,
      })
      .eq("id", existing.id);
    if (updErr) return { ok: false, error: updErr.message };
    revalidatePath("/dashboard");
    return { ok: true, alreadySubmitted: true };
  }

  const { error: insErr } = await supabase.from("huddle_responses").insert({
    huddle_session_id: sessionId,
    user_id: user.id,
    cuisines: parsed.data.cuisines,
    mood: parsed.data.mood,
    veg_only: parsed.data.veg_only,
    budget: parsed.data.budget,
    max_distance: parsed.data.max_distance,
  });
  if (insErr) return { ok: false, error: insErr.message };
  revalidatePath("/dashboard");
  return { ok: true, alreadySubmitted: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// DECIDE — runs the constraint solver, persists top 3, flips status
// ─────────────────────────────────────────────────────────────────────────────

export type DecideResult =
  | { ok: true; pickCount: number }
  | { ok: false; error: string };

export async function decideHuddleSession(
  sessionId: string,
): Promise<DecideResult> {
  const supabase = createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (!sessionId) {
    return { ok: false, error: "Missing sessionId." };
  }

  // Load via admin client — RLS shouldn't filter the triggerer's own session,
  // but we've seen edge cases where stale React state passes a sessionId from
  // a previous huddle. Looking up via admin gives us a clear "not found" vs
  // "wrong owner" distinction.
  const { data: session, error: sessionErr } = await admin
    .from("huddle_sessions")
    .select("id, huddle_id, status, triggered_by")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionErr) {
    console.error("[decideHuddleSession] session lookup error:", sessionErr.message);
    return { ok: false, error: `Lookup failed: ${sessionErr.message}` };
  }
  if (!session) {
    console.error(`[decideHuddleSession] no row for sessionId=${sessionId}`);
    return { ok: false, error: "Session not found." };
  }
  if (session.triggered_by !== user.id) {
    console.error(
      `[decideHuddleSession] permission denied: triggered_by=${session.triggered_by} caller=${user.id}`,
    );
    return {
      ok: false,
      error: "Only the person who started the huddle can close the poll.",
    };
  }
  if (session.status !== "polling") {
    return { ok: false, error: "Already decided." };
  }

  // Pull all members' allergy + diet via service-role (RLS would only return
  // the caller's own preferences, but the solver needs everyone's).
  const { data: memberRows } = await admin
    .from("huddle_members")
    .select("user_id")
    .eq("huddle_id", session.huddle_id);
  const memberIds = (memberRows ?? []).map((m) => m.user_id);

  const { data: allergyRows } = await admin
    .from("user_allergies")
    .select("user_id, allergen")
    .in("user_id", memberIds.length ? memberIds : ["x"]);
  const { data: prefRows } = await admin
    .from("user_preferences")
    .select("user_id, diet")
    .in("user_id", memberIds.length ? memberIds : ["x"]);

  const allergiesByUser = new Map<string, string[]>();
  for (const a of allergyRows ?? []) {
    const list = allergiesByUser.get(a.user_id) ?? [];
    list.push(a.allergen.toLowerCase());
    allergiesByUser.set(a.user_id, list);
  }
  const dietByUser = new Map<string, string | null>();
  for (const p of prefRows ?? []) {
    dietByUser.set(p.user_id, p.diet);
  }

  const memberConstraints = memberIds.map((uid) => ({
    user_id: uid,
    allergens: allergiesByUser.get(uid) ?? [],
    is_veg: ["Vegetarian", "Vegan", "Jain"].includes(
      dietByUser.get(uid) ?? "",
    ),
  }));

  // Pull responses (RLS allows since caller is a member).
  const { data: responses } = await supabase
    .from("huddle_responses")
    .select("user_id, cuisines, mood, veg_only, budget, max_distance")
    .eq("huddle_session_id", sessionId);

  if (!responses || responses.length === 0) {
    return { ok: false, error: "No one has responded yet." };
  }

  // Run the solver.
  const picks = decide(
    memberConstraints,
    responses.map((r) => ({
      user_id: r.user_id,
      cuisines: r.cuisines ?? [],
      veg_only: r.veg_only,
      budget: r.budget,
      max_distance: r.max_distance,
      mood: r.mood,
    })),
  );

  if (picks.length === 0) {
    return {
      ok: false,
      error: "No restaurant fits everyone's allergies + diet. Try widening the poll.",
    };
  }

  // Persist top 3 (admin client — recommendations are read-only for members per RLS).
  const { error: insErr } = await admin.from("huddle_recommendations").insert(
    picks.map((p) => ({
      huddle_session_id: sessionId,
      rank: p.rank,
      swiggy_id: p.swiggy_id,
      name: p.name,
      cuisines: p.cuisines,
      rating: p.rating,
      distance_km: p.distance_km,
      reasoning: p.reasoning,
      raw_data: p.raw as unknown as Json,
    })),
  );
  if (insErr) return { ok: false, error: insErr.message };

  // Flip session to 'decided'.
  await supabase
    .from("huddle_sessions")
    .update({ status: "decided" })
    .eq("id", sessionId);

  revalidatePath("/dashboard");
  return { ok: true, pickCount: picks.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// SPIN — server-side random pick from top 3, broadcasts via persistence
// ─────────────────────────────────────────────────────────────────────────────

export type SpinResult =
  | { ok: true; winnerId: string; rank: number }
  | { ok: false; error: string };

export async function spinHuddleWheel(sessionId: string): Promise<SpinResult> {
  const supabase = createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Idempotency: if already spun, return the existing winner.
  // Use admin client for the lookup so we can do a clean triggerer check
  // server-side regardless of any RLS edge cases.
  const { data: session } = await admin
    .from("huddle_sessions")
    .select("id, status, winner_recommendation_id, triggered_by")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { ok: false, error: "Session not found." };
  if (session.triggered_by !== user.id) {
    return {
      ok: false,
      error: "Only the person who started the huddle can spin the wheel.",
    };
  }
  if (session.status !== "decided") {
    return { ok: false, error: "Not ready to spin yet." };
  }
  if (session.winner_recommendation_id) {
    const { data: existing } = await supabase
      .from("huddle_recommendations")
      .select("id, rank")
      .eq("id", session.winner_recommendation_id)
      .maybeSingle();
    if (existing) {
      return { ok: true, winnerId: existing.id, rank: existing.rank };
    }
  }

  // Pick uniformly from top 3.
  const { data: recs } = await supabase
    .from("huddle_recommendations")
    .select("id, rank")
    .eq("huddle_session_id", sessionId)
    .order("rank", { ascending: true });
  if (!recs || recs.length === 0) {
    return { ok: false, error: "No recommendations to spin on." };
  }
  const idx = Math.floor(Math.random() * recs.length);
  const winner = recs[idx];

  const { error: updErr } = await admin
    .from("huddle_sessions")
    .update({ winner_recommendation_id: winner.id })
    .eq("id", sessionId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/dashboard");
  return { ok: true, winnerId: winner.id, rank: winner.rank };
}

// ─────────────────────────────────────────────────────────────────────────────
// PICK — direct pick from the top-3 (alternative to spinning)
// ─────────────────────────────────────────────────────────────────────────────

export type PickResult =
  | { ok: true; winnerId: string; rank: number }
  | { ok: false; error: string };

/**
 * Lets the triggerer skip the wheel and pick a specific top-3 restaurant
 * directly. Idempotent — re-running with a different recommendationId only
 * works if no winner has been set yet.
 */
export async function pickHuddleWinner(
  sessionId: string,
  recommendationId: string,
): Promise<PickResult> {
  const supabase = createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (!sessionId || !recommendationId) {
    return { ok: false, error: "Missing sessionId or recommendationId." };
  }

  // Triggerer-only.
  const { data: session } = await admin
    .from("huddle_sessions")
    .select("id, status, winner_recommendation_id, triggered_by")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { ok: false, error: "Session not found." };
  if (session.triggered_by !== user.id) {
    return {
      ok: false,
      error: "Only the person who started the huddle can pick the winner.",
    };
  }
  if (session.status !== "decided") {
    return { ok: false, error: "Not ready to pick yet." };
  }
  if (session.winner_recommendation_id) {
    // Idempotency — return the existing winner.
    const { data: existing } = await supabase
      .from("huddle_recommendations")
      .select("id, rank")
      .eq("id", session.winner_recommendation_id)
      .maybeSingle();
    if (existing) {
      return { ok: true, winnerId: existing.id, rank: existing.rank };
    }
  }

  // Confirm the recommendation belongs to this session.
  const { data: rec } = await admin
    .from("huddle_recommendations")
    .select("id, rank, huddle_session_id")
    .eq("id", recommendationId)
    .maybeSingle();
  if (!rec || rec.huddle_session_id !== sessionId) {
    return { ok: false, error: "That pick isn't part of this huddle." };
  }

  const { error: updErr } = await admin
    .from("huddle_sessions")
    .update({ winner_recommendation_id: recommendationId })
    .eq("id", sessionId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/dashboard");
  return { ok: true, winnerId: recommendationId, rank: rec.rank };
}

// ─────────────────────────────────────────────────────────────────────────────
// PLACE — records the huddle order + flips session to 'ordered'
// ─────────────────────────────────────────────────────────────────────────────

export type PlaceHuddleOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

export async function placeHuddleOrderFromWinner(
  sessionId: string,
): Promise<PlaceHuddleOrderResult> {
  const supabase = createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Use admin lookup so we can enforce triggerer-only with a clean
  // error message rather than a confusing RLS miss.
  const { data: session } = await admin
    .from("huddle_sessions")
    .select(
      "id, huddle_id, status, winner_recommendation_id, triggered_by",
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { ok: false, error: "Session not found." };
  if (session.triggered_by !== user.id) {
    return {
      ok: false,
      error:
        "Only the person who started the huddle can place the group order.",
    };
  }
  if (!session.winner_recommendation_id) {
    return {
      ok: false,
      error: "Pick a winner or spin the wheel first.",
    };
  }
  if (session.status === "ordered") {
    return { ok: false, error: "Already ordered." };
  }

  const { data: winner } = await supabase
    .from("huddle_recommendations")
    .select("name, swiggy_id, raw_data")
    .eq("id", session.winner_recommendation_id)
    .maybeSingle();
  if (!winner) return { ok: false, error: "Winner row missing." };

  // SafePlate guard for the orderer. The decision engine already filtered
  // restaurants whose menu has nothing safe for the GROUP's allergen union,
  // so the orderer (a member) is also covered. We re-check defensively here:
  // confirm the restaurant has at least one item the orderer themself can
  // eat, and refuse if not.
  const profile = await loadAllergenProfile(user.id);
  const restaurantItems = huddleMenusById[winner.swiggy_id] ?? [];
  if (restaurantItems.length > 0) {
    const { safe: safeItems, filtered } = filterMenu(
      restaurantItems,
      profile,
    );
    if (safeItems.length === 0) {
      const sample = filtered.slice(0, 3).map((f) => f.reason).join("; ");
      return {
        ok: false,
        error: `SafePlate refused: nothing on ${winner.name}'s menu is safe for you. ${sample}`,
      };
    }
  }

  // Phase-1 mock — totals are placeholder until Step 12 wires real cart flow.
  const mockTotal = 600;
  const mockItems = [
    { name: "Group order", qty: 1, price: mockTotal, safe: true },
  ];

  const { data: orderRow, error: insErr } = await admin
    .from("huddle_orders")
    .insert({
      huddle_id: session.huddle_id,
      session_id: sessionId,
      placed_by: user.id,
      swiggy_order_id: `mock_h_${Date.now().toString(36)}`,
      restaurant_name: winner.name,
      total_amount: mockTotal,
      items: mockItems as unknown as Json,
    })
    .select("id")
    .single();
  if (insErr || !orderRow) {
    return { ok: false, error: insErr?.message ?? "Order insert failed." };
  }

  await supabase
    .from("huddle_sessions")
    .update({
      status: "ordered",
      closed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  revalidatePath("/dashboard");
  return { ok: true, orderId: orderRow.id };
}
