-- ─────────────────────────────────────────────────────────────────────────────
-- HungryHeads — fix: chat_messages UPDATE policy
--
-- 0002 created SELECT / INSERT / DELETE policies but missed UPDATE. That meant
-- order-place server actions (which flip chat_messages.payload from
-- status='draft' → 'placed') silently affected 0 rows. The card morphed
-- optimistically in the client, but on refresh the un-updated DB row showed
-- the draft state again.
--
-- This adds the missing UPDATE policy: a user can update messages in chats
-- they own. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "chat_msgs_owner_update" on public.chat_messages;
create policy "chat_msgs_owner_update" on public.chat_messages
  for update
  using (
    exists (
      select 1 from public.chats c
      where c.id = chat_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chats c
      where c.id = chat_id and c.user_id = auth.uid()
    )
  );
