-- 0007_huddle_member_profile_visibility.sql
--
-- Fix: huddle members appeared as "Member" instead of their real names.
-- Cause: profiles RLS only let users SELECT their own row, so the bulk
-- profile lookup in `loadHuddleByCode` returned just the viewer's row and
-- everyone else fell through to the "Member" placeholder.
--
-- Policy: a profile is visible to anyone who shares a huddle with that
-- profile's owner. Composes with `profiles_self_select` (OR semantics in
-- Postgres RLS).
--
-- Triggered_by / placed_by name lookups in past-sessions / order history
-- benefit from this too — no separate policy needed.

drop policy if exists "profiles_huddle_member_select" on public.profiles;
create policy "profiles_huddle_member_select" on public.profiles
  for select using (
    exists (
      select 1
      from public.huddle_members hm_self
      join public.huddle_members hm_other
        on hm_self.huddle_id = hm_other.huddle_id
      where hm_self.user_id = auth.uid()
        and hm_other.user_id = profiles.id
    )
  );
