-- ─────────────────────────────────────────────────────────────────────────────
-- HungryHeads — adds learned_fact column to chat_messages.
--
-- The system prompt asks Claude to end replies with `LEARNED: <fact>` when it
-- commits a new stable preference. We strip that line from the saved content
-- and persist:
--   • The fact to `agent_memory` (loops back into future system prompts)
--   • A copy on the originating chat_message so the "Learned: ..." pill
--     renders next to that turn
--
-- Idempotent. No data migration needed.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.chat_messages
  add column if not exists learned_fact text;
