-- ─────────────────────────────────────────────────────────────────────────────
-- HungryHeads — chat-first dashboard + persistent huddles (Phase 1 redesign)
--
-- This migration assumes 0001_init.sql has already been applied. It is
-- idempotent and safe to re-run.
--
-- Adds:
--   • chats               — multi-thread conversations per user
--   • chat_messages       — individual messages with mode + payload (order
--                           cards, polls, memory pills, tool calls)
--   • agent_memory        — long-term facts about the user, fed back into the
--                           system prompt on each turn
--   • huddle_sessions     — each "Decide!" trigger inside a persistent huddle
--   • huddle_orders       — orders placed by a huddle, queryable per group
--
-- Modifies:
--   • huddles             — adds `name` column, `mode` becomes per-session
--   • huddle_responses    — references huddle_session_id (was huddle_id)
--   • huddle_recommendations — references huddle_session_id (was huddle_id)
--
-- Drops:
--   • agent_conversations — superseded by chats + chat_messages
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- SCHEMA: chats / chat_messages / agent_memory
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.chats (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  title           text not null default 'New chat',
  mode            text not null default 'hungry',  -- hungry | diet | budget
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint chats_mode_chk check (mode in ('hungry', 'diet', 'budget'))
);
create index if not exists idx_chats_user_recent
  on public.chats(user_id, last_message_at desc);

create table if not exists public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  chat_id       uuid not null references public.chats(id) on delete cascade,
  role          text not null,                    -- user | agent | system
  content       text not null default '',
  mode_at_send  text not null default 'hungry',
  payload       jsonb,                            -- order_summary | memory | poll | etc.
  tool_calls    jsonb,                            -- raw Anthropic tool-use records
  created_at    timestamptz not null default now(),
  constraint chat_messages_role_chk check (role in ('user', 'agent', 'system')),
  constraint chat_messages_mode_chk check (mode_at_send in ('hungry', 'diet', 'budget'))
);
create index if not exists idx_chat_messages_thread
  on public.chat_messages(chat_id, created_at);

create table if not exists public.agent_memory (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  fact            text not null,
  source_chat_id  uuid references public.chats(id) on delete set null,
  confidence      numeric not null default 0.8,   -- 0..1
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint agent_memory_confidence_chk check (confidence between 0 and 1)
);
create index if not exists idx_agent_memory_user_recent
  on public.agent_memory(user_id, updated_at desc);

-- Touch updated_at triggers (function lives in 0001_init.sql)
drop trigger if exists trg_chats_touch on public.chats;
create trigger trg_chats_touch before update on public.chats
  for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_agent_memory_touch on public.agent_memory;
create trigger trg_agent_memory_touch before update on public.agent_memory
  for each row execute procedure public.touch_updated_at();

-- ═════════════════════════════════════════════════════════════════════════════
-- SCHEMA: persistent huddles → many sessions, many orders
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. huddles gains a name. (Existing rows keep their old null name.)
alter table public.huddles
  add column if not exists name text;

-- 2. huddle_sessions — each "Decide!" press creates one
create table if not exists public.huddle_sessions (
  id            uuid primary key default gen_random_uuid(),
  huddle_id     uuid not null references public.huddles(id) on delete cascade,
  triggered_by  uuid not null references public.profiles(id),
  status        text not null default 'polling',
  -- polling | decided | ordered | cancelled
  mode          text,                             -- order_in | dine_out
  created_at    timestamptz not null default now(),
  closed_at     timestamptz,
  constraint huddle_sessions_status_chk
    check (status in ('polling', 'decided', 'ordered', 'cancelled')),
  constraint huddle_sessions_mode_chk
    check (mode is null or mode in ('order_in', 'dine_out'))
);
create index if not exists idx_huddle_sessions_huddle
  on public.huddle_sessions(huddle_id, created_at desc);

-- 3. huddle_responses — drop+recreate referencing huddle_session_id.
--    (Phase-1 fresh project, no production data to preserve.)
drop table if exists public.huddle_responses cascade;
create table public.huddle_responses (
  id                  uuid primary key default gen_random_uuid(),
  huddle_session_id   uuid not null references public.huddle_sessions(id) on delete cascade,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  cuisines            text[],
  mood                text,
  veg_only            boolean,
  budget              integer,
  max_distance        integer,
  submitted_at        timestamptz not null default now(),
  unique (huddle_session_id, user_id)
);
create index if not exists idx_huddle_responses_session
  on public.huddle_responses(huddle_session_id);

-- 4. huddle_recommendations — same shift to session-scoped
drop table if exists public.huddle_recommendations cascade;
create table public.huddle_recommendations (
  id                  uuid primary key default gen_random_uuid(),
  huddle_session_id   uuid not null references public.huddle_sessions(id) on delete cascade,
  rank                integer not null,
  swiggy_id           text not null,
  name                text not null,
  cuisines            text[],
  rating              numeric,
  distance_km         numeric,
  reasoning           text,
  raw_data            jsonb,
  created_at          timestamptz not null default now(),
  unique (huddle_session_id, rank)
);

-- 5. huddle_orders — record of orders the group actually placed
create table if not exists public.huddle_orders (
  id              uuid primary key default gen_random_uuid(),
  huddle_id       uuid not null references public.huddles(id) on delete cascade,
  session_id      uuid references public.huddle_sessions(id) on delete set null,
  placed_by       uuid not null references public.profiles(id),
  swiggy_order_id text,
  restaurant_name text,
  total_amount    integer not null,
  items           jsonb not null,
  ordered_at      timestamptz not null default now()
);
create index if not exists idx_huddle_orders_huddle_time
  on public.huddle_orders(huddle_id, ordered_at desc);

