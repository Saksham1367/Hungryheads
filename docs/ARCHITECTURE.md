# HungryHeads — Architecture

The deep-dive companion to the [README](../README.md). How every part works and
connects: the agent core, the safety gate, the group-decision engine, the Swiggy
layer, the data model, and the end-to-end request lifecycle.

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
[`app/api/chat/route.ts`](../app/api/chat/route.ts) — a Node-runtime route that
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
           runs the tool (Swiggy mock/live or internal)  ─ pill shown ≥700ms
           feeds the result back to Claude
        ...repeats until Claude returns a final text answer
   │
   └─ persist agent message (+ tool record, order card, learned facts)
        emit `done`
```

The streamed event protocol lives in [`lib/chat/stream.ts`](../lib/chat/stream.ts):
`start · delta · tool_start · tool_end · memory_saved · allergy_saved · done · error`.
The browser consumes it in [`components/chat/shell.tsx`](../components/chat/shell.tsx)
and renders in [`components/chat/thread.tsx`](../components/chat/thread.tsx).

### System prompt

[`lib/agent/system-prompts.ts`](../lib/agent/system-prompts.ts) composes the prompt
from: brand voice → memory/safety directives → hard constraints (allergies, ₹1000
cap, COD-only, never auto-place) → untrusted-content guardrail → the active
**mode** (Hungry / Diet / Budget) → a profile snapshot → long-term memory facts.
It is split into a **static prefix** (identical for everyone — cached) and a
**dynamic tail** (this user's data), so the cached prefix isn't poisoned by
per-user content.

### Tools

Defined in [`lib/agent/tools.ts`](../lib/agent/tools.ts). Two groups:

**Swiggy MCP tools** (dispatched through the mock/live layer):
`get_addresses · search_restaurants · get_restaurant_menu · update_food_cart ·
get_food_cart · flush_food_cart · fetch_food_coupons · apply_food_coupon ·
track_food_order · get_food_orders · report_error`.

**HungryHeads-internal tools** (handled directly in the route; they write to *our*
database, not Swiggy):

| Tool | Effect |
|---|---|
| `remember_preference` | Saves a stable fact to `agent_memory` (deduped) → "Learned" pill, recalled in every future chat. |
| `update_allergy` | Writes to `user_allergies` — the **hard** SafePlate gate. |
| `propose_order` | The server builds + validates the order card, **computing totals and enforcing the cap** so a truncated reply can't produce a broken card. |

Reliability principle: **anything important is a real tool call, not a magic
string the model has to remember to emit.** Models call tools reliably;
trailing-string conventions are a probability game.

> Security note: `place_food_order` is deliberately **not** an agent tool. An
> order is only ever placed by the server, behind the human "YES" button — a
> prompt-injected message can't spend money.

### Memory

[`lib/agent/memory.ts`](../lib/agent/memory.ts) — `saveMemoryFacts` dedupes
against existing rows, bumps recency on repeats, and prunes to a per-user cap.
`loadTopMemories` hydrates recent facts into every system prompt. This is the
personalization layer that makes the agent feel like it knows you across chats.

### Attachments & vision

[`lib/chat/attachments.ts`](../lib/chat/attachments.ts) accepts one file per
message (≤ 5 MB): images → native Claude **vision** blocks; PDFs → native
`document` blocks; DOC/DOCX/XLS/XLSX/CSV → extracted to text server-side, capped,
and wrapped in `<attachment>` tags (treated as untrusted content).

---

## SafePlate — dual-layer safety

SafePlate is the headline safety feature, and it does **not** trust the model.
Two independent layers, in [`lib/safeplate/`](../lib/safeplate/):

**Layer 1 — structured tags** ([`filter.ts`](../lib/safeplate/filter.ts)): match
the user's `user_allergies` against each item's `allergen_tags`.

**Layer 2 — deterministic keyword scan** ([`keywords.ts`](../lib/safeplate/keywords.ts)):
a pure, no-LLM, word-boundary scan over the item's name + description, with a
synonym map (*peanuts* → groundnut/moongphali; *dairy* → paneer/ghee/khoya/whey;
*tree nuts* → cashew/kaju/almond). Catches an allergen present in the prose even
when the tag is **missing or wrong** — which matters because the live menu API
carries no allergen tags at all.

An item is rejected if **either** layer fires (conservative union — over-blocking
is a safe failure for an allergy gate; under-blocking is not). Enforced at three
points:

1. **Menu tool** — mislabeled items are filtered out before the agent sees them.
2. **`checkItem` core** — shared by menu filtering, order audit, and checkout.
3. **Checkout gate** ([`order-actions.ts`](../app/(app)/dashboard/order-actions.ts))
   — re-runs the full check server-side and refuses to log an unsafe order,
   regardless of what the agent flagged.

---

## FoodHuddle — real-time group decisions

A persistent group (a "huddle") runs decision **sessions**:

```
admin opens a session  →  members submit a poll  →  decision engine ranks
        ↓                  (cuisines, veg, budget,        top 3
   join via 6-char code     distance, mood)                ↓
                                                    spin the wheel → winner
