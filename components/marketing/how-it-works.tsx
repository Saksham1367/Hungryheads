import { UserPlus, Link2, Utensils } from "lucide-react";

const STEPS = [
  {
    n: 1,
    icon: UserPlus,
    title: "Sign up",
    blurb:
      "Email or Google. Tell us your allergies, diet, budget and what you love eating in 5 quick questions.",
  },
  {
    n: 2,
    icon: Link2,
    title: "Connect Swiggy",
    blurb:
      "One-click OAuth to link your Swiggy account. We never see your password — and your token stays encrypted at rest in India.",
  },
  {
    n: 3,
    icon: Utensils,
    title: "Start ordering",
    blurb:
      "FoodHuddle settles the group debate, SafePlate guards every checkout, SpendSmart watches the bill. One profile, every superpower.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-white">
      <div className="container">
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <span className="text-sm font-semibold uppercase tracking-wider text-hh-orange-dark">
            How it works
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-hh-black">
            Three steps. Then never argue about food again.
          </h2>
        </div>

        <div className="relative grid md:grid-cols-3 gap-6 mt-12">
          {/* Connecting line on desktop */}
          <div
            aria-hidden
            className="hidden md:block absolute top-7 left-[12%] right-[12%] h-px bg-gradient-to-r from-hh-orange-light via-hh-orange to-hh-orange-light"
          />

          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.n}
                className="relative bg-white rounded-2xl border border-hh-gray-light p-6 text-center space-y-3"
              >
                <div className="relative inline-flex items-center justify-center h-14 w-14 rounded-full bg-hh-orange text-white shadow-md mx-auto">
                  <Icon className="h-6 w-6" />
                  <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border-2 border-hh-orange text-hh-orange-dark text-xs font-bold flex items-center justify-center">
                    {s.n}
                  </span>
                </div>
                <h3 className="font-display font-bold text-xl text-hh-black">
                  {s.title}
                </h3>
                <p className="text-sm text-hh-charcoal leading-relaxed">
                  {s.blurb}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
