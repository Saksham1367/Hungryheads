/**
 * Swiggy token persistence (brief §7.3).
 *
 * Phase 1: stored in `swiggy_tokens` row, RLS-gated to the owning user
 * (read) and service-role only (write). Plain text — replace with Supabase
 * Vault in Phase 2 before public launch.
 *
 * All functions in this module are server-only — they call createAdminClient
 * which throws at runtime if invoked from the browser.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { SWIGGY_SCOPES } from "@/lib/swiggy/oauth";

export interface StoredSwiggyToken {
  access_token: string;
  expires_at: Date;
  scopes: string[];
}

export async function persistSwiggyToken(
  userId: string,
  token: {
    access_token: string;
    expires_in: number;
    scope?: string;
  },
): Promise<void> {
  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + token.expires_in * 1000);
  const scopes = token.scope ? token.scope.split(/\s+/) : SWIGGY_SCOPES;

  const { error } = await admin.from("swiggy_tokens").upsert(
    {
      user_id: userId,
      access_token: token.access_token,
      expires_at: expiresAt.toISOString(),
      scopes,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`Failed to persist Swiggy token: ${error.message}`);
}

/**
 * Returns the user's current token, or null if disconnected / expired.
 * Refresh isn't supported in v1 — caller should redirect to /connect-swiggy
 * when this returns null.
 */
export async function getSwiggyToken(
  userId: string,
): Promise<StoredSwiggyToken | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("swiggy_tokens")
    .select("access_token, expires_at, scopes")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Failed to read Swiggy token: ${error.message}`);
  if (!data) return null;

  const expiresAt = new Date(data.expires_at);
  if (expiresAt <= new Date()) return null; // expired
  return {
    access_token: data.access_token,
    expires_at: expiresAt,
    scopes: data.scopes,
  };
}

export async function deleteSwiggyToken(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("swiggy_tokens")
    .delete()
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to delete Swiggy token: ${error.message}`);
}

/** True if the user has a non-expired Swiggy token. */
export async function isSwiggyConnected(userId: string): Promise<boolean> {
  return (await getSwiggyToken(userId)) !== null;
}
