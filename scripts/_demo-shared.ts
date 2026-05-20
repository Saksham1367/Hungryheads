/**
 * Shared utilities for the demo seed + cleanup scripts.
 *
 * Demo users are tagged by their email domain so cleanup can find them
 * without having to remember ids:
 *
 *   demo-<slug>@hungryheads.demo
 *
 * Cleanup deletes every auth.users row matching that pattern, which cascades
 * through profiles / chats / huddles / orders_cache / agent_memory.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const DEMO_EMAIL_DOMAIN = "hungryheads.demo";

export const DEMO_USERS = [
  {
    slug: "aman",
    fullName: "Aman Khurana",
    cuisines: ["North Indian", "Biryani", "Street Food"],
    diet: "Non-veg",
    monthlyBudget: 6000,
    deliveryRadiusKm: 5,
    personality: "explorer",
    allergies: ["Peanuts"], // anchors the SafePlate moment in the demo video
  },
  {
    slug: "priya",
    fullName: "Priya Sharma",
    cuisines: ["South Indian", "Healthy Bowls", "Continental"],
    diet: "Veg",
    monthlyBudget: 4500,
    deliveryRadiusKm: 5,
    personality: "regular",
    allergies: [],
  },
  {
    slug: "rahul",
    fullName: "Rahul Verma",
    cuisines: ["Pizza", "Burgers", "Chinese"],
    diet: "Non-veg",
    monthlyBudget: 5000,
    deliveryRadiusKm: 8,
    personality: "comfort",
    allergies: ["Soy"],
  },
] as const;

export type DemoUserSpec = (typeof DEMO_USERS)[number];

/** Format the demo email for a given slug. */
export function demoEmail(slug: string): string {
  return `demo-${slug}@${DEMO_EMAIL_DOMAIN}`;
}

/**
 * Build the admin client. Loads env via Next's loader so .env.local works
 * the same as it does inside next dev / next build.
 */
export async function getAdminClient(): Promise<SupabaseClient<Database>> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { loadEnvConfig } = require("@next/env") as {
    loadEnvConfig: (dir: string) => void;
  };
  loadEnvConfig(process.cwd());

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Resolve a target user id from either a UUID, an email address, or undefined
 * (in which case we look up the first non-demo user in the system — useful
 * for one-account dev environments).
 */
export async function resolveTargetUserId(
  admin: SupabaseClient<Database>,
  arg: string | undefined,
): Promise<{ userId: string; email: string; fullName: string }> {
  if (arg && /^[0-9a-f-]{36}$/i.test(arg)) {
    const { data } = await admin
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", arg)
      .maybeSingle();
    if (!data) throw new Error(`No profile with id ${arg}`);
    return {
      userId: data.id,
      email: data.email,
      fullName: data.full_name ?? data.email,
    };
  }
  if (arg && arg.includes("@")) {
    const { data } = await admin
      .from("profiles")
      .select("id, email, full_name")
      .eq("email", arg.toLowerCase())
      .maybeSingle();
    if (!data) throw new Error(`No profile with email ${arg}`);
    return {
      userId: data.id,
      email: data.email,
      fullName: data.full_name ?? data.email,
    };
  }
  // Bare run — pick the first real user (not a demo account).
  const { data } = await admin
    .from("profiles")
    .select("id, email, full_name")
    .not("email", "like", `%@${DEMO_EMAIL_DOMAIN}`)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) {
    throw new Error(
      "No real users in the system yet. Sign up via the app first, then re-run with that email.",
    );
  }
  return {
    userId: data.id,
    email: data.email,
    fullName: data.full_name ?? data.email,
  };
}

/** Compact 6-letter join code (matches what create-huddle uses). */
export function huddleCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid misreads
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** Tiny terminal logger. */
export const log = {
  info: (msg: string) => console.log(`\x1b[36m›\x1b[0m ${msg}`),
  ok: (msg: string) => console.log(`\x1b[32m✓\x1b[0m ${msg}`),
  warn: (msg: string) => console.log(`\x1b[33m!\x1b[0m ${msg}`),
  err: (msg: string) => console.error(`\x1b[31m✗\x1b[0m ${msg}`),
};