-- 6. Drop the old single-row-per-user agent_conversations.
drop table if exists public.agent_conversations cascade;

-- ═════════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY for new tables
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.chats               enable row level security;
alter table public.chat_messages       enable row level security;
alter table public.agent_memory        enable row level security;
alter table public.huddle_sessions     enable row level security;
alter table public.huddle_responses    enable row level security;
alter table public.huddle_recommendations enable row level security;
alter table public.huddle_orders       enable row level security;

-- chats — owner-only
drop policy if exists "chats_owner_all" on public.chats;
create policy "chats_owner_all" on public.chats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- chat_messages — visible to chat owner
drop policy if exists "chat_msgs_owner_select" on public.chat_messages;
create policy "chat_msgs_owner_select" on public.chat_messages
  for select using (
    exists (select 1 from public.chats c
            where c.id = chat_id and c.user_id = auth.uid())
  );

drop policy if exists "chat_msgs_owner_insert" on public.chat_messages;
create policy "chat_msgs_owner_insert" on public.chat_messages
  for insert with check (
    exists (select 1 from public.chats c
            where c.id = chat_id and c.user_id = auth.uid())
  );

drop policy if exists "chat_msgs_owner_delete" on public.chat_messages;
create policy "chat_msgs_owner_delete" on public.chat_messages
  for delete using (
    exists (select 1 from public.chats c
            where c.id = chat_id and c.user_id = auth.uid())
  );

-- agent_memory — owner-only
drop policy if exists "agent_memory_owner_all" on public.agent_memory;
create policy "agent_memory_owner_all" on public.agent_memory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- huddle_sessions — visible to huddle members; trigger only by members
drop policy if exists "huddle_sessions_member_select" on public.huddle_sessions;
create policy "huddle_sessions_member_select" on public.huddle_sessions
  for select using (
    public.is_huddle_member(huddle_id, auth.uid())
    or public.is_huddle_admin(huddle_id, auth.uid())
  );

drop policy if exists "huddle_sessions_member_insert" on public.huddle_sessions;
create policy "huddle_sessions_member_insert" on public.huddle_sessions
  for insert with check (
    auth.uid() = triggered_by
    and public.is_huddle_member(huddle_id, auth.uid())
  );

drop policy if exists "huddle_sessions_admin_update" on public.huddle_sessions;
create policy "huddle_sessions_admin_update" on public.huddle_sessions
  for update using (
    public.is_huddle_admin(huddle_id, auth.uid())
    or auth.uid() = triggered_by
  ) with check (
    public.is_huddle_admin(huddle_id, auth.uid())
    or auth.uid() = triggered_by
  );

-- huddle_responses — session-scoped via parent huddle membership
drop policy if exists "huddle_responses_member_select" on public.huddle_responses;
create policy "huddle_responses_member_select" on public.huddle_responses
  for select using (
    exists (
      select 1 from public.huddle_sessions hs
      where hs.id = huddle_session_id
        and public.is_huddle_member(hs.huddle_id, auth.uid())
    )
  );

drop policy if exists "huddle_responses_self_write" on public.huddle_responses;
create policy "huddle_responses_self_write" on public.huddle_responses
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.huddle_sessions hs
      where hs.id = huddle_session_id
        and public.is_huddle_member(hs.huddle_id, auth.uid())
    )
  );

drop policy if exists "huddle_responses_self_update" on public.huddle_responses;
create policy "huddle_responses_self_update" on public.huddle_responses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "huddle_responses_self_delete" on public.huddle_responses;
create policy "huddle_responses_self_delete" on public.huddle_responses
  for delete using (auth.uid() = user_id);

-- huddle_recommendations — read-only for members; service-role writes
drop policy if exists "huddle_recs_member_select" on public.huddle_recommendations;
create policy "huddle_recs_member_select" on public.huddle_recommendations
  for select using (
    exists (
      select 1 from public.huddle_sessions hs
      where hs.id = huddle_session_id
        and public.is_huddle_member(hs.huddle_id, auth.uid())
    )
  );

-- huddle_orders — visible to all huddle members
drop policy if exists "huddle_orders_member_select" on public.huddle_orders;
create policy "huddle_orders_member_select" on public.huddle_orders
  for select using (
    public.is_huddle_member(huddle_id, auth.uid())
    or public.is_huddle_admin(huddle_id, auth.uid())
  );

drop policy if exists "huddle_orders_member_insert" on public.huddle_orders;
create policy "huddle_orders_member_insert" on public.huddle_orders
  for insert with check (
    auth.uid() = placed_by
    and public.is_huddle_member(huddle_id, auth.uid())
  );

-- ═════════════════════════════════════════════════════════════════════════════
-- REALTIME — chat threads + huddle session activity
-- ═════════════════════════════════════════════════════════════════════════════
-- Wrap each `add table` in DO blocks because the publication may already
-- contain the table from 0001_init.sql; alter publication ... add is
-- idempotent in 16+ but the DO guard makes this safe on older Postgres too.

do $$ begin
  alter publication supabase_realtime add table public.chats;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.huddle_sessions;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.huddle_orders;
exception when duplicate_object then null; end $$;

-- huddle_responses + huddle_recommendations were registered in 0001;
-- after drop+recreate they need re-registering.
do $$ begin
  alter publication supabase_realtime add table public.huddle_responses;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.huddle_recommendations;
exception when duplicate_object then null; end $$;
