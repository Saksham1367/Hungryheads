import { Sparkles } from "lucide-react";

/**
 * "The problem" strip — sits right under the hero. Dramatises the core pain
 * (the endless group-chat dinner debate) with a mock chat thread, then lands
 * the HungryHeads resolution. Replaces the old bare stats band — same slot,
 * but it tells a story instead of reciting numbers.
 */

// The decision-paralysis spiral. `me` flips the bubble side.
const SPIRAL = [
  { me: false, text: "guys where are we eating tonight" },
  { me: true, text: "idk anything works" },
  { me: false, text: "you decide na 🙄" },
  { me: true, text: "not chinese, had it yesterday" },
  { me: false, text: "i'm veg btw" },
  { me: true, text: "and peanuts are a no for me 🥜" },
  { me: false, text: "...so??" },
] as const;

export function ProblemStrip() {
  return (
    <section className="bg-hh-black text-white py-16 md:py-24 overflow-hidden">
      <div className="container grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left — the pitch */}
        <div className="space-y-5">
          <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-hh-orange">
            Sound familiar?
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-balance">
            The 45-minute dinner debate.
            <br />
            <span className="text-hh-orange">Every. Single. Night.</span>
          </h2>
          <p className="text-white/70 text-base md:text-lg max-w-md leading-relaxed">
            Nobody wants to decide. Someone&apos;s vegetarian. Someone&apos;s
            allergic. Someone&apos;s broke till payday. So the group chat just…
            spirals — until everyone gives up and cooks Maggi.
          </p>
          <div className="inline-flex items-center gap-2.5 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
            <Sparkles className="h-4 w-4 text-hh-orange shrink-0" />
            <span className="text-sm text-white/90">
              HungryHeads settles it in{" "}
              <span className="font-bold text-white">~40 seconds</span> —
              allergies cleared, budget respected, everyone fed.
            </span>
          </div>
        </div>

        {/* Right — the mock group chat */}
        <div className="relative mx-auto w-full max-w-[380px]">
          <div className="rounded-3xl border border-white/10 bg-[#0f0f0f] shadow-2xl p-4 space-y-2.5">
            <div className="text-center text-[11px] font-semibold text-white/70 pb-1">
              Dinner Squad · 6 members
            </div>

            {SPIRAL.map((m, i) => (
              <div
                key={i}
                className={m.me ? "flex justify-end" : "flex justify-start"}
              >
                <span
                  className={
                    m.me
                      ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-hh-orange/90 text-white px-3.5 py-2 text-[13px]"
                      : "max-w-[80%] rounded-2xl rounded-tl-sm bg-white/10 text-white/90 px-3.5 py-2 text-[13px]"
                  }
                >
                  {m.text}
                </span>
              </div>
            ))}

            {/* The dead-end */}
            <div className="text-center py-1">
              <span className="text-[11px] font-mono text-white/65">
                — 47 minutes later —
              </span>
            </div>
            <div className="flex justify-start">
              <span className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white/10 text-white/90 px-3.5 py-2 text-[13px]">
                let&apos;s just skip it 😩
              </span>
            </div>

            {/* The HungryHeads resolution */}
            <div className="!mt-4 rounded-2xl bg-gradient-to-br from-hh-orange to-hh-orange-dark p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/90">
                <Sparkles className="h-3 w-3" />
                FoodHuddle decided
              </div>
              <div className="text-sm font-semibold text-white">
                Punjab Grill · 4.5★ · ₹380/head
              </div>
              <div className="text-[12px] text-white/85">
                Veg options ✓ · peanut-free ✓ · under everyone&apos;s budget ✓
              </div>
              <div className="text-[11px] text-white/70 pt-0.5">
                Decided in 41 seconds.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
