/**
 * Demo seeder — gives a single command a fully-populated dashboard so the
 * Builders Club submission video doesn't open on an empty app.
 *
 *   pnpm seed:demo                # picks the first real user
 *   pnpm seed:demo your@email.com # for a specific account
 *
 * What it creates:
 *
 *   - 3 synthetic friends (Aman/Priya/Rahul) with profiles, prefs, allergies
 *     (Aman has a peanut allergy — anchors the SafePlate moment on camera)
 *   - "Friday Dinner" huddle with code 4FRENZ (or random if collision),
 *     you as admin, 3 demo friends joined
 *   - One active polling session, 3 votes already submitted (you trigger
 *     the Decide button on camera with quorum already met)
 *   - One past order placed (so SpendSmart shows progress, not zero)
 *   - A few agent_memory facts so the system prompt has signal
 *
 * Idempotent: re-running cleans the previous demo state first.
 */
import {
  DEMO_USERS,
  demoEmail,
  getAdminClient,
  huddleCode,
  log,
  resolveTargetUserId,
  type DemoUserSpec,
} from "./_demo-shared";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

const FIXED_CODE = "4FRENZ"; // unforgettable on camera

async function main() {
  const targetArg = process.argv[2];
  const admin = await getAdminClient();

  // 1. Resolve which real user is the demo's protagonist.
  const target = await resolveTargetUserId(admin, targetArg);
  log.info(
    `Seeding around ${target.fullName} (${target.email} · ${target.userId})`,
  );

  // 2. Clean any prior demo state so we get a deterministic re-run.
  await cleanPreviousState(admin);

  // 3. Make sure the target's profile is fully onboarded.
  await ensureOnboarded(admin, target.userId);

  // 4. Create the 3 demo friends.
  const friends: { userId: string; spec: DemoUserSpec }[] = [];
  for (const spec of DEMO_USERS) {
    const userId = await createDemoUser(admin, spec);
    friends.push({ userId, spec });
    log.ok(`  Friend created: ${spec.fullName}`);
  }

  // 5. The Friday Dinner huddle, target = admin.
  const huddleId = await createHuddle(admin, target.userId, target.fullName);
  log.ok(`Huddle "Friday Dinner" created (code ${FIXED_CODE})`);

  // 6. Everyone joins.
  await joinHuddle(admin, huddleId, target.userId);
  for (const f of friends) await joinHuddle(admin, huddleId, f.userId);
  log.ok(`All 4 members joined`);

  // 7. Active polling session with 3 votes already in (target is the lone
  //    holdout — they trigger Decide on camera).
  const sessionId = await createSession(admin, huddleId, target.userId);
  for (const f of friends) {
    await submitVote(admin, sessionId, f.userId, f.spec);
  }
  log.ok(`Session opened · 3/4 voted (you're the missing vote)`);

  // 8. One past placed order, so SpendSmart isn't empty.
  await seedPastOrder(admin, target.userId);
  log.ok(`Past order in orders_cache`);

  // 9. Sprinkle agent memory facts so the system prompt has signal.
  await seedAgentMemory(admin, target.userId);
  log.ok(`Agent memory seeded`);

  log.ok(
    `\nAll set. Refresh /dashboard — you should see the Friday Dinner huddle and a "Decide!" CTA waiting for you.`,
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────

async function cleanPreviousState(admin: SupabaseClient<Database>) {
  log.info(`Cleaning previous demo state…`);
  const { data: list } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });
  const demos = (list?.users ?? []).filter((u) =>
    u.email?.endsWith("@hungryheads.demo"),
  );
  for (const u of demos) await admin.auth.admin.deleteUser(u.id);
  if (demos.length > 0) log.ok(`  Removed ${demos.length} prior demo user(s)`);

  // Wipe Friday Dinner huddle if it survives somehow (cascade should have
  // killed it, but the FIXED_CODE could be reserved by an orphan).
  await admin.from("huddles").delete().eq("code", FIXED_CODE);
}

async function ensureOnboarded(
  admin: SupabaseClient<Database>,
  userId: string,
) {
  await admin.from("profiles").update({ onboarded: true }).eq("id", userId);
  await admin.from("user_preferences").upsert(
    {
      user_id: userId,
      cuisines: ["North Indian", "Biryani", "Pizza"],
      diet: "Non-veg",
      monthly_budget: 5500,
      delivery_radius_km: 5,
      personality: "explorer",
    },
    { onConflict: "user_id" },
  );
}

