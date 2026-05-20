-- 0006_chat_shares.sql
--
-- Public chat snapshots. When a user clicks "Share" on a chat we freeze the
-- current message list into `snapshot` (jsonb) and hand back a token URL like
-- /share/<token>. The recipient hits a public viewer that reads the row via
-- the admin client — RLS stays strict for owner reads/deletes but the public
-- viewer route uses service_role to look up by token. Snapshots are frozen so
-- post-share edits don't leak.

create table if not exists public.chat_shares (
  id          uuid primary key default gen_random_uuid(),
  chat_id     uuid not null references public.chats(id) on delete cascade,
  shared_by   uuid not null references public.profiles(id) on delete cascade,
  token       text not null unique,
  title       text not null,
  snapshot    jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_chat_shares_token on public.chat_shares(token);
create index if not exists idx_chat_shares_owner on public.chat_shares(shared_by, created_at desc);

alter table public.chat_shares enable row level security;

-- Owners manage their shares; public reads happen via service-role from the
-- public viewer route (no public RLS policy granted on purpose).
drop policy if exists "chat_shares_owner_select" on public.chat_shares;
create policy "chat_shares_owner_select" on public.chat_shares
  for select using (auth.uid() = shared_by);

drop policy if exists "chat_shares_owner_insert" on public.chat_shares;
create policy "chat_shares_owner_insert" on public.chat_shares
  for insert with check (
    auth.uid() = shared_by
    and exists (
      select 1 from public.chats
      where chats.id = chat_id and chats.user_id = auth.uid()
    )
  );

drop policy if exists "chat_shares_owner_delete" on public.chat_shares;
create policy "chat_shares_owner_delete" on public.chat_shares
  for delete using (auth.uid() = shared_by);
