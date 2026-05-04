# HungryHeads

> AI-powered food companion built on Swiggy's Builders Club MCP platform.
> **Decide. Order. Eat. Together — without the headache.**

Four features sharing one user profile and one AI agent core:

| Feature | What it does |
|---|---|
| **SafePlate** | Allergy & diet safety net — filters menus, blocks risky items at checkout |
| **SpendSmart** | Monthly budget guardrail with live impact + insights |
| **VoiceOrder** | Speak-to-order via WhatsApp + smart-reorder cadence learning |
| **FoodHuddle** | Real-time group decision engine with spin-the-wheel |

The full product brief lives at [`../HungryHeads-Project-Brief.md`](../HungryHeads-Project-Brief.md). Read it before contributing.

---

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Postgres + Auth + Realtime) · Anthropic SDK + MCP TypeScript SDK · React Hook Form + Zod · Zustand · pnpm.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # then fill in real values
pnpm dev
```

Open <http://localhost:3000>.

## Environment

See `.env.example`. Critical knob:

- `MCP_MODE=mock` — replays fixture JSON instead of hitting Swiggy MCP. Use this until OAuth credentials are issued post-Builders-Club approval.
- `MCP_MODE=live` — real Swiggy MCP calls.

## Project structure

```
app/                Next.js App Router pages + API routes
components/         UI components (marketing, onboarding, feature-specific)
lib/                Domain logic (Supabase, Swiggy MCP, agent, huddle, utils)
types/              Shared TypeScript types (database, swiggy, domain)
fixtures/mcp/       Mock Swiggy MCP responses for local-first dev
supabase/           SQL migrations + seed data
```

Full breakdown in brief §10.

## Build phases

- **Phase 1** — MVP for Builders Club submission (homepage → onboarding → dashboard → FoodHuddle → SafePlate → demo video)
- **Phase 2** — Live MCP integration, SpendSmart, smart reorders, UPI splits
- **Phase 3** — Voice via WhatsApp + Whisper, multilingual, learned personalization

## Powered by

Powered by Swiggy · Powered by Claude
