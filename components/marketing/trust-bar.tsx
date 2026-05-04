import { ShieldCheck, MapPin, Sparkles } from "lucide-react";

const TRUST_ITEMS = [
  {
    icon: Sparkles,
    title: "Powered by Claude",
    blurb: "Anthropic's frontier model brains every recommendation",
  },
  {
    icon: ShieldCheck,
    title: "Built on Swiggy",
    blurb: "Official Builders Club MCP integration — OAuth 2.1 PKCE",
  },
  {
    icon: MapPin,
    title: "Your data stays in India",
    blurb: "DPDP-compliant storage; PII never leaves the region",
  },
] as const;

export function TrustBar() {
  return (
    <section className="py-16 bg-hh-cream border-y border-hh-gray-light">
      <div className="container">
        <div className="grid md:grid-cols-3 gap-6">
          {TRUST_ITEMS.map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.title}
                className="flex items-start gap-4 rounded-xl bg-white border border-hh-gray-light p-5"
              >
                <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-hh-orange-light text-hh-orange-dark shrink-0">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-semibold text-hh-black">{t.title}</div>
                  <div className="text-sm text-hh-gray mt-0.5">{t.blurb}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
