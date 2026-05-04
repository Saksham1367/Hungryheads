import Link from "next/link";
import { ArrowRight, PlayCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HuddleMockup } from "@/components/marketing/huddle-mockup";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background flourish — soft coral wash */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-b from-hh-orange-light/40 via-hh-cream to-hh-cream"
      />
      <div
        aria-hidden
        className="absolute -top-40 -right-40 -z-10 h-[480px] w-[480px] rounded-full bg-hh-orange-light/60 blur-3xl"
      />

      <div className="container py-20 md:py-28 grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
        <div className="space-y-6 max-w-xl animate-fade-in">
          <span className="inline-flex items-center gap-2 rounded-full bg-hh-orange-light px-4 py-1.5 text-sm font-medium text-hh-orange-dark">
            <Sparkles className="h-3.5 w-3.5" />
            Built on Swiggy Builders Club
          </span>

          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-hh-black text-balance">
            Decide. Order. Eat.{" "}
            <span className="text-hh-orange">Together.</span>
          </h1>

          <p className="text-lg md:text-xl text-hh-charcoal max-w-lg">
            Your AI food companion. Solve allergies, budgets, group debates and
            reorders — all from one shared profile, one Claude-powered agent.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link href="/auth/sign-up">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                Get started — free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#features">
              <Button
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto"
              >
                <PlayCircle className="h-4 w-4" />
                Watch demo
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-6 pt-4 text-xs text-hh-gray">
            <span>No credit card needed</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">Your data stays in India</span>
          </div>
        </div>

        <div className="relative animate-fade-in">
          <HuddleMockup />
        </div>
      </div>
    </section>
  );
}
