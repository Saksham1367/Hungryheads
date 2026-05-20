import { Loader2 } from "lucide-react";
import { LogoMark } from "@/components/ui/logo";

/**
 * Root loading fallback. Shown during the initial server render of any
 * route that doesn't ship its own `loading.tsx`. Brand-consistent + minimal.
 */
export default function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-hh-cream">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <LogoMark className="h-12 w-12 animate-pulse" />
        <div className="flex items-center gap-2 text-sm text-hh-gray">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>One sec…</span>
        </div>
      </div>
    </div>
  );
}
