/**
 * In-memory sliding-window rate limiter.
 *
 * Used by `/api/chat` to cap how often a single user can fire requests at the
 * Anthropic streaming endpoint — a hot loop or runaway client could otherwise
 * burn the API budget in seconds.
 *
 * Trade-offs:
 *   - Process-local. A multi-instance prod deploy would need Redis (Upstash)
 *     or Supabase to share state, but in dev / single-instance Vercel /
 *     single-Render-worker that's overkill.
 *   - Resets on cold start, which is fine for abuse mitigation (the cost of
 *     forgetting is one extra burst, not unbounded usage).
 *   - O(buckets) per check — bounded by the number of distinct keys seen
 *     within `windowMs`, so memory is tiny.
 */

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

/** Test-only — clears all buckets. Not exported via barrel. */
export function _resetRateLimit() {
  buckets.clear();
}
