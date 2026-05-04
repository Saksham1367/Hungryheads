"use client";

import { AlertTriangle } from "lucide-react";
import { ALLERGENS, DIETS } from "@/lib/constants";
import { useOnboardingStore } from "@/lib/onboarding/store";
import {
  QuestionCard,
  Chip,
  SelectableCard,
} from "@/components/onboarding/question-card";

export function StepAllergiesAndDiet() {
  const draft = useOnboardingStore((s) => s.draft);
  const patch = useOnboardingStore((s) => s.patch);

  const allergies = draft.allergies ?? [];
  const diet = draft.diet;

  const toggleAllergy = (a: (typeof ALLERGENS)[number]) => {
    const set = new Set(allergies);
    if (set.has(a)) set.delete(a);
    else set.add(a);
    patch({ allergies: ALLERGENS.filter((x) => set.has(x)) });
  };

  return (
    <QuestionCard
      step={2}
      eyebrow="Question 2"
      title="Any allergies or diet preferences?"
      subtitle="SafePlate uses this to flag risky items and block them at checkout."
    >
      <div className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-hh-danger" />
            <h3 className="text-sm font-semibold text-hh-charcoal">
              Allergies (multi-select)
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {ALLERGENS.map((a) => (
              <Chip
                key={a}
                selected={allergies.includes(a)}
                onToggle={() => toggleAllergy(a)}
              >
                {a}
              </Chip>
            ))}
            <Chip
              selected={allergies.length === 0}
              onToggle={() => patch({ allergies: [] })}
            >
              None
            </Chip>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-hh-charcoal">
            Diet preference
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DIETS.map((d) => (
              <SelectableCard
                key={d}
                selected={diet === d}
                onSelect={() => patch({ diet: d })}
                className="text-center text-sm font-medium"
              >
                {d}
              </SelectableCard>
            ))}
          </div>
          {!diet && (
            <p className="text-xs text-hh-gray">
              Pick one to continue.
            </p>
          )}
        </section>
      </div>
    </QuestionCard>
  );
}
