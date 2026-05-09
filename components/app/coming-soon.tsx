import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/app/header";

/**
 * Shared placeholder for protected routes that aren't fully built yet.
 * Each route gets its own thin page.tsx that imports this and supplies
 * step / title / blurb. Replaced one-by-one as we work through Phase 1.
 */
export function ComingSoon({
  step,
  title,
  blurb,
  badge = "Coming soon",
}: {
  step: string;
  title: string;
  blurb: string;
  badge?: string;
}) {
  return (
    <div className="min-h-screen bg-hh-cream">
      <AppHeader />
      <div className="container max-w-2xl py-16 md:py-24 space-y-6 text-center">
        <span className="inline-block rounded-full bg-hh-orange-light px-3 py-1 text-xs font-bold text-hh-orange-dark uppercase tracking-wider">
          {badge}
        </span>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-hh-black">
          {title}
        </h1>
        <p className="text-hh-charcoal max-w-md mx-auto">{blurb}</p>
        <p className="text-xs text-hh-gray font-mono">{step}</p>
        <Link href="/dashboard" className="inline-block">
          <Button variant="secondary" size="md">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
