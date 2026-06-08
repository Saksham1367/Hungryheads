/**
 * Rate limiting for `/api/chat`, in two layers:
 *
 *   1. `checkRateLimit` — in-memory sliding window. Fast, no I/O. Process-local,
 *      so on multi-instance / serverless it only sees one instance's traffic and
 *      resets on cold start. Kept as a cheap first-pass.
 *   2. `checkRateLimitDistributed` — the authoritative check. Runs the in-memory
 *      pass first (free early-out), then an atomic Postgres counter shared across
 *      every instance (migration 0009). This is what actually caps a user's spend
 *      fleet-wide. Falls back to the in-memory result if the DB call fails, so a
 *      database blip never takes chat down.
 *
 * Both cap how often a single user can fire requests at the Anthropic streaming
 * endpoint — a hot loop or runaway client could otherwise burn the API budget
 * in seconds.
 */
import { createAdminClient } from "@/lib/supabase/admin";

interface Bucket {
  /** Timestamps of requests within the current window (ms epoch). */
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  /** True if the caller is within budget and the request should proceed. */
  ok: boolean;
  /** Requests remaining in the current window after this one. */
  remaining: number;
  /** Seconds until the oldest hit ages out (rounded up). */
  retryAfterSeconds: number;
}

/**
 * Sliding-window rate limit check + record.
 *
 * @param key    Stable identifier — usually `userId`. Falls back to IP if
 *               unauthenticated. NEVER use untrusted input directly.
 * @param max    Max requests allowed within `windowMs`.
 * @param windowMs Window length in ms.
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }

  // Drop expired hits (in place — buckets are append-only ordered by time).
  while (bucket.hits.length > 0 && bucket.hits[0] < cutoff) {
    bucket.hits.shift();
  }

  if (bucket.hits.length >= max) {
    const oldest = bucket.hits[0];
    const waitMs = Math.max(0, oldest + windowMs - now);
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(waitMs / 1000),
    };
  }

  bucket.hits.push(now);
  return {
    ok: true,
    remaining: max - bucket.hits.length,
    retryAfterSeconds: 0,
  };
}

// Shape returned by the check_rate_limit() SQL function (migration 0009).
interface RateLimitRpcRow {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
}

// `check_rate_limit` isn't in the generated Database types (the project has no
// other RPCs to seed them), so we type the call locally instead of regenerating
// the whole schema. We cast the WHOLE client to this shape and call
// `admin.rpc(...)` as a method — never detach `.rpc` into a variable, or it
// loses the `this` binding the SDK relies on and throws before hitting Postgres.
interface AdminWithCheckRpc {
  rpc(
    fn: "check_rate_limit",
    args: { p_key: string; p_max: number; p_window_seconds: number },
  ): Promise<{ data: RateLimitRpcRow[] | null; error: { message: string } | null }>;
}

/**
 * Distributed, cross-instance rate limit check.
 *
 * 1. In-memory pass first — a free early-out that also shields the DB from a
 *    client hammering the same instance.
 * 2. Atomic Postgres counter (shared across all serverless instances) — the
 *    authoritative cap.
 *
 * On any DB failure it logs and returns the in-memory result rather than
 * blocking the user: a transient database problem must not break chat.
 *
 * @param key      Stable identifier — usually `chat:<userId>`.
 * @param max      Max requests allowed within `windowMs`.
 * @param windowMs Window length in ms.
 */
export async function checkRateLimitDistributed(
  key: string,
  max: number,
  windowMs: number,
): Promise<RateLimitResult> {
  // 1) Fast process-local pass. If this trips, no need to touch the DB.
  const local = checkRateLimit(key, max, windowMs);
  if (!local.ok) return local;

  // 2) Authoritative shared counter.
  try {
    const admin = createAdminClient() as unknown as AdminWithCheckRpc;
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: Math.ceil(windowMs / 1000),
    });
    if (error) throw new Error(error.message);
    const row = data?.[0];
    if (!row) throw new Error("check_rate_limit returned no row");
    return {
      ok: row.allowed,
      remaining: row.remaining,
      retryAfterSeconds: row.retry_after_seconds,
    };
  } catch (err) {
    // Graceful degradation — the in-memory pass already gave a layer of cover.
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "warn",
        event: "ratelimit_fallback",
        detail: err instanceof Error ? err.message : String(err),
      }),
    );
    return local; // local.ok === true here
  }
}

/** Test-only — clears all buckets. Not exported via barrel. */
export function _resetRateLimit() {
  buckets.clear();
}
