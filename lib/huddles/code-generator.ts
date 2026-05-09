/**
 * Six-letter huddle invite codes.
 *
 * Alphabet excludes ambiguous characters (0/O, 1/I/L) so codes are easy to
 * read aloud and type. 32 chars × 6 positions ≈ 1 billion possible codes.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateHuddleCode(length = 6): string {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** Defensive normaliser for codes the user types in. */
export function normaliseHuddleCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidHuddleCode(code: string): boolean {
  const c = normaliseHuddleCode(code);
  if (c.length !== 6) return false;
  for (const ch of c) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}
