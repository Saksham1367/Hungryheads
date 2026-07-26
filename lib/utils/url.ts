/**
 * URL / redirect safety helpers.
 */

/**
 * Validate a caller-supplied redirect target so we only ever bounce users to
 * our OWN app — never an attacker-controlled external site (open-redirect /
 * phishing). Returns the path if it's a clean same-origin absolute path,
 * otherwise the fallback.
 *
 * Rejects:
 *   - non-strings / empty
 *   - anything not starting with "/"            (absolute URLs like https://evil.com)
 *   - "//host" and "/\host"                     (protocol-relative → external host)
 *   - values containing a backslash             (browsers normalise "\" → "/")
 *
 * NOTE: a value that passes this is safe to concatenate onto our origin
 * (`${origin}${path}`) — the "user@host" and ".host" tricks only work when the
 * value does NOT start with a single "/", which we require.
 */
export function safeInternalPath(
  value: unknown,
  fallback = "/dashboard",
): string {
  if (typeof value !== "string" || value.length === 0) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  return value;
}
