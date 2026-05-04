/**
 * Server-only Supabase client using the SERVICE_ROLE key.
 *
 * Bypasses Row-Level Security. Use sparingly and ONLY in trusted server code:
 *   - Persisting Swiggy OAuth tokens after PKCE callback (writes to swiggy_tokens)
 *   - Writing huddle_recommendations from the agent
 *   - Caching orders pulled from Swiggy MCP
 *
 * Never import this module in a client component or expose its return value
 * over the wire — that would leak an admin-level credential.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let _admin: ReturnType<typeof createClient<Database>> | null = null;

export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminClient must never be called from the browser. " +
        "It uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.",
    );
  }
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.",
    );
  }

  _admin = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}
