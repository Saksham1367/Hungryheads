"use client";

import { CUISINES } from "@/lib/constants";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { QuestionCard, Chip } from "@/components/onboarding/question-card";

export function StepCuisines() {
  const cuisines = useOnboardingStore((s) => s.draft.cuisines ?? []);
  const patch = useOnboardingStore((s) => s.patch);

  const toggle = (c: (typeof CUISINES)[number]) => {
    const set = new Set(cuisines);
    if (set.has(c)) set.delete(c);
    else set.add(c);
    // Maintain CUISINES order so persistence is deterministic
    patch({ cuisines: CUISINES.filter((x) => set.has(x)) });
  };

  return (
    <QuestionCard
      step={1}
      eyebrow="Question 1"
      title="What do you love eating?"
      subtitle="Pick everything that hits the spot. We'll lean toward these for recommendations."
    >
      <div className="flex flex-wrap gap-2">
        {CUISINES.map((c) => (
          <Chip
            key={c}
            selected={cuisines.includes(c)}
            onToggle={() => toggle(c)}
          >
            {c}
          </Chip>
        ))}
      </div>
      {cuisines.length === 0 && (
        <p className="text-xs text-hh-gray pt-3">
          Pick at least one to continue.
        </p>
      )}
    </QuestionCard>
  );
}
