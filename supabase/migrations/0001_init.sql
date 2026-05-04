-- ─────────────────────────────────────────────────────────────────────────────
-- HungryHeads — initial schema (brief §8)
--
-- Tables: profiles, user_preferences, user_allergies, swiggy_tokens,
--         orders_cache, huddles, huddle_members, huddle_responses,
--         huddle_recommendations, agent_conversations
--
-- All tables have Row-Level Security enabled. Policies are scoped so a user
-- can only see their own rows; huddle members can read shared huddle data.
-- ─────────────────────────────────────────────────────────────────────────────

-- Postgres extensions
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. profiles  — extends auth.users with our app profile
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  onboarded   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create a profile row when a new auth.users row appears
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. user_preferences  — onboarding answers + evolving prefs
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_preferences (
  user_id              uuid primary key references public.profiles(id) on delete cascade,
  cuisines             text[] not null default '{}',
  diet                 text,
  monthly_budget       integer,                              -- rupees, null = no limit
  delivery_radius_km   integer not null default 5,
  personality          text,
  updated_at           timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. user_allergies  — separate row per allergen for audit trail
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_allergies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  allergen    text not null,
  severity    text not null default 'high',                  -- high | medium | low
  created_at  timestamptz not null default now(),
  unique (user_id, allergen)
);
create index if not exists idx_user_allergies_user on public.user_allergies(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. swiggy_tokens  — encrypted access tokens (one row per user)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.swiggy_tokens (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  access_token   text not null,                              -- encrypt at rest via Supabase Vault
  expires_at     timestamptz not null,
  scopes         text[] not null default '{mcp:tools,mcp:resources,mcp:prompts}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. orders_cache  — local cache of Swiggy order history for SpendSmart + VoiceOrder
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.orders_cache (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  swiggy_order_id text not null,
  source          text not null,                             -- food | instamart | dineout
  total_amount    integer not null,                          -- rupees
  items           jsonb not null,
  restaurant_name text,
  ordered_at      timestamptz not null,
  raw_response    jsonb,
  created_at      timestamptz not null default now(),
  unique (user_id, swiggy_order_id)
);
create index if not exists idx_orders_user_time on public.orders_cache(user_id, ordered_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. huddles  — group decision sessions
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.huddles (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                          -- 6-letter join code
  admin_id    uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'open',                  -- open | polling | decided | ordered | closed
  mode        text,                                          -- order_in | dine_out
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);
create index if not exists idx_huddles_admin on public.huddles(admin_id);
create index if not exists idx_huddles_status on public.huddles(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. huddle_members  — who joined which huddle
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.huddle_members (
  huddle_id  uuid not null references public.huddles(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (huddle_id, user_id)
);
create index if not exists idx_huddle_members_user on public.huddle_members(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. huddle_responses  — per-member poll submission
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.huddle_responses (
  id            uuid primary key default gen_random_uuid(),
  huddle_id     uuid not null references public.huddles(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  cuisines      text[],
  mood          text,
  veg_only      boolean,
  budget        integer,
  max_distance  integer,
  submitted_at  timestamptz not null default now(),
  unique (huddle_id, user_id)
);
create index if not exists idx_huddle_responses_huddle on public.huddle_responses(huddle_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. huddle_recommendations  — top-3 results from the agent
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.huddle_recommendations (
  id           uuid primary key default gen_random_uuid(),
  huddle_id    uuid not null references public.huddles(id) on delete cascade,
  rank         integer not null,                              -- 1, 2, 3
  swiggy_id    text not null,
  name         text not null,
  cuisines     text[],
  rating       numeric,
  distance_km  numeric,
  reasoning    text,
  raw_data     jsonb,
  created_at   timestamptz not null default now(),
  unique (huddle_id, rank)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. agent_conversations  — per-user chat history
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.agent_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  messages    jsonb not null,
  context     text,                                           -- dashboard | huddle | voice
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_agent_conv_user on public.agent_conversations(user_id, updated_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Updated-at trigger helper (used by tables that have an updated_at column)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_user_preferences_touch on public.user_preferences;
create trigger trg_user_preferences_touch before update on public.user_preferences
  for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_swiggy_tokens_touch on public.swiggy_tokens;
create trigger trg_swiggy_tokens_touch before update on public.swiggy_tokens
  for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_agent_conv_touch on public.agent_conversations;
create trigger trg_agent_conv_touch before update on public.agent_conversations
  for each row execute procedure public.touch_updated_at();

-- ═════════════════════════════════════════════════════════════════════════════
-- RLS HELPERS — SECURITY DEFINER, used to break self-referential recursion
-- when a policy on huddle_members needs to check huddle_members itself.
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.is_huddle_member(p_huddle_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.huddle_members hm
    where hm.huddle_id = p_huddle_id and hm.user_id = p_user_id
  );
$$;

create or replace function public.is_huddle_admin(p_huddle_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.huddles h
    where h.id = p_huddle_id and h.admin_id = p_user_id
  );
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY (brief §8 — every table)
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.profiles                 enable row level security;
alter table public.user_preferences         enable row level security;
alter table public.user_allergies           enable row level security;
alter table public.swiggy_tokens            enable row level security;
alter table public.orders_cache             enable row level security;
alter table public.huddles                  enable row level security;
alter table public.huddle_members           enable row level security;
alter table public.huddle_responses         enable row level security;
alter table public.huddle_recommendations   enable row level security;
alter table public.agent_conversations      enable row level security;

-- profiles ────────────────────────────────────────────────────────────────────
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- (insert is handled by the on_auth_user_created trigger as security definer)

-- user_preferences ────────────────────────────────────────────────────────────
drop policy if exists "user_prefs_owner_all" on public.user_preferences;
create policy "user_prefs_owner_all" on public.user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_allergies ──────────────────────────────────────────────────────────────
drop policy if exists "user_allergies_owner_all" on public.user_allergies;
create policy "user_allergies_owner_all" on public.user_allergies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- swiggy_tokens ───────────────────────────────────────────────────────────────
-- Read-only for the user; writes happen server-side via service-role key.
drop policy if exists "swiggy_tokens_owner_select" on public.swiggy_tokens;
create policy "swiggy_tokens_owner_select" on public.swiggy_tokens
  for select using (auth.uid() = user_id);

-- orders_cache ────────────────────────────────────────────────────────────────
drop policy if exists "orders_cache_owner_all" on public.orders_cache;
create policy "orders_cache_owner_all" on public.orders_cache
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- huddles ─────────────────────────────────────────────────────────────────────
-- Members can read; only the admin can update/delete; any signed-in user can create.
drop policy if exists "huddles_member_select" on public.huddles;
create policy "huddles_member_select" on public.huddles
  for select using (
    auth.uid() = admin_id
    or public.is_huddle_member(id, auth.uid())
  );

drop policy if exists "huddles_admin_insert" on public.huddles;
create policy "huddles_admin_insert" on public.huddles
  for insert with check (auth.uid() = admin_id);

drop policy if exists "huddles_admin_update" on public.huddles;
create policy "huddles_admin_update" on public.huddles
  for update using (auth.uid() = admin_id) with check (auth.uid() = admin_id);

drop policy if exists "huddles_admin_delete" on public.huddles;
create policy "huddles_admin_delete" on public.huddles
  for delete using (auth.uid() = admin_id);

-- huddle_members ──────────────────────────────────────────────────────────────
-- A user sees member rows for huddles they belong to OR admin. Self-reference
-- broken via SECURITY DEFINER `public.is_huddle_member`.
drop policy if exists "huddle_members_visible_to_members" on public.huddle_members;
create policy "huddle_members_visible_to_members" on public.huddle_members
  for select using (
    auth.uid() = user_id
    or public.is_huddle_admin(huddle_id, auth.uid())
    or public.is_huddle_member(huddle_id, auth.uid())
  );

drop policy if exists "huddle_members_self_join" on public.huddle_members;
create policy "huddle_members_self_join" on public.huddle_members
  for insert with check (auth.uid() = user_id);

drop policy if exists "huddle_members_self_leave" on public.huddle_members;
create policy "huddle_members_self_leave" on public.huddle_members
  for delete using (
    auth.uid() = user_id
    or public.is_huddle_admin(huddle_id, auth.uid())
  );

-- huddle_responses ────────────────────────────────────────────────────────────
-- A response is visible to all members of the huddle; users can only write
-- their own response.
drop policy if exists "huddle_responses_member_select" on public.huddle_responses;
create policy "huddle_responses_member_select" on public.huddle_responses
  for select using (public.is_huddle_member(huddle_id, auth.uid()));

drop policy if exists "huddle_responses_self_write" on public.huddle_responses;
create policy "huddle_responses_self_write" on public.huddle_responses
  for insert with check (
    auth.uid() = user_id
    and public.is_huddle_member(huddle_id, auth.uid())
  );

drop policy if exists "huddle_responses_self_update" on public.huddle_responses;
create policy "huddle_responses_self_update" on public.huddle_responses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "huddle_responses_self_delete" on public.huddle_responses;
create policy "huddle_responses_self_delete" on public.huddle_responses
  for delete using (auth.uid() = user_id);

-- huddle_recommendations ──────────────────────────────────────────────────────
-- Read-only for members; writes happen server-side via service-role key.
drop policy if exists "huddle_recs_member_select" on public.huddle_recommendations;
create policy "huddle_recs_member_select" on public.huddle_recommendations
  for select using (public.is_huddle_member(huddle_id, auth.uid()));

-- agent_conversations ────────────────────────────────────────────────────────
drop policy if exists "agent_conv_owner_all" on public.agent_conversations;
create policy "agent_conv_owner_all" on public.agent_conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ═════════════════════════════════════════════════════════════════════════════
-- REALTIME — enable for tables FoodHuddle subscribes to (brief §2.4 live poll)
-- ═════════════════════════════════════════════════════════════════════════════
alter publication supabase_realtime add table public.huddles;
alter publication supabase_realtime add table public.huddle_members;
alter publication supabase_realtime add table public.huddle_responses;
alter publication supabase_realtime add table public.huddle_recommendations;
