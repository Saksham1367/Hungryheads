import { Check, Users, Vote, Zap } from "lucide-react";

/**
 * Static mock of a FoodHuddle in flight — used as the hero visual. Pure SVG +
 * Tailwind, no images, no JS. Conveys the "live group decision" feel without
 * requiring a real Swiggy account.
 */
export function HuddleMockup() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* Floating chips */}
      <div className="absolute -top-4 -left-4 hidden sm:flex items-center gap-1.5 rounded-full bg-white shadow-lg px-3 py-1.5 text-xs font-medium text-hh-charcoal animate-fade-in">
        <Users className="h-3.5 w-3.5 text-hh-orange" />
        4 friends joined
      </div>
      <div className="absolute -bottom-4 -right-4 hidden sm:flex items-center gap-1.5 rounded-full bg-white shadow-lg px-3 py-1.5 text-xs font-medium text-hh-success animate-fade-in">
        <Zap className="h-3.5 w-3.5" />
        Decided in 38s
      </div>

      <div className="rounded-2xl border border-hh-gray-light bg-white shadow-xl overflow-hidden">
        {/* Card header */}
        <div className="bg-hh-orange px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider opacity-90">
                FoodHuddle · live
              </div>
              <div className="font-display font-bold text-lg">
                Friday Dinner
              </div>
            </div>
            <div className="text-2xl font-mono font-bold tracking-widest tabular">
              4FRENZ
            </div>
          </div>
        </div>

        {/* Members + votes */}
        <div className="p-5 space-y-4">
          <div className="flex items-center -space-x-2">
            {["A", "B", "P", "S"].map((c, i) => (
              <div
                key={i}
                className="h-9 w-9 rounded-full border-2 border-white bg-gradient-to-br from-hh-orange to-hh-orange-dark text-white text-sm font-bold flex items-center justify-center"
              >
                {c}
              </div>
            ))}
            <span className="pl-4 text-sm text-hh-gray">
              all submitted
            </span>
          </div>

          {/* Vote bars */}
          <div className="space-y-2.5 pt-1">
            <VoteRow label="Indian" pct={75} />
            <VoteRow label="Italian" pct={50} />
            <VoteRow label="Chinese" pct={25} />
          </div>

          {/* Recommendation */}
          <div className="mt-4 rounded-xl border border-hh-orange-light bg-hh-cream p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-hh-orange text-white text-[10px] font-bold px-2 py-0.5 uppercase">
                Top pick
              </span>
              <span className="text-xs text-hh-gray">
                4.5 ★ · 2.1 km · ₹350/person
              </span>
            </div>
            <div className="font-display font-bold text-hh-black">
              Punjab Grill — North Indian
            </div>
            <div className="text-sm text-hh-charcoal flex items-start gap-1.5">
              <Check className="h-4 w-4 text-hh-success shrink-0 mt-0.5" />
              <span>
                Fits everyone&apos;s budget; respects Aman&apos;s peanut allergy.
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <div className="flex-1 rounded-full bg-hh-orange text-white text-sm font-semibold py-2.5 text-center flex items-center justify-center gap-1.5">
              <Vote className="h-4 w-4" />
              We&apos;ll decide
            </div>
            <div className="flex-1 rounded-full border border-hh-gray-light text-hh-charcoal text-sm font-semibold py-2.5 text-center">
              🎲 Spin
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VoteRow({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-hh-charcoal">{label}</span>
        <span className="text-hh-gray tabular">{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-hh-gray-light overflow-hidden">
        <div
          className="h-full bg-hh-orange rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
