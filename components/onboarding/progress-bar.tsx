import { cn } from "@/lib/utils/cn";
import { TOTAL_STEPS } from "@/lib/onboarding/schema";

export function ProgressBar({ step }: { step: number }) {
  const pct = Math.round((step / TOTAL_STEPS) * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-hh-gray">
        <span className="font-semibold text-hh-charcoal">
          Question {step} of {TOTAL_STEPS}
        </span>
        <span className="tabular">{pct}%</span>
      </div>
      <div className="relative h-2 rounded-full bg-hh-gray-light overflow-hidden">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-hh-orange to-hh-orange-dark transition-[width] duration-500 ease-out",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
