import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { BRAND } from "@/lib/constants";

const FOOTER_LINKS = {
  product: [
    { label: "SafePlate", href: "#safeplate" },
    { label: "SpendSmart", href: "#spendsmart" },
    { label: "FoodHuddle", href: "#foodhuddle" },
    { label: "What's next", href: "#whats-next" },
  ],
  company: [
    { label: "How it works", href: "#how-it-works" },
    { label: "Builders Club", href: "https://mcp.swiggy.com/builders" },
    { label: "Contact", href: `mailto:${BRAND.contactEmail}` },
  ],
  legal: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "DPDP compliance", href: "/dpdp" },
  ],
};

export function MarketingFooter() {
  return (
    <footer className="bg-hh-black text-white py-16">
      <div className="container">
        <div className="grid md:grid-cols-4 gap-10">
          <div className="space-y-4 md:col-span-1">
            <Logo className="text-white [&>span:last-child]:text-white" />
            <p className="text-sm text-white/70 max-w-xs">
              {BRAND.tagline} Built on Swiggy Builders Club. Powered by Claude.
            </p>
            <p className="text-xs text-white/50">
              Restaurant, menu, and order data{" "}
              <span className="text-[#FF5200] font-semibold">
                Powered by Swiggy
              </span>
              .
            </p>
          </div>

          <FooterColumn title="Product" links={FOOTER_LINKS.product} />
          <FooterColumn title="Company" links={FOOTER_LINKS.company} />
          <FooterColumn title="Legal" links={FOOTER_LINKS.legal} />
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between gap-4 text-xs text-white/60">
          <span>© {new Date().getFullYear()} HungryHeads. All rights reserved.</span>
          <span>
            Built for{" "}
            <a
              href={`mailto:${BRAND.contactEmail}`}
              className="underline hover:text-white"
            >
              Swiggy Builders Club
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <div className="font-semibold text-white mb-3 text-sm uppercase tracking-wider">
        {title}
      </div>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-sm text-white/70 hover:text-hh-orange transition-colors"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
