import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="container">
        <div className="rounded-3xl bg-gradient-to-br from-hh-orange via-hh-orange-dark to-[#C84518] text-white p-10 md:p-16 text-center space-y-6 shadow-xl overflow-hidden relative">
          <div
            aria-hidden
            className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-2xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-2xl"
          />
          <h2 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight max-w-2xl mx-auto text-balance relative">
            Bhookh lagi? Let&apos;s go.
          </h2>
          <p className="text-base md:text-lg text-white/90 max-w-xl mx-auto relative">
            Sign up free. Connect Swiggy. Stop arguing about dinner.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2 relative">
            <Link href="/auth/sign-up">
              <Button
                size="lg"
                className="bg-white text-hh-orange-dark hover:bg-hh-cream w-full sm:w-auto"
              >
                Create your free account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#features">
              <Button
                size="lg"
                variant="ghost"
                className="text-white hover:bg-white/15 hover:text-white w-full sm:w-auto"
              >
                See how it works
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