async function createDemoUser(
  admin: SupabaseClient<Database>,
  spec: DemoUserSpec,
): Promise<string> {
  const email = demoEmail(spec.slug);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID(), // random — never logged in via password
    email_confirm: true,
    user_metadata: { full_name: spec.fullName, demo: true },
  });
  if (error || !data.user) {
    throw new Error(`createUser(${email}): ${error?.message}`);
  }
  const uid = data.user.id;

  // The auth → profile trigger fired; fill in remaining columns.
  await admin
    .from("profiles")
    .update({ full_name: spec.fullName, onboarded: true })
    .eq("id", uid);

  await admin.from("user_preferences").upsert(
    {
      user_id: uid,
      cuisines: [...spec.cuisines],
      diet: spec.diet,
      monthly_budget: spec.monthlyBudget,
      delivery_radius_km: spec.deliveryRadiusKm,
      personality: spec.personality,
    },
    { onConflict: "user_id" },
  );

  if (spec.allergies.length > 0) {
    await admin.from("user_allergies").insert(
      spec.allergies.map((a) => ({
        user_id: uid,
        allergen: a,
        severity: "high",
      })),
    );
  }
  return uid;
}

async function createHuddle(
  admin: SupabaseClient<Database>,
  adminUserId: string,
  _adminName: string,
): Promise<string> {
  // Prefer the fixed code; fall back to a random one if it's somehow taken.
  let code = FIXED_CODE;
  const { data: existing } = await admin
    .from("huddles")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (existing) code = huddleCode();

  const { data, error } = await admin
    .from("huddles")
    .insert({
      code,
      admin_id: adminUserId,
      status: "open",
      name: "Friday Dinner",
    } as never) // name column added in 0002; not in 0001 type yet
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`createHuddle: ${error?.message}`);
  }
  return data.id;
}

async function joinHuddle(
  admin: SupabaseClient<Database>,
  huddleId: string,
  userId: string,
) {
  await admin.from("huddle_members").upsert(
    { huddle_id: huddleId, user_id: userId },
    { onConflict: "huddle_id,user_id" },
  );
}

async function createSession(
  admin: SupabaseClient<Database>,
  huddleId: string,
  triggeredBy: string,
): Promise<string> {
  const { data, error } = await admin
    .from("huddle_sessions")
    .insert({
      huddle_id: huddleId,
      triggered_by: triggeredBy,
      status: "polling",
      mode: "order_in",
    } as never)
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`createSession: ${error?.message}`);
  }
  return data.id;
}

async function submitVote(
  admin: SupabaseClient<Database>,
  sessionId: string,
  userId: string,
  spec: DemoUserSpec,
) {
  await admin.from("huddle_responses").insert({
    huddle_session_id: sessionId,
    user_id: userId,
    cuisines: [...spec.cuisines],
    mood: spec.slug === "rahul" ? "heavy" : spec.slug === "priya" ? "light" : "spicy",
    veg_only: spec.diet === "Veg",
    budget: 400,
    max_distance: spec.deliveryRadiusKm,
  } as never);
}

async function seedPastOrder(
  admin: SupabaseClient<Database>,
  userId: string,
) {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  await admin.from("orders_cache").insert({
    user_id: userId,
    swiggy_order_id: `seed_${Date.now().toString(36)}`,
    source: "food",
    total_amount: 480,
    items: [
      { name: "Chicken Dum Biryani", qty: 1, price: 320 },
      { name: "Boondi Raita", qty: 1, price: 60 },
      { name: "Gulab Jamun (2 pcs)", qty: 1, price: 100 },
    ] as never,
    restaurant_name: "Paradise — Indiranagar",
    ordered_at: twoDaysAgo,
  });
}

async function seedAgentMemory(
  admin: SupabaseClient<Database>,
  userId: string,
) {
  await admin.from("agent_memory").insert([
    {
      user_id: userId,
      fact: "Prefers North Indian on weekends, lighter food on weekdays.",
      confidence: 0.9,
    },
    {
      user_id: userId,
      fact: "Usually orders for 1–2 people, average ticket ₹400–500.",
      confidence: 0.85,
    },
    {
      user_id: userId,
      fact: "Loves Paradise biryani; goes there roughly every 10 days.",
      confidence: 0.8,
    },
  ]);
}

main().catch((err) => {
  log.err(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
