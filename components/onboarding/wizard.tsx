"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/onboarding/progress-bar";
import { StepCuisines } from "@/components/onboarding/step-cuisines";
import { StepAllergiesAndDiet } from "@/components/onboarding/step-allergies-diet";
import { StepBudget } from "@/components/onboarding/step-budget";
import { StepRadius } from "@/components/onboarding/step-radius";
import { StepPersonality } from "@/components/onboarding/step-personality";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { onboardingSchema, TOTAL_STEPS } from "@/lib/onboarding/schema";
import { completeOnboarding } from "@/app/(app)/onboarding/actions";

const STEP_KEYS = [
  "cuisines",
  "allergiesAndDiet",
  "budget",
  "radius",
  "personality",
] as const;

/** Per-step gate: returns true if user can advance from that step. */
function canAdvance(step: number, draft: ReturnType<typeof useOnboardingStore.getState>["draft"]) {
  switch (step) {
    case 1:
      return (draft.cuisines?.length ?? 0) > 0;
    case 2:
      return !!draft.diet; // allergies can be empty
    case 3:
      return draft.monthlyBudget !== undefined;
    case 4:
      return draft.deliveryRadiusKm !== undefined;
    case 5:
      return !!draft.personality;
    default:
      return false;
  }
}

export function OnboardingWizard() {
  const step = useOnboardingStore((s) => s.step);
  const draft = useOnboardingStore((s) => s.draft);
  const setStep = useOnboardingStore((s) => s.setStep);
  const reset = useOnboardingStore((s) => s.reset);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);

  // Prevent SSR/CSR mismatch — sessionStorage isn't available during SSR.
  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <ProgressBar step={1} />
        <div className="h-64 rounded-xl bg-white border border-hh-gray-light animate-pulse" />
      </div>
    );
  }

  const onNext = () => {
    setError(null);
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
      return;
    }
    // Final submit — re-validate everything before hitting the action.
    const parsed = onboardingSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please complete every question.");
      return;
    }
    startTransition(async () => {
      const result = await completeOnboarding(parsed.data);
      // On success the action redirects, so we'd only reach this branch on error.
      if (result && !result.ok) {
        setError(result.error ?? "Something went wrong saving your answers.");
      } else {
        reset();
      }
    });
  };

  const onBack = () => {
    setError(null);
    if (step > 1) setStep(step - 1);
  };

  const advanceable = canAdvance(step, draft);
  const isLast = step === TOTAL_STEPS;

  return (
    <div className="space-y-6">
      <ProgressBar step={step} />

      <div className="rounded-2xl border border-hh-gray-light bg-white shadow-sm p-6 md:p-8">
        {step === 1 && <StepCuisines />}
        {step === 2 && <StepAllergiesAndDiet />}
        {step === 3 && <StepBudget />}
        {step === 4 && <StepRadius />}
        {step === 5 && <StepPersonality />}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-hh-danger/40 bg-red-50 px-3 py-2 text-sm text-hh-danger"
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={onBack}
          disabled={step === 1 || isPending}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <span className="text-xs text-hh-gray hidden sm:block">
          Step {step} of {TOTAL_STEPS} · {STEP_KEYS[step - 1]}
        </span>
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={onNext}
          disabled={!advanceable || isPending}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isLast ? (
            <Sparkles className="h-4 w-4" />
          ) : null}
          {isLast ? "All set — let's go" : "Next"}
          {!isLast && !isPending && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