```

- **Decision engine** — [`lib/huddles/decision-engine.ts`](../lib/huddles/decision-engine.ts):
  a constraint solver. **Hard constraints** (reject the restaurant): ≥1 item safe
  against the *union* of all members' allergens, and ≥1 veg item if any member is
  vegetarian. **Soft scoring**: rating, cuisine-vote share, distance fit,
  per-person budget fit.
- **Realtime** — subscribes to Supabase `postgres_changes` on the huddle's
  responses/sessions, so every member's screen updates live as votes land.

---

## Swiggy MCP layer (mock ⇄ live)

A single env flag, `MCP_MODE`, switches the commerce backend:

- **`mock`** (default) — [`lib/swiggy/mock.ts`](../lib/swiggy/mock.ts) fulfils every
  tool from `fixtures/mcp/*.json` plus an in-memory cart. Fully local; no Swiggy
  account needed. Enforces the same contracts the live API will: per-restaurant
  cart, ₹1000 cap, COD-only coupons, 10s track-poll floor.
- **`live`** — real Swiggy Builders Club MCP calls over OAuth. The dispatcher
  swaps each mock call for an `mcp.callTool()` via the client in
  [`lib/swiggy/mcp-client.ts`](../lib/swiggy/mcp-client.ts) and
  [`lib/swiggy/live.ts`](../lib/swiggy/live.ts), unwrapping the `{success,data}`
  envelope and mapping the spec's parameters. Order placement uses a
  check-then-retry guard because `place_food_order` is non-idempotent.

Tool calls are logged structurally with hashed user ids, ready for observability.

---

## Data model

Postgres schema in [`supabase/migrations/`](../supabase/migrations/). **Every table
has Row-Level Security** — users see only their own rows; huddle members read
shared huddle data via security-definer helper functions.

| Table | Purpose |
|---|---|
| `profiles` | App profile, auto-created by trigger on signup. |
| `user_preferences` | Cuisines, diet, monthly budget, delivery radius, personality. |
| `user_allergies` | The structured allergy list SafePlate hard-blocks against. |
| `swiggy_tokens` | OAuth access token for live MCP — **encrypted at rest**. |
| `orders_cache` | Placed orders — powers SpendSmart + history. |
| `chats` / `chat_messages` | Conversations; messages carry order card / error payload, learned facts, attachments. |
| `chat_shares` | Public read-only chat snapshots. |
| `agent_memory` | Long-term learned facts per user. |
| `huddles` / `huddle_members` | Persistent groups + membership. |
| `huddle_sessions` / `huddle_responses` / `huddle_recommendations` / `huddle_orders` | A decision round, member votes, the ranked top 3, and group orders. |
| `rate_limits` | Distributed rate-limit counters (shared across instances). |

---

## Auth & security

- **Auth** — Supabase Auth (email + Google OAuth). Middleware refreshes sessions
  and gates the authenticated route group.
- **Swiggy OAuth 2.1 + PKCE** — code verifier in an HttpOnly cookie; the access
  token is persisted server-side, **encrypted with AES-256-GCM** (key in env, not
  the DB).
- **Rate limiting** — a **distributed** limiter (Postgres-backed, shared across
  serverless instances) on the chat and order endpoints, with an in-memory fast path.
- **Row-Level Security on every table**; the service-role key is server-only.
- **Ordering is human-gated** — the agent proposes; only a user tap places an order.
- **Untrusted content** — attachment + tool-result text can't override safety rules.
- **Friendly errors** — every failure maps to a calm user-facing message; raw
  internals never reach the UI, and failed turns persist so the error survives reloads.
- **Hardened** — passed a security review (huddle authorization leak, open
  redirects, upload-safety, CSP) and dependency-vuln fixes.

---

## Request lifecycle: a chat message end-to-end

```
1. User types "find biryani under ₹400" and hits send.
2. Browser → POST /api/chat (SSE opens). Optimistic bubbles render.
3. Route: auth ✓ → rate-limit ✓ → persist user message.
4. System prompt built from profile + memory + Hungry mode.
5. Tool loop:
     Claude → get_addresses        → pill "Getting your address…"
     Claude → search_restaurants   → pill "Searching restaurants…"
     Claude → get_restaurant_menu  → SafePlate filters unsafe items out
     Claude → propose_order        → server computes totals, enforces ₹1000 cap
6. Order card streams to the UI with a "YES — place order" button.
7. User clicks YES → server action re-runs SafePlate (dual-layer) →
   on pass, places the order and flips the card to "placed".
```

---

## Project structure

```
app/
  (app)/            Authenticated app — dashboard chat, onboarding, profile, huddle room
  api/chat/         Streaming agent endpoint (SSE)
  api/swiggy-oauth/ PKCE OAuth start / callback / disconnect
  auth/             Sign-in / sign-up / callback
  share/[token]/    Public read-only chat snapshot
components/         chat, huddles, marketing, onboarding UI
lib/
  agent/            Anthropic client, tools, system prompts, memory, profile, logger
  chat/             SSE stream protocol, attachments, errors, modes, queries
  safeplate/        Dual-layer validator: filter (tags) + keywords (scan)
  huddles/          Decision engine, code generator, queries
  swiggy/           MCP mock, live client + dispatcher, OAuth, encrypted token storage
  supabase/         Browser / server / admin clients + middleware
fixtures/mcp/       Mock Swiggy responses (restaurants, menus)
supabase/           SQL migrations + seed
```
