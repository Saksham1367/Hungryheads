"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Pencil,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatRupees } from "@/lib/utils/format";
import { relativeTime } from "@/lib/chat/util";
import type { OverviewData } from "@/lib/chat/overview";

export function OverviewDrawer({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: OverviewData | null;
}) {
  // Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="overview-title">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in"
        aria-hidden
      />
      {/* Panel */}
      <aside
        className="relative w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto"
        style={{ animation: "fade-in 0.25s ease-out" }}
      >
        <header className="sticky top-0 z-10 bg-white border-b border-hh-gray-light px-5 py-4 flex items-center justify-between">
          <div>
            <h2
              id="overview-title"
              className="font-display text-lg font-extrabold text-hh-black tracking-tight"
            >
              Overview
            </h2>
            <p className="text-xs text-hh-gray">
              Your profile snapshot — what the agent knows about you
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 -mr-2 text-hh-gray hover:text-hh-charcoal rounded-md hover:bg-hh-cream"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 py-5 space-y-6">
          {!data ? (
            <p className="text-sm text-hh-gray">Couldn&apos;t load profile.</p>
          ) : (
            <>
              {/* Identity */}
              <section className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="h-12 w-12 rounded-full bg-gradient-to-br from-hh-orange to-hh-orange-dark text-white text-base font-bold flex items-center justify-center">
                    {data.fullName.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="font-display font-bold text-hh-black truncate">
                      {data.fullName}
                    </div>
                    <div className="text-xs text-hh-gray truncate">{data.email}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <ConnectionPill connected={data.swiggyConnected} />
                  {data.diet && (
                    <Pill className="bg-hh-cream text-hh-charcoal border border-hh-gray-light">
                      {data.diet}
                    </Pill>
                  )}
                  {data.personality && (
                    <Pill className="bg-hh-orange-light text-hh-orange-dark">
                      {data.personality.emoji} {data.personality.label}
                    </Pill>
                  )}
                </div>
              </section>

              {/* Budget */}
              <Section
                icon={<Wallet className="h-4 w-4" />}
                title="Monthly budget"
                subtitle={
                  data.monthlyBudget
                    ? `${formatRupees(data.monthSpend)} of ${formatRupees(data.monthlyBudget)}`
                    : "No cap set"
                }
              >
                {data.monthlyBudget != null ? (
                  <>
                    <ProgressBar pct={data.budgetUsedPct ?? 0} />
                    <div className="flex justify-between text-xs text-hh-gray pt-1.5 tabular">
                      <span>
                        {data.budgetUsedPct ?? 0}% used
                      </span>
                      <span className="text-hh-success font-semibold">
                        {formatRupees(
                          Math.max(0, data.monthlyBudget - data.monthSpend),
                        )}{" "}
                        left
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-hh-gray">
                    Set a budget in onboarding to enable Budget mode insights.
                  </p>
                )}
              </Section>

              {/* Allergies */}
              <Section
                icon={<AlertTriangle className="h-4 w-4" />}
                title="Allergies"
                subtitle={
                  data.allergies.length === 0
                    ? "None on file"
                    : `${data.allergies.length} flagged`
                }
              >
                {data.allergies.length === 0 ? (
                  <p className="text-xs text-hh-gray">
                    No allergens to filter against. SafePlate stays passive.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {data.allergies.map((a) => (
                      <Pill
                        key={a.allergen}
                        className={cn(
                          "border",
                          a.severity === "high"
                            ? "bg-red-50 border-hh-danger/30 text-hh-danger"
                            : a.severity === "medium"
                              ? "bg-amber-50 border-amber-300/40 text-amber-700"
                              : "bg-hh-cream border-hh-gray-light text-hh-charcoal",
                        )}
                      >
                        {a.allergen}
                        {a.severity !== "high" && (
                          <span className="text-[9px] opacity-80 ml-1 uppercase">
                            {a.severity}
                          </span>
                        )}
                      </Pill>
                    ))}
                  </div>
                )}
              </Section>

              {/* Cuisines + radius */}
              <Section
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Tastes & range"
              >
                <dl className="space-y-2.5 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-hh-gray shrink-0">Cuisines</dt>
                    <dd className="text-right">
                      {data.cuisines.length === 0 ? (
                        <span className="text-hh-gray text-xs">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 justify-end">
                          {data.cuisines.map((c) => (
                            <Pill
                              key={c}
                              className="bg-hh-cream text-hh-charcoal border border-hh-gray-light text-[11px]"
                            >
                              {c}
                            </Pill>
                          ))}
                        </div>
                      )}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <dt className="text-hh-gray">Delivery radius</dt>
                    <dd className="font-semibold text-hh-black tabular">
                      {data.deliveryRadiusKm >= 50
                        ? "Anywhere"
                        : `${data.deliveryRadiusKm} km`}
                    </dd>
                  </div>
                  {data.personality && (
                    <div className="flex items-baseline justify-between">
                      <dt className="text-hh-gray">Food personality</dt>
                      <dd className="text-hh-black">
                        {data.personality.emoji} {data.personality.label}
                      </dd>
                    </div>
                  )}
                </dl>
              </Section>

              {/* Recent orders */}
              <Section
                icon={<ShoppingBag className="h-4 w-4" />}
                title="Last orders"
                subtitle={
                  data.totalOrderCount === 0
                    ? "No orders yet"
                    : `${data.recentOrders.length} of ${data.totalOrderCount}`
                }
              >
                {data.recentOrders.length === 0 ? (
                  <p className="text-xs text-hh-gray">
                    {data.swiggyConnected
                      ? "Place your first order through the agent and it&apos;ll show up here."
                      : "Connect Swiggy to pull your order history."}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {data.recentOrders.map((o) => (
                      <li
                        key={o.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-hh-gray-light p-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-hh-black truncate">
                            {o.restaurant_name ?? "Order"}
                          </div>
                          <div className="text-[11px] text-hh-gray flex items-center gap-1.5">
                            <span className="uppercase tracking-wider font-medium">
                              {o.source}
                            </span>
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

              {/* What I've learned */}
              <Section
                icon={<Sparkles className="h-4 w-4" />}
                title="What I've learned about you"
                subtitle={
                  data.totalMemoryCount === 0
                    ? "Nothing yet"
                    : `${data.recentMemories.length} of ${data.totalMemoryCount}`
                }
              >
                {data.recentMemories.length === 0 ? (
                  <p className="text-xs text-hh-gray">
                    Chat with me a bit and I&apos;ll start picking up on stable
                    preferences (favourite spots, recurring constraints). They
                    show up here and I&apos;ll remember them for next time.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.recentMemories.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-start gap-2.5 rounded-xl border border-hh-orange-light/60 bg-gradient-to-r from-hh-orange-light/30 to-white p-3"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-hh-orange-dark shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-hh-charcoal">
                            {m.fact}
                          </div>
                          <div className="text-[10px] text-hh-gray mt-0.5">
                            {relativeTime(m.updated_at)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </>
          )}
        </div>

        <footer className="sticky bottom-0 border-t border-hh-gray-light bg-white p-4 space-y-2">
          <Link
            href="/profile"
            className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-hh-orange hover:bg-hh-orange-dark text-white text-sm font-semibold transition-colors"
            onClick={onClose}
          >
            <span className="inline-flex items-center gap-2">
              <Pencil className="h-3.5 w-3.5" />
              Edit profile
            </span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <form
            action="/api/account/reset-onboarding"
            method="post"
            onSubmit={onClose}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-hh-cream border border-hh-gray-light text-xs font-medium text-hh-charcoal hover:border-hh-orange/60 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Re-run onboarding
            </button>
          </form>
        </footer>
      </aside>
    </div>
  );
}

// ─── Small UI helpers ─────────────────────────────────────────────────────
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
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-hh-charcoal">
          <span className="text-hh-orange-dark">{icon}</span>
          <h3 className="text-sm font-semibold uppercase tracking-wider">
            {title}
          </h3>
        </div>
        {subtitle && <span className="text-xs text-hh-gray">{subtitle}</span>}
      </div>
      <div>{children}</div>
    </section>
  );
}

function Pill({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const bar =
    pct >= 95
      ? "from-hh-danger to-red-700"
      : pct >= 80
        ? "from-hh-warning to-amber-600"
        : "from-hh-orange to-hh-orange-dark";
  return (
    <div className="h-2 w-full rounded-full bg-hh-gray-light overflow-hidden">
      <div
        className={cn("h-full rounded-full bg-gradient-to-r", bar)}
        style={{ width: `${Math.max(2, pct)}%` }}
      />
    </div>
  );
}

function ConnectionPill({ connected }: { connected: boolean }) {
  return connected ? (
    <Pill className="bg-emerald-50 text-hh-success">
      <Check className="h-3 w-3 mr-1" /> Swiggy connected
    </Pill>
  ) : (
    <Pill className="bg-amber-50 text-amber-600">
      <AlertTriangle className="h-3 w-3 mr-1" /> Swiggy not connected
    </Pill>
  );
}
