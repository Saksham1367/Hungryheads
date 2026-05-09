/**
 * Huddle decision engine — the constraint solver behind FoodHuddle (brief §2.4).
 *
 * Inputs:
 *   - Each member's allergies + diet (HARD constraints)
 *   - Each member's poll response (soft preferences)
 *   - The fixture restaurant + menu universe (Step 7)
 *
 * Output: top 3 ranked restaurants with reasoning, ready to insert into
 * huddle_recommendations.
 *
 * Hard constraints (any failure → restaurant rejected):
 *   1. Restaurant must have ≥1 menu item with NONE of the union of all
 *      members' allergens.
 *   2. If ANY member is vegetarian, the restaurant must have ≥1 veg item.
 *
 * Soft scoring (higher = better):
 *   - Rating × 10
 *   - Cuisine vote share × 30
 *   - Distance fit (penalty when farther than median budget)
 *   - Per-person budget fit (penalty when cost_for_two > 2 × avg budget)
 */
import {
  searchRestaurants,
  type MockMenuItem,
  type MockRestaurant,
} from "@/lib/swiggy/mock";
import menus from "@/fixtures/mcp/menus.json";

export interface MemberConstraints {
  user_id: string;
  allergens: string[]; // lowercase
  is_veg: boolean;
}

export interface PollResponseLite {
  user_id: string;
  cuisines: string[];
  veg_only: boolean | null;
  budget: number | null;
  max_distance: number | null;
  mood: string | null;
}

export interface RankedPick {
  rank: number; // 1..3
  swiggy_id: string;
  name: string;
  cuisines: string[];
  rating: number;
  distance_km: number;
  reasoning: string;
  raw: MockRestaurant;
}

// Cap the recommendations at the brief's hero count.
const TOP_N = 3;

const menusById = menus as Record<string, MockMenuItem[]>;

export function decide(
  members: MemberConstraints[],
  responses: PollResponseLite[],
): RankedPick[] {
  // 1. Aggregate constraints + preferences.
  const allAllergens = uniqueLower(
    members.flatMap((m) => m.allergens),
  );
  const anyVeg = members.some((m) => m.is_veg) || responses.some((r) => r.veg_only);
  const cuisineVotes = new Map<string, number>();
  const totalMembers = members.length || 1;
  let budgetSum = 0;
  let budgetCount = 0;
  let maxDistance = 50;
  for (const r of responses) {
    for (const c of r.cuisines ?? []) {
      const k = c.toLowerCase();
      cuisineVotes.set(k, (cuisineVotes.get(k) ?? 0) + 1);
    }
    if (r.budget != null) {
      budgetSum += r.budget;
      budgetCount += 1;
    }
    if (r.max_distance != null) {
      maxDistance = Math.min(maxDistance, r.max_distance);
    }
  }
  const avgBudget = budgetCount > 0 ? budgetSum / budgetCount : 400;

  // 2. Pull the WHOLE restaurant universe up front. Cuisine votes and
  //    distance become *score* nudges below — not hard filters — so we don't
  //    accidentally land with only 1 candidate just because one member voted
  //    a niche cuisine. The only hard filter is the allergen + diet safety
  //    check, which the brief mandates.
  const safetyFilter = (r: MockRestaurant): boolean => {
    const items = menusById[r.id] ?? [];
    const safeItems = items.filter((it) =>
      it.allergen_tags.every(
        (tag) => !allAllergens.includes(tag.toLowerCase()),
      ),
    );
    if (safeItems.length === 0) return false;
    if (anyVeg && !safeItems.some((it) => it.is_veg)) return false;
    return true;
  };

  const universe = searchRestaurants({ limit: 50 });
  const safeCandidates = universe.filter(safetyFilter);

  // 4. Score remaining candidates.
  const scored = safeCandidates.map((r) => {
    let score = r.rating * 10;
    // Cuisine vote share — restaurant gets bonus per cuisine that matches a vote.
    let cuisineBonus = 0;
    for (const c of r.cuisines) {
      const votes = cuisineVotes.get(c.toLowerCase()) ?? 0;
      cuisineBonus += (votes / totalMembers) * 30;
    }
    score += cuisineBonus;
    // Distance fit
    if (r.distance_km > maxDistance) score -= 50;
    else score -= r.distance_km * 1.5;
    // Budget fit — soft penalty if cost_for_two way above avg per-person × 2
    const targetCostForTwo = avgBudget * 2;
    if (r.cost_for_two > targetCostForTwo * 1.5) score -= 25;
    else if (r.cost_for_two > targetCostForTwo) score -= 10;
    return { restaurant: r, score, cuisineBonus };
  });

  scored.sort((a, b) => b.score - a.score);

  // 5. Pick top N + generate reasoning per pick.
  return scored.slice(0, TOP_N).map((s, i) => {
    const r = s.restaurant;
    const matchedCuisines = r.cuisines.filter((c) =>
      cuisineVotes.has(c.toLowerCase()),
    );
    const reasoning = buildReasoning(r, {
      rank: i + 1,
      matchedCuisines,
      allAllergens,
      anyVeg,
      avgBudget,
      maxDistance,
    });
    return {
      rank: i + 1,
      swiggy_id: r.id,
      name: r.name,
      cuisines: r.cuisines,
      rating: r.rating,
      distance_km: r.distance_km,
      reasoning,
      raw: r,
    };
  });
}

function buildReasoning(
  r: MockRestaurant,
  ctx: {
    rank: number;
    matchedCuisines: string[];
    allAllergens: string[];
    anyVeg: boolean;
    avgBudget: number;
    maxDistance: number;
  },
): string {
  const parts: string[] = [];
  if (ctx.matchedCuisines.length > 0) {
    parts.push(
      `${ctx.matchedCuisines.slice(0, 2).join(" + ")} matches the group's vote`,
    );
  }
  if (ctx.allAllergens.length > 0) {
    parts.push(
      `safe for ${ctx.allAllergens.slice(0, 3).join("/")}-allergic members`,
    );
  }
  if (ctx.anyVeg) {
    parts.push("has solid veg options");
  }
  if (r.cost_for_two <= ctx.avgBudget * 2) {
    parts.push(
      `fits the ~₹${Math.round(ctx.avgBudget)}/person budget`,
    );
  }
  parts.push(`${r.rating.toFixed(1)}★, ${r.distance_km}km`);
  return parts.join(" · ");
}

function uniqueLower(strings: string[]): string[] {
  const set = new Set<string>();
  for (const s of strings) set.add(s.trim().toLowerCase());
  return Array.from(set);
}
