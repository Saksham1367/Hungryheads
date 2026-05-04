import { ShieldCheck, Wallet, Mic, Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface FeatureCopy {
  id: string;
  name: string;
  tagline: string;
  description: string;
  solves: string;
  bullets: string[];
  icon: typeof ShieldCheck;
  badge?: string;
}

/**
 * Brief §2 — feature copy. Single source of truth for the four
 * marketing sections so /dashboard cards and /<feature> pages can
 * reuse the same blurbs.
 */
export const FEATURE_COPY: FeatureCopy[] = [
  {
    id: "safeplate",
    name: "SafePlate",
    tagline: "Allergy & diet safety net",
    description:
      "Set it once. Every menu you browse is silently filtered against your allergies and diet. Risky items get flagged in red — and orders are blocked at checkout, even by accident.",
    solves:
      "The lifelong fear of accidentally ordering peanut sauce. Or beef when you're vegetarian.",
    bullets: [
      "Filters every restaurant menu against your profile",
      "Blocks checkout if a flagged item is in your cart",
      "Typed override for intentional choices — no nags",
    ],
    icon: ShieldCheck,
    badge: "Always on",
  },
  {
    id: "spendsmart",
    name: "SpendSmart",
    tagline: "Monthly budget guardrail",
    description:
      "Set a monthly food + grocery cap. We pull your Swiggy history, compute spend-to-date, and show live impact before every order. Monthly insights break down spend by cuisine, time, and habit.",
    solves: "The “where did ₹6,000 go this month” Sunday-night shock.",
    bullets: [
      "Live budget impact before you confirm an order",
      "Monthly report by cuisine, time-of-day, repeat spots",
      "Smart suggestions when you're approaching the cap",
    ],
    icon: Wallet,
    badge: "Phase 2",
  },
  {
    id: "voiceorder",
    name: "VoiceOrder",
    tagline: "Speak-to-order + smart reorders",
    description:
      "Say it on WhatsApp — “order my usual milk and bread.” Claude parses, confirms in plain language, places COD order. Smart reorder learns your cadence (milk every 5 days, atta every 3 weeks) and pings when items are due.",
    solves:
      "Elderly parents who can't navigate apps, anyone driving, anyone who just wants their *usual* without 12 taps.",
    bullets: [
      "Voice notes via WhatsApp — no app to install",
      "Smart reorder learns your cadence over weeks",
      "Always confirms cart + total before placing",
    ],
    icon: Mic,
    badge: "Phase 3",
  },
  {
    id: "foodhuddle",
    name: "FoodHuddle",
    tagline: "Group decision engine",
    description:
      "One admin starts a huddle. Friends join with a 6-letter code. Live poll on cuisine, mood, budget, distance. The agent respects everyone's allergies and diet, weighs preferences by votes, and returns the top 3 — explained.",
    solves: "The universal “haan tu bata” 45-minute group decision spiral.",
    bullets: [
      "Real-time member list + live poll progress",
      "Top 3 picks with reasoning per choice",
      "Two CTAs: “We'll decide” or “Spin the wheel 🎲”",
      "UPI split links — one tap to settle up",
    ],
    icon: Users,
    badge: "Hero feature",
  },
];

export function FeatureSection({
  feature,
  index,
}: {
  feature: FeatureCopy;
  index: number;
}) {
  const reversed = index % 2 === 1;
  const Icon = feature.icon;

  return (
    <section
      id={feature.id}
      className={cn(
        "py-16 md:py-24",
        // Alternate background tones so the eye knows where one section ends
        index % 2 === 0 ? "bg-white" : "bg-hh-cream",
      )}
    >
      <div
        className={cn(
          "container grid lg:grid-cols-2 gap-10 lg:gap-16 items-center",
        )}
      >
        <div
          className={cn(
            "space-y-5",
            reversed ? "lg:order-2" : "lg:order-1",
          )}
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-hh-orange-light text-hh-orange-dark">
              <Icon className="h-5 w-5" />
            </span>
            {feature.badge && (
              <span className="text-xs font-semibold uppercase tracking-wider text-hh-orange-dark">
                {feature.badge}
              </span>
            )}
          </div>

          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-hh-black">
            {feature.name}
          </h2>
          <p className="text-lg font-semibold text-hh-orange-dark">
            {feature.tagline}
          </p>
          <p className="text-base text-hh-charcoal leading-relaxed">
            {feature.description}
          </p>

          <ul className="space-y-2 pt-2">
            {feature.bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-2.5 text-sm text-hh-charcoal"
              >
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-hh-orange shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <p className="pt-2 text-sm italic text-hh-gray">
            <span className="font-semibold text-hh-charcoal not-italic">
              Solves:{" "}
            </span>
            {feature.solves}
          </p>
        </div>

        <div className={cn(reversed ? "lg:order-1" : "lg:order-2")}>
          <FeatureVisual id={feature.id} />
        </div>
      </div>
    </section>
  );
}

/** Per-feature illustrative card. Pure CSS — no external images. */
function FeatureVisual({ id }: { id: string }) {
  switch (id) {
    case "safeplate":
      return (
        <div className="rounded-2xl border border-hh-gray-light bg-white shadow-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-display font-bold text-lg">Pad Thai</span>
            <span className="rounded-full bg-red-50 text-hh-danger text-xs font-bold uppercase px-2.5 py-1">
              Peanut alert
            </span>
          </div>
          <div className="rounded-xl border border-hh-danger/30 bg-red-50/50 p-3 text-sm text-hh-danger">
            Contains crushed peanuts — flagged because you marked Peanuts as a
            high-severity allergen.
          </div>
          <div className="rounded-xl border border-hh-gray-light p-3 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-hh-gray">Veg Pad See Ew</span>
              <span className="text-hh-success font-semibold">Safe</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-hh-gray">Crispy Tofu Bowl</span>
              <span className="text-hh-success font-semibold">Safe</span>
            </div>
          </div>
        </div>
      );

    case "spendsmart":
      return (
        <div className="rounded-2xl border border-hh-gray-light bg-white shadow-xl p-6 space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-sm text-hh-gray">November so far</div>
              <div className="font-display font-extrabold text-3xl tabular">
                ₹3,420
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-hh-gray">of ₹5,000</div>
              <div className="text-sm font-semibold text-hh-success">
                ₹1,580 left
              </div>
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-hh-gray-light overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-hh-orange to-hh-orange-dark"
              style={{ width: "68%" }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 text-center">
            {[
              { l: "Biryani", v: "₹1,240" },
              { l: "Coffee", v: "₹820" },
              { l: "Snacks", v: "₹540" },
            ].map((s) => (
              <div
                key={s.l}
                className="rounded-xl bg-hh-cream p-3"
              >
                <div className="text-xs text-hh-gray">{s.l}</div>
                <div className="text-sm font-semibold tabular">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      );

    case "voiceorder":
      return (
        <div className="rounded-2xl border border-hh-gray-light bg-white shadow-xl p-6 space-y-3">
          <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-hh-orange px-4 py-2.5 text-white text-sm">
            🎤 “Order my usual milk and bread”
          </div>
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-hh-cream px-4 py-3 text-sm text-hh-charcoal space-y-2">
            <div className="font-semibold">Got it — confirming:</div>
            <ul className="space-y-1 text-sm">
              <li>· Amul Taaza Milk 1L × 2</li>
              <li>· Britannia Brown Bread × 1</li>
            </ul>
            <div className="flex items-center justify-between pt-1.5 border-t border-hh-gray-light">
              <span className="text-hh-gray text-xs">Total · COD</span>
              <span className="font-bold tabular">₹178</span>
            </div>
            <div className="text-xs text-hh-gray">
              Reply <span className="font-semibold">YES</span> to place.
            </div>
          </div>
        </div>
      );

    case "foodhuddle":
      return (
        <div className="rounded-2xl border border-hh-gray-light bg-white shadow-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-display font-bold text-lg">
              Top 3 picks
            </span>
            <span className="text-xs text-hh-gray">Decided in 38s</span>
          </div>
          {[
            { rank: 1, name: "Punjab Grill", meta: "4.5 ★ · 2.1 km" },
            { rank: 2, name: "Olio Pizza", meta: "4.3 ★ · 1.4 km" },
            { rank: 3, name: "Wok in the Clouds", meta: "4.1 ★ · 3.0 km" },
          ].map((r) => (
            <div
              key={r.rank}
              className="flex items-center gap-3 rounded-xl border border-hh-gray-light p-3"
            >
              <div className="h-9 w-9 rounded-full bg-hh-orange text-white font-bold flex items-center justify-center">
                {r.rank}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-hh-black">{r.name}</div>
                <div className="text-xs text-hh-gray">{r.meta}</div>
              </div>
              <span className="text-xs font-semibold text-hh-success">
                Safe
              </span>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <div className="flex-1 rounded-full bg-hh-orange text-white text-sm font-semibold py-2.5 text-center">
              We&apos;ll decide
            </div>
            <div className="flex-1 rounded-full border border-hh-gray-light text-hh-charcoal text-sm font-semibold py-2.5 text-center">
              🎲 Spin
            </div>
          </div>
        </div>
      );
  }
  return null;
}
