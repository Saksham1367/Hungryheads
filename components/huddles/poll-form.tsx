"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/onboarding/question-card";
import { CUISINES, RADIUS_OPTIONS } from "@/lib/constants";
import { submitPollResponse } from "@/app/(app)/dashboard/huddle-actions";
import { cn } from "@/lib/utils/cn";

const MOODS = [
  { id: "light", label: "Light" },
  { id: "heavy", label: "Heavy" },
  { id: "spicy", label: "Spicy" },
  { id: "sweet", label: "Sweet" },
  { id: "try-something-new", label: "Try something new" },
] as const;

type Mood = (typeof MOODS)[number]["id"];
type VegPref = "veg" | "non-veg" | "either";

export function PollForm({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const [cuisines, setCuisines] = useState<string[]>([]);
  const [mood, setMood] = useState<Mood | null>(null);
  const [veg, setVeg] = useState<VegPref>("either");
  const [budget, setBudget] = useState<number | null>(400);
  const [radius, setRadius] = useState<number>(5);
  const [error, setError] = useState<string | null>(null);

  const toggleCuisine = (c: string) => {
    setCuisines((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  };

  const onSubmit = async () => {
    setError(null);
    if (cuisines.length === 0) {
      setError("Pick at least one cuisine vibe.");
      return;
    }
    setPending(true);
    try {
      const result = await submitPollResponse(sessionId, {
        cuisines: cuisines as never,
        mood,
        veg_only: veg === "veg" ? true : veg === "non-veg" ? false : null,
        budget,
        max_distance: radius,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch (err) {
      console.error("submitPollResponse threw:", err);
      setError(
        err instanceof Error ? err.message : "Couldn't submit your vote.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-hh-gray-light bg-white p-6 space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold text-hh-black">
          Your vote
        </h2>
        <p className="text-sm text-hh-charcoal mt-0.5">
          Quick 5-question poll. The agent merges everyone&apos;s answers,
          respects allergies, and picks the top 3.
        </p>
      </div>

      {/* Cuisines */}
      <Field label="What's the vibe?" hint="Pick all that fit">
        <div className="flex flex-wrap gap-2">
          {CUISINES.map((c) => (
            <Chip
              key={c}
              selected={cuisines.includes(c)}
              onToggle={() => toggleCuisine(c)}
            >
              {c}
            </Chip>
          ))}
        </div>
      </Field>

      {/* Mood */}
      <Field label="Mood">
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <Chip
              key={m.id}
              selected={mood === m.id}
              onToggle={() => setMood(mood === m.id ? null : m.id)}
            >
              {m.label}
            </Chip>
          ))}
        </div>
      </Field>

      {/* Veg pref */}
      <Field label="Veg / non-veg">
        <div className="grid grid-cols-3 gap-2">
          {(["veg", "non-veg", "either"] as VegPref[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVeg(v)}
              className={cn(
                "rounded-xl border px-4 py-2.5 text-sm font-medium capitalize transition-colors",
                veg === v
                  ? "border-hh-orange bg-hh-orange-light/40 text-hh-orange-dark"
                  : "border-hh-gray-light bg-white text-hh-charcoal hover:border-hh-orange/60",
              )}
            >
              {v === "non-veg" ? "Non-veg" : v}
            </button>
          ))}
        </div>
      </Field>

      {/* Budget per person */}
      <Field
        label="Budget per person"
        hint={
          budget === null
            ? "No cap"
            : `~₹${budget.toLocaleString("en-IN")} each`
        }
      >
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[150, 250, 400, 600, 1000].map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBudget(b)}
              className={cn(
                "rounded-xl border px-2 py-2 text-sm font-semibold tabular transition-colors",
                budget === b
                  ? "border-hh-orange bg-hh-orange-light/40 text-hh-orange-dark"
                  : "border-hh-gray-light bg-white text-hh-charcoal hover:border-hh-orange/60",
              )}
            >
              ₹{b}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setBudget(null)}
            className={cn(
              "rounded-xl border px-2 py-2 text-sm font-semibold transition-colors",
              budget === null
                ? "border-hh-orange bg-hh-orange-light/40 text-hh-orange-dark"
                : "border-hh-gray-light bg-white text-hh-charcoal hover:border-hh-orange/60",
            )}
          >
            Open
          </button>
        </div>
      </Field>

      {/* Radius */}
      <Field
        label="How far will you go?"
        hint={radius >= 50 ? "Anywhere" : `${radius} km`}
      >
        <div className="grid grid-cols-4 gap-2">
          {RADIUS_OPTIONS.map((km) => (
            <button
              key={km}
              type="button"
              onClick={() => setRadius(km)}
              className={cn(
                "rounded-xl border px-2 py-2.5 text-sm font-semibold transition-colors",
                radius === km
                  ? "border-hh-orange bg-hh-orange-light/40 text-hh-orange-dark"
                  : "border-hh-gray-light bg-white text-hh-charcoal hover:border-hh-orange/60",
              )}
            >
              {km >= 50 ? "Anywhere" : `${km} km`}
            </button>
          ))}
        </div>
      </Field>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-hh-danger/40 bg-red-50 px-3 py-2 text-sm text-hh-danger"
        >
          {error}
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={onSubmit}
          disabled={pending}
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit my vote
        </Button>
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
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-hh-charcoal">{label}</span>
        {hint && <span className="text-xs text-hh-gray">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

