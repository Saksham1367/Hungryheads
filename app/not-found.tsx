import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-hh-cream px-4">
      <div className="w-full max-w-md text-center space-y-5 animate-fade-in">
        <div className="inline-flex flex-col items-center gap-3">
          <LogoMark className="h-12 w-12" />
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-hh-orange-dark bg-hh-orange-light px-3 py-1 rounded-full">
            <Search className="h-3 w-3" />
            404
          </span>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-hh-black">
          Page not found
        </h1>
        <p className="text-hh-charcoal">
          Either the URL is off, or you don&apos;t have access. Either way —
          let&apos;s get you back to food.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <Link href="/">
            <Button type="button" variant="primary" size="md">
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button type="button" variant="secondary" size="md">
              Open dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
