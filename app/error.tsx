"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo";
import { BRAND } from "@/lib/constants";

/**
 * Root error boundary. Catches anything not caught by a more specific
 * boundary. Never leaks stack traces to the user — Next.js's `digest` is
 * the only way support can correlate a report to the server log.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production this is where Sentry.captureException() would go.
    // Phase 1: rely on Vercel/Next runtime logs.
    console.error("[RootError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-hh-cream px-4">
      <div className="w-full max-w-md text-center space-y-5 animate-fade-in">
        <div className="inline-flex flex-col items-center gap-3">
          <LogoMark className="h-12 w-12 opacity-70" />
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-hh-danger bg-red-50 px-3 py-1 rounded-full">
            <AlertTriangle className="h-3 w-3" />
            Something broke
          </span>
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-hh-black">
          We hit a bump.
        </h1>
        <p className="text-hh-charcoal">
          Try again — usually that&apos;s enough. If it keeps happening, drop
          us a note and we&apos;ll fix it.
        </p>
        {error.digest && (
          <p className="text-[11px] text-hh-gray font-mono">
            ref: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <Button type="button" variant="primary" size="md" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
          <Link href="/">
            <Button type="button" variant="secondary" size="md">
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Button>
          </Link>
        </div>
        <p className="text-xs text-hh-gray pt-4">
          Email us:{" "}
          <a
            href={`mailto:${BRAND.contactEmail}`}
            className="text-hh-orange-dark underline hover:no-underline"
          >
            {BRAND.contactEmail}
          </a>
        </p>
      </div>
    </div>
  );
}
