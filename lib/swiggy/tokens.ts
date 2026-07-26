/**
 * Swiggy token persistence (brief §7.3).
 *
 * Stored in `swiggy_tokens`, RLS-gated to the owning user (read) and
 * service-role only (write). The `access_token` is encrypted at rest with
 * AES-256-GCM (see lib/swiggy/crypto.ts) — a live token can place real orders,
 * so RLS alone isn't enough; the encryption key lives only in the env, so a
 * database dump without the app env is useless.
 *
 * All functions in this module are server-only — they call createAdminClient
 * which throws at runtime if invoked from the browser.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { SWIGGY_SCOPES } from "@/lib/swiggy/oauth";
import { encryptSecret, decryptSecret } from "@/lib/swiggy/crypto";

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
      // Encrypted at rest — never store the raw token.
      access_token: encryptSecret(token.access_token),
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
    // Decrypt at read time. Legacy plaintext rows (pre-encryption) pass through
    // untouched and get re-encrypted next time the token is persisted.
    access_token: decryptSecret(data.access_token),
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
