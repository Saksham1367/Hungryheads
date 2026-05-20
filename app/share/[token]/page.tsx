import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { LogoMark } from "@/components/ui/logo";
import { ChatThread } from "@/components/chat/thread";
import { Button } from "@/components/ui/button";
import type { ChatMessageView } from "@/lib/chat/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Shared chat" };

export default async function SharedChatPage({
  params,
}: {
  params: { token: string };
}) {
  const admin = createAdminClient();
  const { data: share } = await admin
    .from("chat_shares")
    .select("title, snapshot, created_at")
    .eq("token", params.token)
    .maybeSingle();

  if (!share) {
    return (
      <div className="min-h-screen bg-hh-cream flex items-center">
        <div className="container max-w-lg text-center space-y-4 py-16">
          <h1 className="font-display text-3xl font-extrabold text-hh-black">
            Share link not found
          </h1>
          <p className="text-hh-charcoal">
            This shared chat may have been deleted, or the link is wrong.
          </p>
          <Link href="/" className="inline-block">
            <Button variant="primary" size="md">
              Go to HungryHeads
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const messages = (share.snapshot as unknown as ChatMessageView[]) ?? [];

  return (
    <div className="min-h-screen bg-hh-cream flex flex-col">
      {/* Branded header — read-only */}
      <header className="border-b border-hh-gray-light bg-white">
        <div className="container py-3 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 select-none"
          >
            <LogoMark className="h-7 w-7" />
            <span className="font-display font-extrabold text-[17px] tracking-tight text-hh-black">
              Hungry<span className="text-hh-orange">Heads</span>
            </span>
          </Link>
          <Link href="/auth/sign-up" className="hidden sm:block">
            <Button variant="primary" size="sm">
              Try HungryHeads
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Title */}
      <div className="container max-w-[820px] py-6 space-y-1">
        <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-hh-orange-dark">
          Shared chat
        </span>
        <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-hh-black">
          {share.title}
        </h1>
        <p className="text-xs text-hh-gray">
          Snapshot taken {new Date(share.created_at).toLocaleString()}
        </p>
      </div>

      {/* Read-only thread */}
      <main className="flex-1 flex flex-col">
        <ChatThread messages={messages} />
      </main>

      {/* CTA footer */}
      <div className="border-t border-hh-gray-light bg-white">
        <div className="container max-w-[820px] py-4 flex items-center justify-between gap-3">
          <p className="text-sm text-hh-charcoal">
            Like what you see? Try HungryHeads — your own allergy-safe, budget-aware food agent.
          </p>
          <Link href="/auth/sign-up">
            <Button variant="primary" size="md">
              Get started — free
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
