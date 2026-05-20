"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageCircle, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * Phase-1 chat dock — a marketing teaser. Public users get canned demo
 * exchanges that show what the agent does, with every CTA pushing to
 * /auth/sign-up. The real Anthropic-powered chat lives at /dashboard.
 */
const DEMO_PROMPTS = [
  {
    chip: "🍛 Late-night biryani under ₹400",
    user: "It's 11pm and I want biryani. Under ₹400 delivered. No peanuts.",
    agent:
      "Got you — peanut-safe and capped at ₹400. **Paradise (2.3km, 4.4★)** is your safest bet. Two biryanis + raita = ₹362 total, COD. Want me to place it?",
  },
  {
    chip: "🥗 Post-workout high-protein",
    user: "Need a high-protein lunch under ₹400, dairy-allergic.",
    agent:
      "**Greenleaf Power Bowl** — 40g protein, brown rice + grilled chicken + avocado, no dairy. ₹380. Fits the budget with ₹20 to spare.",
  },
  {
    chip: "🎲 Decide for our group of 4",
    user: "Friday dinner for 4 friends. Mix of veg + non-veg. ₹500 each.",
    agent:
      "Started a FoodHuddle 4FRENZ. Once everyone votes, I'll pick the top 3 spots that respect every member's allergies and budget — then spin the wheel.",
  },
] as const;

type DemoState = { idx: number; visible: boolean };

export function MarketingChatDock() {
  const [open, setOpen] = useState(false);
  const [demo, setDemo] = useState<DemoState | null>(null);

  const playDemo = (idx: number) => setDemo({ idx, visible: true });
  const reset = () => setDemo(null);

  return (
    <div className="fixed bottom-5 right-5 md:bottom-6 md:right-6 z-50">
      {open ? (
        <div className="w-[min(380px,calc(100vw-2.5rem))] rounded-2xl border border-hh-gray-light bg-white shadow-2xl overflow-hidden animate-fade-in">
          <header className="bg-hh-orange text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-white/20">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div>
                <div className="text-sm font-semibold">HungryHeads agent</div>
                <div className="text-[10px] uppercase tracking-wider opacity-90">
                  Powered by Claude · Preview
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close chat"
              className="p-1 hover:bg-white/15 rounded-full"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="p-4 space-y-3 bg-hh-cream max-h-[420px] overflow-y-auto">
            {!demo && (
              <>
                <ChatBubble role="agent">
                  Hey! I&apos;m the HungryHeads agent. Tap a sample below to see
                  what I do — or sign up and chat for real.
                </ChatBubble>

                <div className="flex flex-wrap gap-2 pt-1">
                  {DEMO_PROMPTS.map((p, i) => (
                    <button
                      key={p.chip}
                      type="button"
                      className="text-xs rounded-full border border-hh-gray-light bg-white px-3 py-1.5 text-hh-charcoal hover:border-hh-orange hover:text-hh-orange-dark transition-colors"
                      onClick={() => playDemo(i)}
                    >
                      {p.chip}
                    </button>
                  ))}
                </div>
              </>
            )}

            {demo && (
              <>
                <ChatBubble role="user">{DEMO_PROMPTS[demo.idx].user}</ChatBubble>
                <ChatBubble role="agent">
                  <RichText text={DEMO_PROMPTS[demo.idx].agent} />
                </ChatBubble>
                <button
                  type="button"
                  onClick={reset}
                  className="text-[11px] text-hh-orange-dark underline hover:no-underline"
                >
                  ← see other examples
                </button>
              </>
            )}
          </div>

          <div className="p-3 border-t border-hh-gray-light bg-white">
            <Link href="/auth/sign-up">
              <Button variant="primary" size="sm" className="w-full">
                {demo ? "Sign up to actually try this" : "Sign up to chat"}
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group inline-flex items-center gap-2 rounded-full bg-hh-orange hover:bg-hh-orange-dark text-white px-5 py-3 shadow-lg transition-colors"
          aria-label="Open chat"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden sm:inline text-sm font-semibold">
            Ask HungryHeads
          </span>
        </button>
      )}
    </div>
  );
}

function ChatBubble({
  role,
  children,
}: {
  role: "agent" | "user";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm",
        role === "agent"
          ? "bg-white border border-hh-gray-light text-hh-charcoal rounded-tl-sm"
          : "ml-auto bg-hh-orange text-white rounded-tr-sm",
      )}
    >
      {children}
    </div>
  );
}

/** Tiny **bold** parser — same vibe as the real chat thread. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-hh-black">
            {p}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
