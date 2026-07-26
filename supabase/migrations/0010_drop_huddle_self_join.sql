-- ─────────────────────────────────────────────────────────────────────────────
-- HungryHeads — remove the unsafe huddle self-join RLS policy.
--
-- SECURITY FIX (high). The old policy:
--
--   create policy "huddle_members_self_join" on public.huddle_members
--     for insert with check (auth.uid() = user_id);
--
-- let ANY authenticated user add themselves to ANY huddle straight from the
-- browser (they hold the public anon key), with no knowledge of the 6-letter
-- invite code:
--
--   supabase.from('huddle_members').insert({ huddle_id: '<uuid>', user_id: me })
--
-- Once "a member", they could read every other member's name + email (via the
-- profiles huddle-visibility policy), all poll responses, and huddle_orders.
-- Deleting a membership didn't help — they could just re-insert.
--
-- Nothing legitimate uses this policy: both createHuddle and joinHuddleByCode
-- insert membership via the service-role admin client server-side, and
-- joinHuddleByCode validates the invite code first. So we simply remove the
-- anon self-insert path. Leaving a huddle (delete) is unchanged.
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "huddle_members_self_join" on public.huddle_members;

-- Membership inserts now happen ONLY through service_role (which bypasses RLS)
-- inside joinHuddleByCode, and only after the correct 6-letter code is matched.
