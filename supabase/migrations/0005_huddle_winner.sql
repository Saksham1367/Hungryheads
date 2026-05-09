-- ─────────────────────────────────────────────────────────────────────────────
-- HungryHeads — adds winner_recommendation_id to huddle_sessions.
--
-- Records which of the top-3 picks the spin wheel landed on, so all members
-- see the same result (even if they reload after the spin animation).
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.huddle_sessions
  add column if not exists winner_recommendation_id uuid
    references public.huddle_recommendations(id) on delete set null;
