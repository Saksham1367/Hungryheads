# HungryHeads 🍽️

> **An AI food companion that decides, orders, and eats together — safely.**
> Built on Swiggy's Builders Club platform · Powered by Claude.

**Live demo → [hungryheads.vercel.app](https://hungryheads.vercel.app)**

HungryHeads is a single AI agent you talk to like a friend. It settles the group
dinner debate, keeps you on budget, and — most importantly — never lets an
allergen slip onto your plate. One chat, one profile that remembers you, three
features working together.

---

## The problem: deciding what to eat is a mess

Every group has lived it — the endless "where should we eat?" chat. Someone's
vegetarian, someone's allergic, someone's broke till payday, and nobody wants to
decide. On top of that, food apps aren't actually *safe* for people with
allergies: menu labels are often wrong or missing.

HungryHeads is one agent that solves all of it, in seconds.

---

## What it does

### 🛡️ SafePlate — never lets an allergen through
Tell it once ("I'm allergic to peanuts") and it hard-blocks unsafe dishes at
checkout — **even when the restaurant mislabels the dish.** It doesn't trust the
AI or the menu data (more on how, below).

### 👥 FoodHuddle — ends the "where should we eat?" debate
Your group votes on cuisine, budget, and diet. A solver ranks the top spots that
work for *everyone's* allergies and budgets, then spins a wheel to pick. Everyone's
screen updates live.

### 💸 SpendSmart — keeps every order on budget
Set a monthly budget and it leads with the spend impact of each choice and
suggests cheaper swaps before you overspend.

---

## Try it live

**[hungryheads.vercel.app](https://hungryheads.vercel.app)** — sign up, tell it your
allergies, and ask it to find you something to eat.

---

## How it works, in one picture

```
   You (chat)  ──▶  AI agent (Claude)  ──▶  Swiggy platform
                         │                    (menus, cart, orders)
                         ▼
                   SafePlate safety gate
                   FoodHuddle group solver
                         │
                         ▼
                    Your profile + memory
```

You send a message → the agent uses real tools to search Swiggy, read menus, and
build an order → every step is checked by the safety gate → the result streams
back to you live. Everything is remembered for next time.

---

## Engineered for production

The parts you don't see are where most of the work went:

### It doesn't trust the AI on safety
Allergy checks run **two independent layers** — structured allergen tags *and* a
deterministic keyword scanner that reads the actual dish text (with synonyms, e.g.
*peanut → groundnut/moongphali*). Then it **re-checks on the server at checkout.**
An allergen can't reach your cart even if the AI or the restaurant gets it wrong.

### It's secured like a real product
Every database table is locked down per-user (row-level security), Swiggy tokens
are **encrypted at rest**, ordering can only happen behind a human tap (never by
the AI on its own), and it passed a full security-review pass (fixed an auth leak,
open redirects, and upload-safety issues).

### It's cost-optimized
Prompt caching cuts the AI bill by **~60%**, and a distributed rate limiter keeps
runaway usage from burning the budget.

### It's reliable by design
Anything important — remembering a preference, logging an allergy, placing an
order — is a **real tool call**, not a fragile text convention. The chat behaves
the same way every time.

---

## Hard problems, and how I solved them

A few of the trickier engineering challenges behind the app:

**The chat worked "sometimes."** Memory and order cards first relied on the model
emitting magic text strings, which it did one time and forgot the next. I rebuilt
every critical action as a real tool call, so it fires reliably. It went from a
"probability game" to consistent.

**A rate limiter that silently did nothing.** It looked like it worked but never
wrote to the database. The cause was subtle — a method pulled into a variable lost
its `this` binding and threw, and my own graceful-fallback hid the error. I
isolated the DB call (fine) from the app call (broken), fixed the binding, and
verified it live. *Lesson: graceful fallbacks can hide real bugs — always confirm
the happy path actually ran.*

**Safety when the data lies.** Live menus don't reliably label allergens, so I
couldn't rely on tags. The deterministic keyword scanner + server-side checkout
re-check exist precisely so a wrong label can't hurt anyone.

---

## Validated by Swiggy's Builders Club

HungryHeads was **reviewed and approved into Swiggy's Builders Club MCP program** —
external validation that the integration is real and production-grade. The live
integration adapter is built and ready; the app runs today on a spec-accurate mock
of the Swiggy platform so anyone can try it without an account.

---

## The stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) · TypeScript |
| AI | Claude (Anthropic SDK) — streaming + tool use |
| Data / Auth | Supabase — Postgres, Row-Level Security, Auth, Realtime |
| Commerce | Swiggy Builders Club MCP (mock now → live post-approval) |
| Deploy | Vercel |

---

## Run it locally

```bash
pnpm install
cp .env.example .env.local      # fill in your keys
# run the SQL in supabase/migrations/ against your Supabase project
pnpm dev                        # → http://localhost:3000
```

Optional — seed a full demo (a live group huddle, a past order, saved memory):

```bash
pnpm seed:demo      # set it up
pnpm cleanup:demo   # tear it down
```

> Want the deep architecture write-up (agent pipeline, data model, request
> lifecycle, every module)? It lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## What's next

- **Go live on Swiggy** — flip to the real MCP the moment credentials land (adapter already built).
- **Online payments** — the checkout layer is built for COD; wiring a payments provider is the natural next step.
- **Voice ordering** and **smart reorders** — speak to order, and learn your routines.
- **Groceries & dining-out** — the same agent, extended to Instamart and table booking.

---

*Built by [Saksham Dhingra](https://github.com/Saksham1367) · on Swiggy Builders Club · powered by Claude.*
