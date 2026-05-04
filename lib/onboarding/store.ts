/**
 * Onboarding Zustand store. Persists to sessionStorage so a refresh mid-flow
 * doesn't wipe answers. Cleared on successful submit.
 */
"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { OnboardingValues } from "@/lib/onboarding/schema";

export type OnboardingDraft = Partial<OnboardingValues>;

interface OnboardingState {
  step: number; // 1..5
  draft: OnboardingDraft;
  setStep: (n: number) => void;
  patch: (patch: OnboardingDraft) => void;
  reset: () => void;
}

const initialDraft: OnboardingDraft = {
  cuisines: [],
  allergies: [],
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      step: 1,
      draft: initialDraft,
      setStep: (n) => set({ step: n }),
      patch: (patch) =>
        set((state) => ({ draft: { ...state.draft, ...patch } })),
      reset: () => set({ step: 1, draft: initialDraft }),
    }),
    {
      name: "hh.onboarding",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? // SSR no-op
            ({
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            } as unknown as Storage)
          : window.sessionStorage,
      ),
    },
  ),
);
