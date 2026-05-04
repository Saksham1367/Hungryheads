"use client";

import { PERSONALITIES } from "@/lib/constants";
import { useOnboardingStore } from "@/lib/onboarding/store";
import {
  QuestionCard,
  SelectableCard,
} from "@/components/onboarding/question-card";
import { cn } from "@/lib/utils/cn";

export function StepPersonality() {
  const value = useOnboardingStore((s) => s.draft.personality);
  const patch = useOnboardingStore((s) => s.patch);

  return (
    <QuestionCard
      step={5}
      eyebrow="Last question"
      title="Pick your food personality."
      subtitle="The agent uses this for tie-breakers when recommendations are otherwise equal."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PERSONALITIES.map((p) => {
          const selected = value === p.id;
          return (
            <SelectableCard
              key={p.id}
              selected={selected}
              onSelect={() => patch({ personality: p.id })}
              className={cn(
                "py-5 px-5",
                selected && "bg-hh-orange-light/30",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="text-3xl leading-none mt-0.5 select-none"
                >
                  {p.emoji}
                </span>
                <div>
                  <div className="font-display font-bold text-lg text-hh-black">
                    {p.label}
                  </div>
                  <div className="text-sm text-hh-gray">{p.blurb}</div>
                </div>
              </div>
            </SelectableCard>
          );
        })}
      </div>
      {!value && (
        <p className="text-xs text-hh-gray pt-3">Pick one to finish.</p>
      )}
    </QuestionCard>
  );
}
