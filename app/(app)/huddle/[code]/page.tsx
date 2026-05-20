import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Crown,
  History,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app/header";
import { Button } from "@/components/ui/button";
import { HuddleCodeCopy } from "@/components/huddles/huddle-code-copy";
import { DecideButton } from "@/components/huddles/decide-button";
import { PollForm } from "@/components/huddles/poll-form";
import { DecideNowControls } from "@/components/huddles/decide-now";
import { TopThree } from "@/components/huddles/top-three";
import { WinnerCard } from "@/components/huddles/winner-card";
import { HuddleLiveRefresh } from "@/components/huddles/live-refresh";
import { loadHuddleByCode } from "@/lib/huddles/queries";
import { formatRupees } from "@/lib/utils/format";
import { relativeTime } from "@/lib/chat/util";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Huddle" };

export default async function HuddlePage({
  params,
}: {
  params: { code: string };
}) {
  const code = params.code.toUpperCase();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?redirect=/huddle/${code}`);

  const huddle = await loadHuddleByCode(code);
  if (!huddle) {
    return (
      <div className="min-h-screen bg-hh-cream">
        <AppHeader />
        <div className="container max-w-xl py-16 space-y-4 text-center">
          <h1 className="font-display text-2xl font-extrabold text-hh-black">
            Huddle not found
          </h1>
          <p className="text-hh-charcoal">
            Either this code is wrong, or you&apos;re not a member yet. Go back
            to the dashboard and use{" "}
            <span className="font-semibold">Join with code</span> in the sidebar.
          </p>
          <Link href="/dashboard" className="inline-block pt-2">
            <Button variant="secondary" size="md">
              <ArrowLeft className="h-4 w-4" /> Back to dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const session = huddle.activeSession;
  // Only the person who hit "Decide!" can close the poll. Admins can still
  // cancel via the cancel button (RLS allows admin updates), but they can't
  // unilaterally pick the result.
  const canControlSession =
    session !== null && session.triggered_by_id === user.id;

  return (
    <div className="min-h-screen bg-hh-cream">
      <AppHeader />
      <HuddleLiveRefresh huddleId={huddle.id} sessionId={session?.id} />
      <div className="container max-w-3xl py-8 md:py-10 space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-hh-gray hover:text-hh-charcoal"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        {/* ── Header card ───────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-hh-gray-light bg-white p-6 md:p-8 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-4 min-w-0">
              <span
                className={cn(
                  "h-14 w-14 rounded-2xl shrink-0 flex items-center justify-center text-white font-display font-extrabold text-lg",
                  huddle.variant === "g1" &&
                    "bg-gradient-to-br from-hh-orange to-hh-orange-dark",
                  huddle.variant === "g2" &&
                    "bg-gradient-to-br from-blue-500 to-blue-700",
                  huddle.variant === "g3" &&
                    "bg-gradient-to-br from-emerald-500 to-emerald-700",
                )}
              >
                {huddle.initials}
              </span>
              <div className="min-w-0">
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-hh-orange-dark">
                  Huddle
                </span>
                <h1 className="font-display text-2xl md:text-3xl font-extrabold text-hh-black truncate">
                  {huddle.name ?? "Unnamed huddle"}
                </h1>
                <div className="flex items-center gap-2 text-sm text-hh-gray mt-0.5">
                  <Users className="h-3.5 w-3.5" />
                  {huddle.members.length} member
                  {huddle.members.length === 1 ? "" : "s"}
                  <span>·</span>
                  <span>created {relativeTime(huddle.created_at)}</span>
                </div>
              </div>
            </div>
            <span className="font-mono font-bold text-base md:text-xl tabular tracking-[0.25em] text-hh-orange-dark bg-hh-orange-light px-3 py-2 rounded-xl shrink-0">
              {huddle.code}
            </span>
          </div>

          <HuddleCodeCopy code={huddle.code} />
        </div>

        {/* ── Active session — branches by status ──────────────────────── */}
        {session ? (
          <div className="space-y-5">
            {/* ── Polling status — show poll form or wait state ──────────── */}
            {session.status === "polling" && (
              <>
                <ActiveBanner
                  triggeredBy={session.triggered_by_name}
                  createdAt={session.created_at}
                  responseCount={session.responseCount}
                  memberCount={huddle.members.length}
                />

                {!huddle.viewerHasResponded ? (
                  <PollForm sessionId={session.id} />
                ) : (
                  <div className="rounded-2xl border border-hh-success/40 bg-emerald-50 p-5 text-sm text-emerald-900">
                    <div className="font-semibold flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Vote in. Sit tight while others weigh in.
                    </div>
                    <p className="text-emerald-800 mt-1">
                      {session.responseCount} of {huddle.members.length}{" "}
                      have voted so far.
                    </p>
                  </div>
                )}

                <div className="rounded-2xl border border-hh-gray-light bg-white p-5">
                  <DecideNowControls
                    sessionId={session.id}
                    responseCount={session.responseCount}
                    memberCount={huddle.members.length}
                    canDecide={canControlSession}
                  />
                </div>
              </>
            )}

            {/* ── Decided status — show top 3 + spin or winner ──────────── */}
            {session.status === "decided" && (
              <>
                {huddle.activeWinner ? (
                  <WinnerCard
                    sessionId={session.id}
                    winner={huddle.activeWinner}
                    alreadyOrdered={false}
                    canOrder={canControlSession}
                  />
                ) : (
                  <TopThree
                    sessionId={session.id}
                    recommendations={huddle.activeRecommendations}
                    canSpin={canControlSession}
                  />
                )}
              </>
            )}

            {/* ── Ordered status — show order success + winner ──────────── */}
            {session.status === "ordered" && huddle.activeWinner && (
              <WinnerCard
                sessionId={session.id}
                winner={huddle.activeWinner}
                alreadyOrdered
                canOrder={canControlSession}
              />
            )}
          </div>
        ) : (
          // No active session → show Decide CTA
          <div className="rounded-2xl border border-hh-gray-light bg-white p-6 space-y-3">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold text-hh-black flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-hh-orange-dark" />
                Decide together
              </h2>
              <p className="text-sm text-hh-charcoal">
                Hit the button — everyone gets pinged, fills a quick poll, and
                the agent picks the top 3 spots that respect everyone&apos;s
                allergies and budget.
              </p>
            </div>
            <DecideButton huddleId={huddle.id} />
          </div>
        )}

        {/* ── Members ───────────────────────────────────────────────────── */}
        <Section
          icon={<Users className="h-4 w-4" />}
          title="Members"
          subtitle={`${huddle.members.length} in the huddle`}
        >
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {huddle.members.map((m) => (
              <li
                key={m.user_id}
                className="flex items-center gap-3 rounded-xl border border-hh-gray-light bg-white p-3"
              >
                <span className="h-9 w-9 rounded-full bg-gradient-to-br from-hh-orange to-hh-orange-dark text-white font-bold text-sm flex items-center justify-center shrink-0">
                  {m.initial}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-hh-black truncate flex items-center gap-1.5">
                    {m.full_name}
                    {m.is_admin && (
                      <span
                        title="Admin"
                        className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-hh-orange-dark"
                      >
                        <Crown className="h-3 w-3" />
                        admin
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-hh-gray truncate">
                    joined {relativeTime(m.joined_at)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        {/* ── Past decisions ────────────────────────────────────────────── */}
        <Section
          icon={<History className="h-4 w-4" />}
          title="Past decisions"
          subtitle={
            huddle.pastSessions.length === 0
              ? "Nothing yet"
              : `${huddle.pastSessions.length} session${
                  huddle.pastSessions.length === 1 ? "" : "s"
                }`
          }
        >
          {huddle.pastSessions.length === 0 ? (
            <p className="text-xs text-hh-gray">
              Once the huddle decides on a place, the session and its picks
              will land here for posterity.
            </p>
          ) : (
            <ul className="space-y-2">
              {huddle.pastSessions.slice(0, 8).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-hh-gray-light bg-white p-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-hh-charcoal">
                      Triggered by {s.triggered_by_name}{" "}
                      <span className="text-hh-gray">
                        · {relativeTime(s.created_at)}
                      </span>
                    </div>
                    <div className="text-[11px] text-hh-gray mt-0.5">
                      {s.responseCount} response
                      {s.responseCount === 1 ? "" : "s"}
                      {s.mode && ` · ${s.mode.replace("_", " ")}`}
                    </div>
                  </div>
                  <SessionStatusPill status={s.status} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* ── Order history ─────────────────────────────────────────────── */}
        <Section
          icon={<ShoppingBag className="h-4 w-4" />}
          title="Order history"
          subtitle={
            huddle.orders.length === 0
              ? "No orders yet"
              : `${huddle.orders.length} order${
                  huddle.orders.length === 1 ? "" : "s"
                }`
          }
        >
          {huddle.orders.length === 0 ? (
            <p className="text-xs text-hh-gray">
              When the huddle places its first order together, it&apos;ll show
              up here with restaurant, total, and who placed it.
            </p>
          ) : (
            <ul className="space-y-2">
              {huddle.orders.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-hh-gray-light bg-white p-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-hh-black truncate">
                      {o.restaurant_name ?? "Order"}
                    </div>
                    <div className="text-[11px] text-hh-gray flex items-center gap-1.5">
                      <span>{o.placed_by_name} placed it</span>
                      <span>·</span>
                      <span>{relativeTime(o.ordered_at)}</span>
                    </div>
                  </div>
                  <div className="font-semibold tabular text-hh-black shrink-0">
                    {formatRupees(o.total_amount)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

function ActiveBanner({
  triggeredBy,
  createdAt,
  responseCount,
  memberCount,
}: {
  triggeredBy: string;
  createdAt: string;
  responseCount: number;
  memberCount: number;
}) {
  return (
    <div className="rounded-2xl border border-hh-success/40 bg-emerald-50 p-5 flex items-start gap-4">
      <span className="relative inline-flex items-center justify-center h-10 w-10 shrink-0">
        <span className="absolute inline-flex h-full w-full rounded-full bg-hh-success opacity-30 animate-ping" />
        <span className="relative h-3 w-3 rounded-full bg-hh-success" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-display font-extrabold text-lg text-emerald-900">
          Decision in progress
        </div>
        <div className="text-sm text-emerald-800 mt-0.5">
          {triggeredBy} kicked off a poll {relativeTime(createdAt)}.{" "}
          {responseCount} of {memberCount} responded.
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="font-display text-lg font-bold text-hh-black flex items-center gap-1.5">
          <span className="text-hh-orange-dark">{icon}</span>
          {title}
        </h2>
        {subtitle && <span className="text-xs text-hh-gray">{subtitle}</span>}
      </div>
      <div>{children}</div>
    </section>
  );
}

function SessionStatusPill({ status }: { status: string }) {
  const meta: Record<string, { label: string; cls: string }> = {
    polling: {
      label: "Polling",
      cls: "bg-hh-orange-light text-hh-orange-dark",
    },
    decided: { label: "Decided", cls: "bg-blue-50 text-hh-info" },
    ordered: { label: "Ordered", cls: "bg-emerald-50 text-hh-success" },
    cancelled: {
      label: "Cancelled",
      cls: "bg-hh-gray-light/40 text-hh-gray",
    },
  };
  const m = meta[status] ?? {
    label: status,
    cls: "bg-hh-gray-light/40 text-hh-gray",
  };
  return (
    <span
      className={cn(
        "shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
        m.cls,
      )}
    >
      {m.label}
    </span>
  );
}
