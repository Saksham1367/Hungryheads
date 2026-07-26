/**
 * Authenticated encryption for secrets at rest (Swiggy access tokens).
 *
 * A live Swiggy access token can place real COD orders, so we don't want it
 * sitting in the database as plaintext. RLS + service-role-only writes keep it
 * away from other users, but that's not enough on its own: if the service-role
 * key leaks or the database is dumped, plaintext tokens are instant account
 * takeover. So we encrypt with AES-256-GCM using a key that lives ONLY in the
 * environment (`SWIGGY_TOKEN_ENC_KEY`), never in the DB — a database breach
 * alone is then useless without also stealing the app's env.
 *
 * Format:  v1:<iv_b64>:<ciphertext_b64>:<auth_tag_b64>   (all base64url-free b64)
 *
 * Server-only. Node crypto — no external dependency.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce, the GCM standard
const KEY_BYTES = 32; // AES-256

let _key: Buffer | null = null;

/**
 * Load + validate the 32-byte key from `SWIGGY_TOKEN_ENC_KEY`. Accepts hex
 * (64 chars) or base64. Throws a clear, actionable error if missing/malformed
 * — we FAIL CLOSED rather than silently fall back to storing plaintext.
 *
 * Generate one with:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
function encryptionKey(): Buffer {
  if (_key) return _key;
  const raw = process.env.SWIGGY_TOKEN_ENC_KEY;
  if (!raw) {
    throw new Error(
      "SWIGGY_TOKEN_ENC_KEY is not set. Generate one with " +
        "`node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"` " +
        "and add it to .env.local (and your Vercel env). It must stay constant — " +
        "changing it makes existing encrypted tokens unreadable.",
    );
  }
  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `SWIGGY_TOKEN_ENC_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}). ` +
        "Use 64 hex chars or the base64 of 32 random bytes.",
    );
  }
  _key = key;
  return key;
}

/** Encrypt a secret. Returns the versioned, self-describing string above. */
export function encryptSecret(plaintext: string): string {
  const key = encryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64")}:${ciphertext.toString(
    "base64",
  )}:${tag.toString("base64")}`;
}

/**
 * Decrypt a value produced by encryptSecret. If the value isn't in our
 * versioned format it's treated as a LEGACY PLAINTEXT token (rows written
 * before encryption shipped) and returned as-is — so existing connections keep
 * working; they get re-encrypted the next time the token is persisted.
 */
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(`${VERSION}:`)) {
    return stored; // legacy plaintext — nothing to decrypt
  }
  const [, ivB64, ctB64, tagB64] = stored.split(":");
  if (!ivB64 || !ctB64 || !tagB64) {
    throw new Error("Malformed encrypted secret — expected v1:iv:ct:tag.");
  }
  const key = encryptionKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** True if a stored value is already in our encrypted format. */
export function isEncrypted(stored: string): boolean {
  return stored.startsWith(`${VERSION}:`);
}
