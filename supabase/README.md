# Supabase — HungryHeads

This folder holds SQL migrations and dev seed data. The schema in
`migrations/0001_init.sql` matches brief §8 exactly.

## What's here

| File | Purpose |
|---|---|
| `migrations/0001_init.sql` | All 10 tables + RLS policies + Realtime registration + trigger that auto-creates a `profiles` row when a new `auth.users` row appears. **Idempotent** — uses `if not exists` / `drop policy if exists` so re-running is safe. |
| `seed.sql` | Optional local-dev fixtures. Templates only — uncomment + paste real auth UUIDs after creating test users. |

## How to run the migration

You have three options. Pick the one that matches your workflow.

### Option A — Supabase Dashboard (easiest, no CLI)

1. Create a new project at <https://supabase.com/dashboard>.
2. Open the **SQL Editor** in the left sidebar.
3. Paste the contents of `migrations/0001_init.sql` and click **Run**.
4. Copy the project URL and anon key into `hungryheads/.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Settings → API → `service_role` secret)

### Option B — Supabase CLI (recommended once project exists)

```bash
# install once
pnpm dlx supabase --version

# log in + link to your project
pnpm dlx supabase login
pnpm dlx supabase link --project-ref <your-project-ref>

# push the migration
pnpm dlx supabase db push
```

### Option C — Local Postgres via Supabase CLI (full offline dev)

```bash
pnpm dlx supabase start          # spins up local stack on Docker
pnpm dlx supabase db reset       # applies migrations from migrations/
```

## Regenerating TypeScript types

Once the schema is live in a real project:

```bash
pnpm dlx supabase gen types typescript --project-id <id> > types/database.ts
```

Until then, `types/database.ts` is hand-rolled to match the SQL — if you
edit one, edit both and keep them in lockstep.

## Notes on the schema

- **RLS is enabled on every table.** `profiles`, `user_preferences`,
  `user_allergies`, `swiggy_tokens`, `orders_cache`, and `agent_conversations`
  are owner-only. Huddle tables grant read access to all members of the huddle.
- **Two `SECURITY DEFINER` helpers** — `is_huddle_member` and `is_huddle_admin`
  — break self-referential recursion in the `huddle_members` policy.
- **Realtime** is enabled for the four huddle tables so FoodHuddle can stream
  joins / responses / recommendations live (brief §2.4).
- **Service-role writes only** for `swiggy_tokens` (token management) and
  `huddle_recommendations` (agent output). Use `lib/supabase/admin.ts` from
  trusted server code.
