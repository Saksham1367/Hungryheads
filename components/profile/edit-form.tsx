"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Chip,
  SelectableCard,
} from "@/components/onboarding/question-card";
import {
  ALLERGENS,
  BUDGET_BANDS,
  CUISINES,
  DIETS,
  PERSONALITIES,
  RADIUS_OPTIONS,
} from "@/lib/constants";
import { formatRupees } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { updateProfile } from "@/app/(app)/profile/actions";
import type { OnboardingValues } from "@/lib/onboarding/schema";

export interface ProfileInitialValues {
  cuisines: string[];
  allergies: string[];
  diet: string | null;
  monthlyBudget: number | null;
  deliveryRadiusKm: number;
  personality: string | null;
}

export function ProfileEditForm({
  initial,
  email,
  fullName,
}: {
  initial: ProfileInitialValues;
  email: string;
  fullName: string;
}) {
  const router = useRouter();
  const [cuisines, setCuisines] = useState<string[]>(initial.cuisines);
  const [allergies, setAllergies] = useState<string[]>(initial.allergies);
  const [diet, setDiet] = useState<string | null>(initial.diet);
  const [budget, setBudget] = useState<number | null>(initial.monthlyBudget);
  const [radius, setRadius] = useState<number>(initial.deliveryRadiusKm);
  const [personality, setPersonality] = useState<string | null>(
    initial.personality,
  );

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty =
    !sameSet(cuisines, initial.cuisines) ||
    !sameSet(allergies, initial.allergies) ||
    diet !== initial.diet ||
    budget !== initial.monthlyBudget ||
    radius !== initial.deliveryRadiusKm ||
    personality !== initial.personality;

  const onToggleCuisine = (c: string) => {
    setCuisines((prev) =>
      prev.includes(c)
        ? prev.filter((x) => x !== c)
        : CUISINES.filter((x) => prev.includes(x) || x === c),
    );
  };

  const onToggleAllergy = (a: string) => {
    setAllergies((prev) =>
      prev.includes(a)
        ? prev.filter((x) => x !== a)
        : ALLERGENS.filter((x) => prev.includes(x) || x === a),
    );
  };

  const onSave = async () => {
    setError(null);
    if (cuisines.length === 0) {
      setError("Pick at least one cuisine you love.");
      return;
    }
    if (!diet) {
      setError("Pick a diet preference.");
      return;
    }
    if (!personality) {
      setError("Pick a food personality.");
      return;
    }
    if (budget === undefined) {
      setError("Pick a monthly budget.");
      return;
    }

    const values: OnboardingValues = {
      cuisines: cuisines as OnboardingValues["cuisines"],
      allergies: allergies as OnboardingValues["allergies"],
      diet: diet as OnboardingValues["diet"],
      monthlyBudget: budget ?? null,
      deliveryRadiusKm: radius as OnboardingValues["deliveryRadiusKm"],
      personality: personality as OnboardingValues["personality"],
    };

    setPending(true);
    try {
      const result = await updateProfile(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    } catch (err) {
      console.error("[ProfileEditForm] threw:", err);
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Identity (read-only) */}
      <div className="rounded-2xl border border-hh-gray-light bg-white p-5 flex items-center gap-4">
        <span className="h-12 w-12 rounded-full bg-gradient-to-br from-hh-orange to-hh-orange-dark text-white text-lg font-bold flex items-center justify-center shrink-0">
          {fullName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="font-display font-bold text-hh-black">{fullName}</div>
          <div className="text-xs text-hh-gray truncate">{email}</div>
        </div>
      </div>

      {/* Cuisines */}
      <Field label="What do you love eating?" hint="Multi-select">
        <div className="flex flex-wrap gap-2">
          {CUISINES.map((c) => (
            <Chip
              key={c}
              selected={cuisines.includes(c)}
              onToggle={() => onToggleCuisine(c)}
            >
              {c}
            </Chip>
          ))}
        </div>
      </Field>

      {/* Allergies */}
      <Field
        label="Allergies"
        hint={
          allergies.length === 0
            ? "None on file"
            : `${allergies.length} flagged`
        }
      >
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map((a) => (
            <Chip
              key={a}
              selected={allergies.includes(a)}
              onToggle={() => onToggleAllergy(a)}
            >
              {a}
            </Chip>
          ))}
          <Chip
            selected={allergies.length === 0}
            onToggle={() => setAllergies([])}
          >
            None
          </Chip>
        </div>
        {allergies.length > 0 && (
          <div className="mt-2 inline-flex items-start gap-1.5 text-[11px] text-hh-orange-dark">
            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
            <span>
              SafePlate blocks orders containing these. Update with care.
            </span>
          </div>
        )}
      </Field>

      {/* Diet */}
      <Field label="Diet preference">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DIETS.map((d) => (
            <SelectableCard
              key={d}
              selected={diet === d}
              onSelect={() => setDiet(d)}
              className="text-center text-sm font-medium"
            >
              {d}
            </SelectableCard>
          ))}
        </div>
      </Field>

      {/* Budget */}
      <Field
        label="Monthly food budget"
        hint={budget === null ? "No cap" : `~${formatRupees(budget)}/month`}
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {BUDGET_BANDS.map((band) => {
            const selected = budget === band;
            return (
              <SelectableCard
                key={String(band)}
                selected={selected}
                onSelect={() => setBudget(band)}
                className={cn("text-center py-4", selected && "bg-hh-orange-light/30")}
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
      </Field>

      {/* Radius */}
      <Field
        label="Delivery radius"
        hint={radius >= 50 ? "Anywhere" : `${radius} km`}
      >
        <div className="grid grid-cols-4 gap-2">
          {RADIUS_OPTIONS.map((km) => (
            <SelectableCard
              key={km}
              selected={radius === km}
              onSelect={() => setRadius(km)}
              className="text-center py-3 text-sm font-semibold tabular"
            >
              {km >= 50 ? "Anywhere" : `${km} km`}
            </SelectableCard>
          ))}
        </div>
      </Field>

      {/* Personality */}
      <Field label="Food personality">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PERSONALITIES.map((p) => (
            <SelectableCard
              key={p.id}
              selected={personality === p.id}
              onSelect={() => setPersonality(p.id)}
              className={cn(
                "py-4 px-4",
                personality === p.id && "bg-hh-orange-light/30",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0 select-none">{p.emoji}</span>
                <div>
                  <div className="font-display font-bold text-hh-black">
                    {p.label}
                  </div>
                  <div className="text-xs text-hh-gray">{p.blurb}</div>
                </div>
              </div>
            </SelectableCard>
          ))}
        </div>
      </Field>

      {/* Save bar */}
      <div className="sticky bottom-3 z-10">
        <div className="rounded-2xl border border-hh-gray-light bg-white shadow-lg p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            {savedAt ? (
              <div className="inline-flex items-center gap-1.5 text-sm text-hh-success">
                <Check className="h-4 w-4" />
                Saved.
              </div>
            ) : dirty ? (
              <div className="text-sm text-hh-charcoal">Unsaved changes.</div>
            ) : (
              <div className="text-sm text-hh-gray">All up to date.</div>
            )}
            {error && (
              <p className="text-xs text-hh-danger mt-1" role="alert">
                {error}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={onSave}
            disabled={pending || !dirty}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base font-bold text-hh-black">
          {label}
        </h2>
        {hint && <span className="text-xs text-hh-gray">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((x) => set.has(x));
}
