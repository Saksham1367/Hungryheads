-- ─────────────────────────────────────────────────────────────────────────────
-- HungryHeads — distributed rate limiter.
--
-- The in-memory limiter in lib/ratelimit.ts is process-local: on Vercel every
-- request can land on a different serverless instance and cold starts wipe the
-- counters, so it can't actually cap a user's spend across the fleet. This adds
-- a shared, authoritative counter in Postgres.
--
-- Design: fixed-window counter. One row per key. The check + increment happens
-- in a SINGLE atomic upsert inside check_rate_limit(), so concurrent requests
-- from different instances can't race past the cap. Worst case is ~2x burst at
-- a window boundary — the same trade-off the in-memory limiter documented, and
-- fine for abuse mitigation (the goal is "can't burn the API budget", not exact
-- fairness).
--
-- Access: the table is RLS-locked with NO policies, so anon/authenticated have
-- no access. Only the service role (via createAdminClient, which has BYPASSRLS)
-- touches it, exclusively through the function below.
--
-- Idempotent. No data migration needed.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        int         not null default 0,
  updated_at   timestamptz not null default now()
);

-- Lock the table down. No policies => anon/authenticated get nothing.
-- service_role bypasses RLS and is the only caller.
alter table public.rate_limits enable row level security;

-- Atomic check-and-increment for a fixed window.
--   p_key            stable identifier, e.g. 'chat:<userId>'
--   p_max            max requests allowed within the window
--   p_window_seconds window length in seconds
-- Returns one row: (allowed, remaining, retry_after_seconds).
create or replace function public.check_rate_limit(
  p_key text,
  p_max int,
  p_window_seconds int
)
returns table (allowed boolean, remaining int, retry_after_seconds int)
language plpgsql
as $$
declare
  v_now    timestamptz := now();
  v_window timestamptz;
  v_count  int;
begin
  -- Single atomic statement: start a fresh window if none exists or the current
  -- one has expired, otherwise increment. Both CASE expressions read the OLD
  -- row (rl.*) consistently, since SET is evaluated against the pre-update row.
  insert into public.rate_limits as rl (key, window_start, count, updated_at)
  values (p_key, v_now, 1, v_now)
  on conflict (key) do update
    set
      window_start = case
        when rl.window_start < v_now - make_interval(secs => p_window_seconds)
          then v_now
        else rl.window_start
      end,
      count = case
        when rl.window_start < v_now - make_interval(secs => p_window_seconds)
          then 1
        else rl.count + 1
      end,
      updated_at = v_now
  returning rl.window_start, rl.count into v_window, v_count;

  if v_count <= p_max then
    return query select true, greatest(0, p_max - v_count), 0;
  else
    return query select
      false,
      0,
      greatest(
        0,
        ceil(extract(epoch from (v_window + make_interval(secs => p_window_seconds) - v_now)))
      )::int;
  end if;
end;
$$;

-- Only the service role may execute it (defense in depth — authenticated callers
-- would hit RLS on the table anyway, but deny execution outright).
revoke all on function public.check_rate_limit(text, int, int) from public;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
