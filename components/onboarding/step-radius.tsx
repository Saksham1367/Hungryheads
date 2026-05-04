"use client";

import { MapPin, Plane } from "lucide-react";
import { useOnboardingStore } from "@/lib/onboarding/store";
import {
  QuestionCard,
  SelectableCard,
} from "@/components/onboarding/question-card";
import { cn } from "@/lib/utils/cn";

const OPTIONS = [
  { km: 2, label: "Walking distance", icon: MapPin },
  { km: 5, label: "Short ride", icon: MapPin },
  { km: 10, label: "Across town", icon: MapPin },
  { km: 50, label: "I'll travel anywhere", icon: Plane },
] as const;

export function StepRadius() {
  const value = useOnboardingStore((s) => s.draft.deliveryRadiusKm);
  const patch = useOnboardingStore((s) => s.patch);

  return (
    <QuestionCard
      step={4}
      eyebrow="Question 4"
      title="How far will you travel for food?"
      subtitle="We'll keep recommendations within your radius — for delivery and dine-out."
    >
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map(({ km, label, icon: Icon }) => {
          const selected = value === km;
          return (
            <SelectableCard
              key={km}
              selected={selected}
              onSelect={() => patch({ deliveryRadiusKm: km })}
              className={cn(
                "py-5 px-5",
                selected && "bg-hh-orange-light/30",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "h-9 w-9 rounded-xl inline-flex items-center justify-center shrink-0",
                    selected
                      ? "bg-hh-orange text-white"
                      : "bg-hh-orange-light text-hh-orange-dark",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-display font-bold text-lg tabular text-hh-black">
                    {km === 50 ? "Anywhere" : `${km} km`}
                  </div>
                  <div className="text-xs text-hh-gray">{label}</div>
                </div>
              </div>
            </SelectableCard>
          );
        })}
      </div>
      {value === undefined && (
        <p className="text-xs text-hh-gray pt-3">Pick one to continue.</p>
      )}
    </QuestionCard>
  );
}
