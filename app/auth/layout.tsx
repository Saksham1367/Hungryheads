import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { BRAND } from "@/lib/constants";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — form */}
      <div className="flex flex-col px-6 py-8 md:px-10 lg:px-16">
        <Link href="/" aria-label="HungryHeads home" className="inline-block">
          <Logo />
        </Link>
        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
        <p className="text-xs text-hh-gray text-center">
          © {new Date().getFullYear()} HungryHeads · Built on Swiggy Builders
          Club
        </p>
      </div>

      {/* Right — branded panel (hidden on small screens) */}
      <div className="hidden lg:block relative bg-gradient-to-br from-hh-orange via-hh-orange-dark to-[#C84518] overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-white/10 blur-3xl"
        />
        <div className="relative h-full flex flex-col justify-between p-12 text-white">
          <div className="space-y-4">
            <span className="inline-block rounded-full bg-white/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider backdrop-blur">
              Powered by Claude
            </span>
            <h2 className="font-display text-4xl xl:text-5xl font-extrabold leading-tight text-balance">
              {BRAND.tagline}
            </h2>
            <p className="text-white/85 text-lg max-w-md">
              One profile. Four superpowers. Allergies handled, budget
              respected, group decisions solved.
            </p>
          </div>
          <blockquote className="space-y-2 max-w-md">
            <p className="text-lg italic">
              “Bhookh lagi? Let&apos;s go.”
            </p>
            <p className="text-sm text-white/70">
              — every HungryHeads user, every Friday at 7pm
            </p>
          </blockquote>
        </div>
      </div>
    </div>
  );
}
