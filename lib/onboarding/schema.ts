/**
 * Onboarding Zod schema. Brief §6 — five questions:
 *   Q1 cuisines, Q2 allergies + diet, Q3 monthly budget,
 *   Q4 delivery radius, Q5 food personality.
 *
 * Single source of truth for client validation, server-action validation,
 * and the Zustand store shape.
 */
import { z } from "zod";
import {
  ALLERGENS,
  BUDGET_BANDS,
  CUISINES,
  DIETS,
  PERSONALITIES,
  RADIUS_OPTIONS,
} from "@/lib/constants";

const cuisineEnum = z.enum(CUISINES);
const allergenEnum = z.enum(ALLERGENS);
const dietEnum = z.enum(DIETS);
const personalityEnum = z.enum(
  PERSONALITIES.map((p) => p.id) as [string, ...string[]],
);

/** Budget can be any of the band integers, or `null` (no limit). */
const budgetSchema = z
  .number()
  .int()
  .nullable()
  .refine(
    (v) => v === null || (BUDGET_BANDS as readonly (number | null)[]).includes(v),
    { message: "Pick one of the budget options." },
  );

/** Radius must be one of 2 / 5 / 10 / 50 km. */
const radiusSchema = z
  .number()
  .int()
  .refine((v) => (RADIUS_OPTIONS as readonly number[]).includes(v), {
    message: "Pick a radius.",
  });

export const onboardingSchema = z.object({
  cuisines: z.array(cuisineEnum).min(1, "Pick at least one cuisine you love."),
  allergies: z.array(allergenEnum), // can be empty (= "None")
  diet: dietEnum,
  monthlyBudget: budgetSchema,
  deliveryRadiusKm: radiusSchema,
  personality: personalityEnum,
});

export type OnboardingValues = z.infer<typeof onboardingSchema>;

/** Per-step partial schemas for client-side step validation. */
export const stepSchemas = {
  cuisines: onboardingSchema.pick({ cuisines: true }),
  allergiesAndDiet: onboardingSchema.pick({ allergies: true, diet: true }),
  budget: onboardingSchema.pick({ monthlyBudget: true }),
  radius: onboardingSchema.pick({ deliveryRadiusKm: true }),
  personality: onboardingSchema.pick({ personality: true }),
} as const;

export const TOTAL_STEPS = 5;
