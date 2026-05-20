import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { Button } from "@/components/ui/button";

/**
 * Shared shell for the marketing-side legal pages (privacy, terms, dpdp).
 * Phase 1 stubs — short prose with a "Phase 2" badge so visitors and
 * Builders Club reviewers know we know.
 */
export function LegalPage({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-hh-cream">
      <MarketingNav />
      <main className="flex-1">
        <article className="container max-w-2xl py-16 md:py-24 space-y-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-hh-gray hover:text-hh-charcoal"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <div className="space-y-2">
            <span className="inline-block rounded-full bg-hh-orange-light px-3 py-1 text-xs font-bold text-hh-orange-dark uppercase tracking-wider">
              {eyebrow}
            </span>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-hh-black">
              {title}
            </h1>
            <p className="text-xs text-hh-gray font-mono">
              Phase-1 stub · final policy lands before public launch
            </p>
          </div>
          <div className="prose prose-sm max-w-none text-hh-charcoal space-y-4 [&_h2]:font-display [&_h2]:font-bold [&_h2]:text-hh-black [&_h2]:text-lg [&_h2]:mt-6">
            {children}
          </div>
          <div className="pt-6 border-t border-hh-gray-light">
            <Link href="/auth/sign-up" className="inline-block">
              <Button variant="primary" size="md">
                Sign up for HungryHeads
              </Button>
            </Link>
          </div>
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
