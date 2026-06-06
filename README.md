# HungryHeads

> An AI food companion built on Swiggy's Builders Club MCP platform.
> **Decide. Order. Eat. Together — without the headache.**

HungryHeads is a single AI agent that settles the group dinner debate, watches
your budget, and never lets an allergen slip through. One user profile, one
agent core, one streaming chat — surfaced as three features.

| Feature | What it does |
|---|---|
| **SafePlate** | Allergy & diet safety net. Dual-layer deterministic validation filters menus and **hard-blocks** risky items at checkout — even when a restaurant mislabels a dish. |
| **SpendSmart** | Monthly budget guardrail. Budget mode leads every reply with spend impact and cheaper swaps. |
| **FoodHuddle** | Real-time group decision engine. Members poll their preferences; a constraint solver ranks the top 3 spots that respect everyone's allergies and budget, then spins the wheel. |

---

## Table of contents

1. [Stack](#stack)
2. [High-level architecture](#high-level-architecture)
3. [The agent core](#the-agent-core)
4. [SafePlate — dual-layer safety](#safeplate--dual-layer-safety)
5. [FoodHuddle — real-time group decisions](#foodhuddle--real-time-group-decisions)
6. [Swiggy MCP layer (mock ⇄ live)](#swiggy-mcp-layer-mock--live)
7. [Data model](#data-model)
8. [Auth & security](#auth--security)
9. [Request lifecycle: a chat message end-to-end](#request-lifecycle-a-chat-message-end-to-end)
10. [Project structure](#project-structure)
11. [Getting started](#getting-started)
12. [Environment](#environment)
13. [What's next](#whats-next)

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router, RSC + Server Actions) · TypeScript |
| UI | Tailwind CSS · custom design system · lucide-react · react-markdown |
| Data / Auth | Supabase (Postgres + Row-Level Security + Auth + Realtime) |
| AI | Anthropic SDK (Claude, streaming + tool use) |
| Commerce | Swiggy Builders Club MCP (mock fixtures now → live MCP post-approval) |
| Validation | Zod schemas · deterministic keyword validator |
| Tooling | pnpm · `tsx` for standalone scripts |

---

## High-level architecture

```
                          ┌──────────────────────────────────────┐
   Browser (React)        │            Next.js (Vercel)          │
 ┌──────────────────┐     │  ┌────────────────────────────────┐  │
 │  Marketing site  │     │  │  RSC pages + Server Actions    │  │
 │  Dashboard chat  │◀───▶│  │  /api/chat  (SSE streaming)    │  │
 │  Huddle room     │     │  │  /api/swiggy-oauth/*           │  │
 └──────────────────┘     │  └───────────────┬────────────────┘  │
        ▲                  │                  │                    │
        │ Realtime         │     ┌────────────┼─────────────┐      │
        │ (postgres_       │     ▼            ▼             ▼      │
        │  changes)        │  Agent core   SafePlate   Huddle      │
        │                  │  (Claude +    validator    engine     │
        │                  │   tools)                              │
        └──────────────────┼─────────────────┬─────────────────── │
                           └─────────┬────────┼────────────────────┘
                                     ▼        ▼
                          ┌──────────────┐  ┌────────────────────┐
                          │   Supabase   │  │  Swiggy MCP layer  │
                          │  Postgres+RLS│  │  mock ⇄ live (env) │
                          │  Auth        │  │  fixtures / OAuth  │
                          │  Realtime    │  └────────────────────┘
                          └──────────────┘
```

Three independent server-side subsystems sit behind the same chat:

- **Agent core** — turns a user message into a streamed Claude reply with tool use.
- **SafePlate validator** — deterministic safety gate, called by both the agent's menu tool and the checkout action.
- **Huddle engine** — a constraint solver that ranks restaurants for a group.

Everything persists to Supabase Postgres, which is also the realtime bus for live huddles.

---

## The agent core

Everything the assistant does flows through one streaming endpoint:
[`app/api/chat/route.ts`](app/api/chat/route.ts). It is a Node runtime route that
returns a `text/event-stream` of JSON events.

### Per-message pipeline

```
POST /api/chat  (JSON or multipart for attachments)
   │
   ├─ auth (Supabase) ─ rate-limit (per user) ─ parse + attachment handling
   │
   ├─ persist the user message  (or: regenerate / edit-and-resend branches)
   │
   ├─ build system prompt  ← user profile + long-term memory + mode
   │
   └─ tool-use loop (≤ 8 turns), streaming to the client:
        Claude streams text  ───────────────▶  delta events
        Claude requests a tool  ────────────▶  tool_start / tool_end events
           runs the tool (Swiggy mock or internal)  ─ pill shown ≥700ms
           feeds the result back to Claude
        ...repeats until Claude returns a final text answer
   │
   └─ persist agent message (+ tool record, order card, learned facts)
        emit `done`
```

The streamed event protocol lives in [`lib/chat/stream.ts`](lib/chat/stream.ts):
`start · delta · tool_start · tool_end · memory_saved · allergy_saved · done · error`.
The browser consumes it in [`components/chat/shell.tsx`](components/chat/shell.tsx)
and renders in [`components/chat/thread.tsx`](components/chat/thread.tsx).

### System prompt

[`lib/agent/system-prompts.ts`](lib/agent/system-prompts.ts) composes the prompt
fresh per request from: brand voice → memory/safety directives → hard
constraints (the user's allergies, ₹1000 cap, COD-only, never auto-place) →
the active **mode** (Hungry / Diet / Budget, see [`lib/chat/modes.ts`](lib/chat/modes.ts))
→ a profile snapshot ([`lib/agent/profile.ts`](lib/agent/profile.ts)) → the
user's long-term memory facts.

### Tools

Defined in [`lib/agent/tools.ts`](lib/agent/tools.ts). Two groups:

**Swiggy MCP tools** (dispatched through the mock/live layer):
`get_addresses · search_restaurants · get_restaurant_menu · update_food_cart ·
get_food_cart · flush_food_cart · fetch_food_coupons · apply_food_coupon ·
place_food_order · track_food_order · get_food_orders · report_error`.

**HungryHeads-internal tools** (handled directly in the route; they write to *our*
database, not Swiggy):

| Tool | Effect |
|---|---|
| `remember_preference` | Saves a stable fact to `agent_memory` (deduped) → "Learned" pill, recalled in every future chat. |
| `update_allergy` | Writes to `user_allergies` — the **hard** SafePlate gate. Chat-stated allergies block at checkout. |
| `propose_order` | The server builds + validates the order card from items + fees, **computing totals and enforcing the cap** so a truncated/incorrect reply can't produce a broken card. |

Reliability is built on a principle: **anything important is a real tool call,
not a magic string the model has to remember to emit.** Models call tools
reliably; trailing-string conventions are a probability game.

### Memory

[`lib/agent/memory.ts`](lib/agent/memory.ts) — `saveMemoryFacts` dedupes
(case/punctuation-normalized) against existing rows, bumps recency on repeats,
and prunes to a per-user cap. `loadTopMemories` hydrates the most recent facts
into every system prompt. This is the personalization layer that makes the agent
feel like it knows you across conversations.

### Attachments & vision

[`lib/chat/attachments.ts`](lib/chat/attachments.ts) accepts one file per message
(≤ 5 MB):

- **Images** (JPEG/PNG/GIF/WebP) → sent to Claude as native **vision** blocks.
- **PDFs** → native `document` blocks.
- **DOC/DOCX/XLS/XLSX/CSV** → extracted to text server-side (`mammoth`, `xlsx`),
  capped at 50k chars, wrapped in `<attachment>` tags in the prompt.

### Chat mechanics

Stop (abort mid-stream, keep partial text), Regenerate, and Edit-and-resend
(re-forks the conversation from any past message) are all implemented in the
route's `regenerate` / `editMessageId` branches and the shared `runStream`
consumer in the shell. A cycling "Thinking… / Working… / Processing…" indicator
fills any backend-processing gap.

---

## SafePlate — dual-layer safety

SafePlate is the headline safety feature, and it does **not** trust the model.
Two independent layers, in [`lib/safeplate/`](lib/safeplate/):

**Layer 1 — structured tags** ([`filter.ts`](lib/safeplate/filter.ts)): match the
user's `user_allergies` against each item's `allergen_tags`.

**Layer 2 — deterministic keyword scan** ([`keywords.ts`](lib/safeplate/keywords.ts)):
a pure, no-LLM, word-boundary scan over the item's name + description, with a
synonym map (e.g. *peanuts* → groundnut/moongphali; *dairy* → paneer/ghee/khoya/whey;
*tree nuts* → cashew/kaju/almond). Catches an allergen present in the prose even
when the tag is **missing or wrong**.

An item is rejected if **either** layer fires (conservative union — over-blocking
is a safe failure for an allergy gate; under-blocking is not). Enforced at three
points:

1. **Menu tool** ([`lib/swiggy/mock.ts`](lib/swiggy/mock.ts)) — mislabeled items are
   filtered out before the agent ever sees them.
2. **`checkItem` core** — shared by menu filtering, order audit, and checkout.
3. **Checkout gate** ([`app/(app)/dashboard/order-actions.ts`](app/(app)/dashboard/order-actions.ts))
   — re-runs the full check server-side and refuses to log an unsafe order,
   regardless of what the agent flagged.

---

## FoodHuddle — real-time group decisions

A persistent group (a "huddle") runs decision **sessions**. The flow:

```
admin opens a session  →  members submit a poll  →  decision engine ranks
        ↓                  (cuisines, veg, budget,        top 3
   join via 6-char code     distance, mood)                ↓
                                                    spin the wheel → winner
```

- **Poll form** — [`components/huddles/poll-form.tsx`](components/huddles/poll-form.tsx).
- **Decision engine** — [`lib/huddles/decision-engine.ts`](lib/huddles/decision-engine.ts):
  a constraint solver. **Hard constraints** (reject the restaurant): it must have
  ≥1 item safe against the *union* of all members' allergens, and ≥1 veg item if
  any member is vegetarian. **Soft scoring**: rating, cuisine-vote share, distance
  fit, per-person budget fit.
- **Realtime** — [`components/huddles/live-refresh.tsx`](components/huddles/live-refresh.tsx)
  subscribes to Supabase `postgres_changes` on the huddle's responses/sessions, so
  every member's screen updates live as votes land and the decision is made.
- **Share** — a chat can be snapshotted to a public read-only link
  ([`app/share/[token]/page.tsx`](app/share/[token]/page.tsx)).

---

## Swiggy MCP layer (mock ⇄ live)

A single env flag, `MCP_MODE`, switches the commerce backend:

- **`mock`** (default) — [`lib/swiggy/mock.ts`](lib/swiggy/mock.ts) fulfils every
  tool from `fixtures/mcp/*.json` plus an in-memory cart
  ([`lib/swiggy/cart-store.ts`](lib/swiggy/cart-store.ts)). Fully local; no Swiggy
  account needed. Enforces the same contracts the live API will: per-restaurant
  cart, ₹1000 cap, COD-only coupons, 10s track-poll floor.
- **`live`** — real Swiggy Builders Club MCP calls over OAuth (issued after
  Builders Club approval). The dispatcher in [`lib/agent/tools.ts`](lib/agent/tools.ts)
  is the single seam where each mock call is swapped for an `mcp.callTool()`.

Tool calls are logged structurally ([`lib/agent/logger.ts`](lib/agent/logger.ts))
with hashed user ids, ready for production observability.

---

## Data model

Postgres schema in [`supabase/migrations/`](supabase/migrations/). **Every table has
Row-Level Security** — users see only their own rows; huddle members can read
shared huddle data via security-definer helper functions.

| Table | Purpose |
|---|---|
| `profiles` | App profile, auto-created by trigger on `auth.users` insert. |
| `user_preferences` | Cuisines, diet, monthly budget, delivery radius, personality. |
| `user_allergies` | The structured allergy list SafePlate hard-blocks against. |
| `swiggy_tokens` | OAuth access token for live MCP. |
| `orders_cache` | Placed orders — powers SpendSmart + history. |
| `chats` / `chat_messages` | Conversations. Messages carry payload (order card / error), `learned_fact`, `attachment`, and `tool_calls`. |
| `chat_shares` | Public read-only chat snapshots. |
| `agent_memory` | Long-term learned facts per user (the personalization moat). |
| `huddles` / `huddle_members` | Persistent groups + membership. |
| `huddle_sessions` | A single decision round (polling → decided → ordered). |
| `huddle_responses` | Each member's poll answer. |
| `huddle_recommendations` | The engine's ranked top 3. |
| `huddle_orders` | Group orders placed from a session. |

---

## Auth & security

- **Auth** — Supabase Auth (email + Google OAuth). Middleware
  ([`lib/supabase/middleware.ts`](lib/supabase/middleware.ts)) refreshes sessions and
  gates the `(app)` route group.
- **Swiggy OAuth 2.1 + PKCE** — [`lib/swiggy/oauth.ts`](lib/swiggy/oauth.ts) +
  `app/api/swiggy-oauth/{start,callback,disconnect}`. The code verifier is stored
  in an HttpOnly cookie; the access token is persisted server-side in
  `swiggy_tokens`.
- **Rate limiting** — [`lib/ratelimit.ts`](lib/ratelimit.ts), 30 req/min per user on
  the chat endpoint, to bound runaway tool loops.
- **Friendly errors** — [`lib/chat/errors.ts`](lib/chat/errors.ts) maps any failure
  (out-of-credits, overloaded, network, auth, bad file…) to a calm user-facing
  message; raw SDK/internal details never reach the UI. Failed turns are persisted
  so the error card survives reloads.
- **Security headers** — HSTS, `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, and a locked-down `Permissions-Policy` in `next.config.mjs`.

---

## Request lifecycle: a chat message end-to-end

```
1. User types "find biryani under ₹400" and hits send.
2. Browser → POST /api/chat (SSE opens). Optimistic user + agent bubbles render.
3. Route: auth ✓ → rate-limit ✓ → persist user message.
4. System prompt built from profile + memory + Hungry mode.
5. Tool loop:
     Claude → get_addresses        → pill "Getting your address…"
     Claude → search_restaurants   → pill "Searching restaurants…"
     Claude → get_restaurant_menu  → SafePlate filters unsafe items out
     Claude → propose_order        → server computes totals, enforces ₹1000 cap
6. Order card streams to the UI with a "YES — place order" button.
7. User clicks YES → server action re-runs SafePlate (dual-layer) →
   on pass, writes to orders_cache and flips the card to "placed".
```

---

## Project structure

```
app/
  (app)/            Authenticated app — dashboard chat, onboarding, profile,
                    connect-swiggy, huddle room
  api/chat/         Streaming agent endpoint (SSE)
  api/swiggy-oauth/ PKCE OAuth start / callback / disconnect
  auth/             Sign-in / sign-up / callback / sign-out
  share/[token]/    Public read-only chat snapshot
  page.tsx          Marketing landing page
components/
  chat/             Shell, thread, composer, mode picker, overview drawer
  huddles/          Poll form, live-refresh, top-three
  marketing/        Landing-page sections
  onboarding/       Multi-step wizard
lib/
  agent/            Anthropic client, tools, system prompts, memory, profile,
                    order-card builder, structured logger
  chat/             SSE stream protocol, attachments, errors, modes, queries
  safeplate/        Dual-layer validator: filter (tags) + keywords (scan)
  huddles/          Decision engine, code generator, queries
  swiggy/           MCP mock, cart store, OAuth, token storage
  supabase/         Browser / server / admin clients + middleware
fixtures/mcp/       Mock Swiggy MCP responses (restaurants, menus)
supabase/           SQL migrations + seed
scripts/            Demo-data seeding / cleanup (tsx)
types/              Shared types (database, swiggy, domain)
```

---

## Getting started

```bash
pnpm install
cp .env.example .env.local      # then fill in real values
# run the SQL migrations in supabase/migrations/ against your Supabase project
pnpm dev
```

Open <http://localhost:3000>.

Optional — seed a rich demo (3 users, a live huddle, a past order, memory):

```bash
pnpm seed:demo
pnpm cleanup:demo   # tear it down afterwards
```

---

## Environment

See [`.env.example`](.env.example). Key variables:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin client (seeding, triggers). |
| `ANTHROPIC_API_KEY` | Claude API (server-only). |
| `MCP_MODE` | `mock` (fixtures) or `live` (real Swiggy MCP). |
| `NEXT_PUBLIC_APP_URL` | Absolute URL for OG metadata + OAuth redirects. |
| `SWIGGY_CLIENT_ID` / `SWIGGY_OAUTH_REDIRECT_URI` | Live MCP OAuth (post-approval). |

---

## What's next

- **Live Swiggy MCP** — flip `MCP_MODE=live` and replace each mock dispatch with
  real `mcp.callTool()`, including a check-then-retry guard on the non-idempotent
  `place_food_order`, and a checkout-time availability re-validation.
- **RAG over chat history** — semantic recall of past conversations ("what did we
  decide last Friday?") on top of the structured memory layer.
- **VoiceOrder** — speak-to-order and smart reorder-cadence learning.
- **Instamart & Dineout** — grocery runs and table booking through the same agent.

---

## Powered by

Built on **Swiggy** Builders Club · Powered by **Claude**.
