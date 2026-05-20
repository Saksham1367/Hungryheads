import { ChevronDown } from "lucide-react";

/**
 * FAQ section. Native <details>/<summary> accordion — zero JS, fully
 * keyboard-accessible, and the `id="faq"` target the nav link points at.
 */
const FAQS = [
  {
    q: "Is HungryHeads free?",
    a: "Yes — creating an account and using the agent is free. You only ever pay for the food itself, charged through Swiggy as cash on delivery.",
  },
  {
    q: "How does the allergy protection actually work?",
    a: "When you sign up you tell us your allergies and diet once. After that, SafePlate filters every menu you browse and blocks any order containing a flagged item — even if you or the agent miss it. It's a safety net, not a nag: you can always type an explicit override.",
  },
  {
    q: "Do I have to connect my Swiggy account?",
    a: "To place real orders, yes — HungryHeads links to Swiggy through their official Builders Club integration using OAuth 2.1. We never see your Swiggy password, and you can disconnect anytime. You can explore the agent and FoodHuddle before connecting.",
  },
  {
    q: "Is my data safe?",
    a: "Your data is stored in India (Mumbai region) and handled under the DPDP Act, 2023. Swiggy order data stays governed by Swiggy's own privacy terms. We never sell your data or use it for advertising.",
  },
  {
    q: "What payment methods are supported?",
    a: "Cash on delivery, with a ₹1,000 cap per order, while we're in the Swiggy Builders Club programme. Online payment support is on the roadmap.",
  },
  {
    q: "Can my whole friend group use one huddle?",
    a: "That's exactly what FoodHuddle is for. One person starts a huddle and shares a 6-letter code; everyone joins, votes, and the agent finds a spot that's safe and affordable for the entire group.",
  },
] as const;

export function Faq() {
  return (
    <section id="faq" className="py-20 md:py-28 bg-hh-cream">
      <div className="container max-w-3xl">
        <div className="text-center space-y-3">
          <span className="text-sm font-semibold uppercase tracking-wider text-hh-orange-dark">
            FAQ
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-hh-black text-balance">
            Questions, answered
          </h2>
        </div>

        <div className="mt-10 space-y-3">
          {FAQS.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-hh-gray-light bg-white px-5 py-4 [&_summary]:list-none"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-display font-bold text-hh-black">
                {item.q}
                <ChevronDown className="h-5 w-5 shrink-0 text-hh-orange-dark transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm text-hh-charcoal leading-relaxed">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
