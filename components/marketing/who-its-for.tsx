/**
 * "Who it's for" — four relatable personas so a visitor can spot themselves
 * within five seconds. Pure CSS, emoji-led, no images.
 */
const PERSONAS = [
  {
    emoji: "👯",
    title: "Friend groups",
    blurb:
      "The ones whose dinner plans die in a 50-message group chat. FoodHuddle ends it in under a minute.",
  },
  {
    emoji: "🥜",
    title: "Anyone with an allergy",
    blurb:
      "Set your allergens once. Every menu is filtered, every risky order is blocked — no vigilance required.",
  },
  {
    emoji: "💸",
    title: "Budget-watchers",
    blurb:
      "Students and savers who want to enjoy ordering in without the end-of-month bill shock.",
  },
  {
    emoji: "👵",
    title: "Families & parents",
    blurb:
      "Order for elderly parents who don't navigate apps — soon, even over a plain phone call.",
  },
] as const;

export function WhoItsFor() {
  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="container">
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <span className="text-sm font-semibold uppercase tracking-wider text-hh-orange-dark">
            Who it&apos;s for
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-hh-black text-balance">
            Built for how India actually orders food
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {PERSONAS.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-hh-gray-light bg-hh-cream p-6 space-y-2.5"
            >
              <div className="text-3xl select-none" aria-hidden>
                {p.emoji}
              </div>
              <h3 className="font-display font-bold text-lg text-hh-black">
                {p.title}
              </h3>
              <p className="text-sm text-hh-charcoal leading-relaxed">
                {p.blurb}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
