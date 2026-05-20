import {
  Mic,
  RefreshCcw,
  ShoppingBasket,
  CalendarClock,
  Phone,
  Languages,
  Split,
} from "lucide-react";

/**
 * "What's coming next" — the roadmap, framed for visitors rather than for
 * engineers. No version numbers, no phase labels: just a clean grid of what
 * lands after the current release.
 */
const UPCOMING = [
  {
    icon: Mic,
    name: "VoiceOrder",
    blurb:
      "Order on WhatsApp with a voice note — “order my usual milk and bread.” The agent transcribes, confirms, and places it.",
  },
  {
    icon: RefreshCcw,
    name: "Smart Reorder",
    blurb:
      "Learns your rhythm — milk every 5 days, atta every 3 weeks — and pings you the moment something's due.",
  },
  {
    icon: ShoppingBasket,
    name: "Instamart groceries",
    blurb:
      "The same agent, now for your grocery basket. Search, build a cart, and check out — minus the doom-scroll.",
  },
  {
    icon: CalendarClock,
    name: "Dineout & table booking",
    blurb:
      "“Plan my evening” — book a table for four and line up dessert delivery for later, in one conversation.",
  },
  {
    icon: Phone,
    name: "Phone-call ordering",
    blurb:
      "A plain phone number for parents and grandparents who don't do apps. Same agent, same safety net — just dialled.",
  },
  {
    icon: Languages,
    name: "Multilingual voice",
    blurb:
      "Speak in Hindi, English, or a mix of both. The agent understands how India actually talks about food.",
  },
  {
    icon: Split,
    name: "UPI split links",
    blurb:
      "After a group order, send everyone a one-tap UPI link to settle their share. No more chasing friends for ₹140.",
  },
] as const;

export function WhatsNext() {
  return (
    <section id="whats-next" className="py-20 md:py-28 bg-hh-cream">
      <div className="container">
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <span className="text-sm font-semibold uppercase tracking-wider text-hh-orange-dark">
            What&apos;s coming next
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-hh-black text-balance">
            We&apos;re just getting started
          </h2>
          <p className="text-hh-charcoal text-base md:text-lg">
            Three features are live today. Here&apos;s what the roadmap looks
            like — every one built on the same agent, the same profile, the
            same safety net.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
          {UPCOMING.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.name}
                className="group rounded-2xl border border-hh-gray-light bg-white p-6 space-y-3 transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-hh-orange-light text-hh-orange-dark">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-hh-cream border border-hh-gray-light px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-hh-gray">
                    Coming soon
                  </span>
                </div>
                <h3 className="font-display font-bold text-lg text-hh-black">
                  {f.name}
                </h3>
                <p className="text-sm text-hh-charcoal leading-relaxed">
                  {f.blurb}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
