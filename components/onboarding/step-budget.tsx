"use client";

import { useOnboardingStore } from "@/lib/onboarding/store";
import {
  QuestionCard,
  SelectableCard,
} from "@/components/onboarding/question-card";
import { formatRupees } from "@/lib/utils/format";
import { BUDGET_BANDS } from "@/lib/constants";
import { cn } from "@/lib/utils/cn";

export function StepBudget() {
  const draft = useOnboardingStore((s) => s.draft);
  const patch = useOnboardingStore((s) => s.patch);
  const value = draft.monthlyBudget;
  const isSet = value !== undefined;

  return (
    <QuestionCard
      step={3}
      eyebrow="Question 3"
      title="What's your monthly food budget?"
      subtitle="SpendSmart shows live impact before every order. You can change this any time."
    >
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {BUDGET_BANDS.map((band) => {
          const selected = isSet && value === band;
          return (
            <SelectableCard
              key={String(band)}
              selected={selected}
              onSelect={() => patch({ monthlyBudget: band })}
              className={cn(
                "text-center py-4",
                selected && "bg-hh-orange-light/30",
              )}
            >
              <div className="font-display font-extrabold text-xl tabular text-hh-black">
                {band === null ? "∞" : formatRupees(band)}
              </div>
              <div className="text-xs text-hh-gray mt-1">
                {band === null ? "No limit" : "/ month"}
              </div>
            </SelectableCard>
          );
        })}
      </div>
      {!isSet && (
        <p className="text-xs text-hh-gray pt-3">
          Pick a number — even a rough one helps.
        </p>
      )}
    </QuestionCard>
  );
}
