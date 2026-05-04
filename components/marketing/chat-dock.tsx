"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageCircle, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * Phase-1 chat dock — a marketing teaser. Public users see suggested prompts
 * but every send pushes them to /auth/sign-up. The full Anthropic-powered
 * agent lands in Step 13.
 */
export function MarketingChatDock() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 md:bottom-6 md:right-6 z-50">
      {open ? (
        <div className="w-[min(360px,calc(100vw-2.5rem))] rounded-2xl border border-hh-gray-light bg-white shadow-2xl overflow-hidden animate-fade-in">
          <header className="bg-hh-orange text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-white/20">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div>
                <div className="text-sm font-semibold">HungryHeads agent</div>
                <div className="text-[10px] uppercase tracking-wider opacity-90">
                  Powered by Claude
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

          <div className="p-4 space-y-3 bg-hh-cream">
            <ChatBubble role="agent">
              Hey! I&apos;m the HungryHeads agent. I can help you decide what to eat,
              respect your allergies, stay on budget, or settle group debates.
            </ChatBubble>
            <ChatBubble role="agent">
              Sign up for free and I&apos;ll connect to your Swiggy account so we can
              actually order.
            </ChatBubble>

            <div className="flex flex-wrap gap-2 pt-1">
              {[
                "What can you do?",
                "Show me FoodHuddle",
                "How do allergies work?",
              ].map((s) => (
                <button
                  key={s}
                  className="text-xs rounded-full border border-hh-gray-light bg-white px-3 py-1.5 text-hh-charcoal hover:border-hh-orange hover:text-hh-orange-dark transition-colors"
                  onClick={() => setOpen(true)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 border-t border-hh-gray-light bg-white">
            <Link href="/auth/sign-up">
              <Button variant="primary" size="sm" className="w-full">
                Sign up to chat
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
        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
        role === "agent"
          ? "bg-white border border-hh-gray-light text-hh-charcoal rounded-tl-sm"
          : "ml-auto bg-hh-orange text-white rounded-tr-sm",
      )}
    >
      {children}
    </div>
  );
}
