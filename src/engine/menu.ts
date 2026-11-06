import { nutrientsFor, sumNutrients } from '../data/foods';
import {
  RECIPES,
  recipeAllergens,
  recipeIsKosherCompatible,
  recipeIsVegan,
  recipeIsVegetarian,
  type Recipe,
  type Slot,
} from '../data/recipes';
import type { Nutrients, Profile } from './types';

export interface PlannedMeal {
  slot: Slot;
  recipeId: string;
  scale: number; // portion multiplier
  nutrients: Nutrients;
}

export interface DayPlan {
  date: string;
  meals: PlannedMeal[];
  totals: Nutrients;
  deviation: { kcalPct: number; proteinPct: number };
  withinTolerance: boolean;
}

export interface MenuTargets {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export const SLOT_LABEL: Record<Slot, string> = { breakfast: 'ארוחת בוקר', lunch: 'ארוחת צהריים', dinner: 'ארוחת ערב', snack: 'ביניים' };
const SCALES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
export const TOLERANCE = 0.05;

export function slotsFor(mealsPerDay: number): Slot[] {
  if (mealsPerDay <= 3) return ['breakfast', 'lunch', 'dinner'];
  if (mealsPerDay === 4) return ['breakfast', 'lunch', 'snack', 'dinner'];
  return ['breakfast', 'snack', 'lunch', 'snack', 'dinner'];
}

export function recipeNutrients(r: Recipe, scale = 1): Nutrients {
  return sumNutrients(r.items.map((i) => nutrientsFor(i.foodId, i.grams * scale)));
}

export function eligibleRecipes(p: Pick<Profile, 'diet' | 'allergies' | 'kosher' | 'maxPrepMinutes' | 'dislikes'>, excluded: string[] = []): Recipe[] {
  return RECIPES.filter((r) => {
    if (excluded.includes(r.id)) return false;
    if (p.diet === 'vegan' && !recipeIsVegan(r)) return false;
    if (p.diet === 'vegetarian' && !recipeIsVegetarian(r)) return false;
    if (p.kosher && !recipeIsKosherCompatible(r)) return false;
    const al = recipeAllergens(r);
    if (p.allergies.some((a) => al.includes(a))) return false; // allergy = hard exclusion
    if (r.prepMinutes > p.maxPrepMinutes) return false;
    if (p.dislikes.some((d) => d && r.name.includes(d))) return false;
    return true;
  });
}

function score(t: Nutrients, target: MenuTargets): number {
  const e = (a: number, b: number) => (b > 0 ? (a - b) / b : 0);
  return e(t.kcal, target.kcal) ** 2 * 1.0 + e(t.protein, target.protein) ** 2 * 1.5 + e(t.fat, target.fat) ** 2 * 0.3 + e(t.carbs, target.carbs) ** 2 * 0.3;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Optimise portion scales for a fixed set of recipes (coordinate descent over the discrete scale grid). */
function optimiseScales(recipes: Recipe[], target: MenuTargets): { scales: number[]; totals: Nutrients; s: number } {
  const base = recipes.map((r) => recipeNutrients(r, 1));
  let scales = recipes.map(() => 1);
  const total = (sc: number[]) => sumNutrients(base.map((n, i) => ({ kcal: n.kcal * sc[i], protein: n.protein * sc[i], fat: n.fat * sc[i], carbs: n.carbs * sc[i], fiber: n.fiber * sc[i] })));
  let best = score(total(scales), target);
  for (let iter = 0; iter < 6; iter++) {
    let improved = false;
    for (let i = 0; i < scales.length; i++) {
      for (const s of SCALES) {
        const trial = scales.slice();
        trial[i] = s;
        const v = score(total(trial), target);
        if (v < best - 1e-9) {
          best = v;
          scales = trial;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return { scales, totals: total(scales), s: best };
}

export function planDay(args: {
  date: string;
  profile: Pick<Profile, 'diet' | 'allergies' | 'kosher' | 'maxPrepMinutes' | 'dislikes' | 'mealsPerDay'>;
  target: MenuTargets;
  avoid?: string[]; // recipes used yesterday
  fixed?: Partial<Record<number, string>>; // slot index -> recipe forced by the user
}): DayPlan {
  const slots = slotsFor(args.profile.mealsPerDay);
  const pool = eligibleRecipes(args.profile);
  const seed = hash(args.date);
  const chosen: Recipe[] = [];
  slots.forEach((slot, idx) => {
    const forced = args.fixed?.[idx];
    if (forced) {
      const r = pool.find((x) => x.id === forced) ?? RECIPES.find((x) => x.id === forced);
      if (r) return chosen.push(r);
    }
    let cands = pool.filter((r) => r.slots.includes(slot) && !chosen.includes(r));
    const fresh = cands.filter((r) => !(args.avoid ?? []).includes(r.id));
    if (fresh.length) cands = fresh;
    if (!cands.length) cands = pool.filter((r) => r.slots.includes(slot));
    if (!cands.length) return;
    chosen.push(cands[(seed + idx * 7) % cands.length]);
  });

  let { scales, totals, s } = optimiseScales(chosen, args.target);
  // Local search: try swapping each non-fixed slot for another candidate if it improves the fit.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < chosen.length; i++) {
      if (args.fixed?.[i]) continue;
      const slot = slots[i];
      for (const alt of pool.filter((r) => r.slots.includes(slot) && !chosen.includes(r))) {
        const trial = chosen.slice();
        trial[i] = alt;
        const o = optimiseScales(trial, args.target);
        if (o.s < s - 1e-6) {
          chosen[i] = alt;
          ({ scales, totals, s } = o);
        }
      }
    }
  }

  const meals: PlannedMeal[] = chosen.map((r, i) => ({ slot: slots[i], recipeId: r.id, scale: scales[i], nutrients: recipeNutrients(r, scales[i]) }));
  const kcalPct = (totals.kcal - args.target.kcal) / args.target.kcal;
  const proteinPct = (totals.protein - args.target.protein) / args.target.protein;
  return {
    date: args.date,
    meals,
    totals,
    deviation: { kcalPct, proteinPct },
    withinTolerance: Math.abs(kcalPct) <= TOLERANCE && Math.abs(proteinPct) <= TOLERANCE * 2,
  };
}

/** Three alternatives for one meal that keep the day on target (spec: "החלפת מנה"). */
export function alternativesFor(plan: DayPlan, mealIndex: number, args: { profile: Parameters<typeof planDay>[0]['profile']; target: MenuTargets }) {
  const meal = plan.meals[mealIndex];
  const pool = eligibleRecipes(args.profile).filter((r) => r.slots.includes(meal.slot) && r.id !== meal.recipeId);
  const others = plan.meals.filter((_, i) => i !== mealIndex);
  const rest = sumNutrients(others.map((m) => m.nutrients));
  const need: MenuTargets = {
    kcal: Math.max(args.target.kcal - rest.kcal, 100),
    protein: Math.max(args.target.protein - rest.protein, 5),
    fat: Math.max(args.target.fat - rest.fat, 3),
    carbs: Math.max(args.target.carbs - rest.carbs, 5),
  };
  return pool
    .map((r) => {
      const o = optimiseScales([r], need);
      return { recipe: r, scale: o.scales[0], nutrients: o.totals, s: o.s };
    })
    .sort((a, b) => a.s - b.s)
    .slice(0, 3);
}

/** Re-balance the rest of the day after the user ate something else (spec: "אכלתי משהו אחר"). */
export function remainingTargets(target: MenuTargets, eaten: Nutrients): MenuTargets {
  return {
    kcal: Math.max(target.kcal - eaten.kcal, 0),
    protein: Math.max(target.protein - eaten.protein, 0),
    fat: Math.max(target.fat - eaten.fat, 0),
    carbs: Math.max(target.carbs - eaten.carbs, 0),
  };
}

export function shoppingList(plans: DayPlan[]): { foodId: string; grams: number }[] {
  const map = new Map<string, number>();
  for (const d of plans)
    for (const m of d.meals) {
      const r = RECIPES.find((x) => x.id === m.recipeId);
      if (!r) continue;
      for (const it of r.items) map.set(it.foodId, (map.get(it.foodId) ?? 0) + it.grams * m.scale);
    }
  return [...map.entries()].map(([foodId, grams]) => ({ foodId, grams: Math.round(grams) })).sort((a, b) => b.grams - a.grams);
}
