import { FOOD_BY_ID, nutrientsFor, sumNutrients } from '../data/foods';
import {
  RECIPES,
  recipeAllergens,
  recipeIsKosherCompatible,
  recipeIsVegan,
  recipeIsVegetarian,
  type Recipe,
  type RecipeItem,
  type Slot,
} from '../data/recipes';
import type { Nutrients, Profile } from './types';

/**
 * Menu engine.
 * 1. Each meal slot gets a share of the day (breakfast/lunch/dinner/snacks).
 * 2. For every candidate recipe, portions are adjusted per ingredient (not "double the whole dish"):
 *    protein, carb and fat components move within realistic bounds, vegetables stay generous,
 *    sauces stay fixed. Amounts are rounded to kitchen units (whole eggs, slices, 5 g steps).
 * 3. The recipe that fits best is chosen, with variety (no repeats from yesterday) and the
 *    user's learned preferences as tie-breakers.
 * 4. A final day-level pass closes the remaining gap.
 */

export interface PlannedMeal {
  slot: Slot;
  /** Meal around a workout (training days only). */
  role?: 'pre' | 'post';
  recipeId: string;
  items: RecipeItem[]; // personalised grams
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

export type MenuProfile = Pick<Profile, 'diet' | 'allergies' | 'kosher' | 'maxPrepMinutes' | 'dislikes' | 'mealsPerDay'>;

export const SLOT_LABEL: Record<Slot, string> = { breakfast: 'ארוחת בוקר', lunch: 'ארוחת צהריים', dinner: 'ארוחת ערב', snack: 'ביניים' };
export const TOLERANCE = 0.05;
const SHARE: Record<Slot, number> = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };

export function slotsFor(mealsPerDay: number): Slot[] {
  if (mealsPerDay <= 3) return ['breakfast', 'lunch', 'dinner'];
  if (mealsPerDay === 4) return ['breakfast', 'lunch', 'snack', 'dinner'];
  return ['breakfast', 'snack', 'lunch', 'snack', 'dinner'];
}

/** Meals around a workout: index of the meal before and after training on this day. */
export interface WorkoutWindow {
  pre: number | null;
  post: number | null;
}

/**
 * Splits the day's targets between meals. Around a workout (ISSN nutrient timing, Kerksick 2017;
 * ACSM/AND/DC 2016): the meal before training gets more carbohydrate and less fat (fat slows
 * digestion), the meal after training gets more protein (~0.3-0.4 g/kg) and carbohydrate to refill
 * glycogen. Each macro is renormalised so the day's totals do not change.
 */
function slotTargets(slots: Slot[], t: MenuTargets, w?: WorkoutWindow): MenuTargets[] {
  const weight = (i: number, macro: 'protein' | 'carbs' | 'fat') => {
    let k = SHARE[slots[i]];
    if (w?.pre === i) k *= macro === 'carbs' ? 1.35 : macro === 'fat' ? 0.55 : 1;
    if (w?.post === i) k *= macro === 'protein' ? 1.45 : macro === 'carbs' ? 1.3 : macro === 'fat' ? 0.8 : 1;
    return k;
  };
  const totals = { protein: 0, carbs: 0, fat: 0 };
  slots.forEach((_, i) => (['protein', 'carbs', 'fat'] as const).forEach((m) => (totals[m] += weight(i, m))));
  return slots.map((_, i) => {
    const protein = (t.protein * weight(i, 'protein')) / totals.protein;
    const carbs = (t.carbs * weight(i, 'carbs')) / totals.carbs;
    const fat = (t.fat * weight(i, 'fat')) / totals.fat;
    return { kcal: protein * 4 + carbs * 4 + fat * 9, protein, fat, carbs };
  });
}

export function itemsNutrients(items: RecipeItem[]): Nutrients {
  return sumNutrients(items.map((i) => nutrientsFor(i.foodId, i.grams)));
}

export function recipeNutrients(r: Recipe): Nutrients {
  return itemsNutrients(r.items);
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
    const dislikes = p.dislikes.filter((d) => d && d.trim().length > 1);
    if (dislikes.some((d) => r.name.includes(d.trim()) || r.items.some((i) => FOOD_BY_ID[i.foodId]?.name.includes(d.trim())))) return false;
    return true;
  });
}

/* ---------- portion adjustment ---------- */

const BOUNDS: Record<string, [number, number]> = { protein: [0.6, 2.8], carb: [0.35, 2.8], fat: [0.3, 2.2], veg: [0.8, 2.0], other: [1, 1] };

function stepFor(foodId: string): number {
  const f = FOOD_BY_ID[foodId];
  if (!f) return 5;
  const unit = f.units.find((u) => /יחידה|פרוסה|עיגול/.test(u.label) && u.grams >= 15 && u.grams <= 130);
  if (unit && ['protein', 'grain', 'fruit', 'dish', 'snack'].includes(f.category) && !/גרגירי|אורז|קינואה|פסטה|קוסקוס/.test(f.name)) {
    // countable food: whole units for eggs, half units otherwise
    return f.name.includes('ביצה') ? unit.grams : unit.grams / 2;
  }
  if (f.per100g.kcal >= 500) return 2.5; // oils, nuts, tahini: fine steps
  return 5;
}

interface Score {
  s: number;
  n: Nutrients;
}

function evaluate(items: RecipeItem[], base: RecipeItem[], t: MenuTargets): Score {
  const n = itemsNutrients(items);
  const e = (a: number, b: number) => (b > 0 ? (a - b) / b : 0);
  let reg = 0;
  items.forEach((it, i) => {
    if (base[i].grams > 0) reg += Math.log(Math.max(it.grams, 1) / base[i].grams) ** 2;
  });
  const s = e(n.kcal, t.kcal) ** 2 * 1.0 + e(n.protein, t.protein) ** 2 * 1.2 + e(n.fat, t.fat) ** 2 * 0.25 + e(n.carbs, t.carbs) ** 2 * 0.25 + reg * 0.004;
  return { s, n };
}

/** Adjusts ingredient grams of one recipe toward a meal target. Deterministic. */
export function fitRecipe(r: Recipe, t: MenuTargets): { items: RecipeItem[]; nutrients: Nutrients; s: number } {
  const base = r.items;
  let items = base.map((i) => ({ ...i, grams: roundTo(i.grams, stepFor(i.foodId)) }));
  let best = evaluate(items, base, t);
  const bounds = base.map((i) => {
    const role = FOOD_BY_ID[i.foodId]?.role ?? 'other';
    const [lo, hi] = BOUNDS[role] ?? BOUNDS.other;
    return [i.grams * lo, Math.max(i.grams, Math.min(i.grams * hi, portionCap(i.foodId)))] as const;
  });
  for (let iter = 0; iter < 40; iter++) {
    let improved = false;
    for (let i = 0; i < items.length; i++) {
      const [lo, hi] = bounds[i];
      if (lo === hi) continue;
      const step = stepFor(items[i].foodId);
      for (const k of [-4, -2, -1, 1, 2, 4]) {
        const g = roundTo(items[i].grams + k * step, step);
        if (g < lo - 1e-9 || g > hi + 1e-9 || g <= 0) continue;
        const trial = items.slice();
        trial[i] = { ...trial[i], grams: g };
        const v = evaluate(trial, base, t);
        if (v.s < best.s - 1e-9) {
          best = v;
          items = trial;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return { items, nutrients: best.n, s: best.s };
}

/** Realistic upper limit for one portion of a food in one meal (grams). */
function portionCap(foodId: string): number {
  const f = FOOD_BY_ID[foodId];
  if (!f) return 400;
  if (f.per100g.kcal >= 500) return f.category === 'fat' && f.name.includes('שמן') ? 20 : 45; // oils, nuts, tahini, chocolate
  if (/לחם|פיתה|בייגל|טורטיה|חלה/.test(f.name)) return 130;
  if (f.category === 'dairy' || f.category === 'drink') return 350;
  if (f.category === 'protein' || f.role === 'protein') return f.name.includes('ביצה') ? 200 : 260;
  if (f.category === 'fruit') return 250;
  if (f.category === 'grain' || f.role === 'carb') return 360;
  return 450;
}

function roundTo(g: number, step: number) {
  return Math.max(step, Math.round(g / step) * step);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type PlanArgs = Parameters<typeof planDayOnce>[0];

export function planDay(args: PlanArgs): DayPlan {
  // varied first; if that day can't hit the targets, narrow to the best-fitting recipes
  const varied = planDayOnce(args, 2);
  if (varied.withinTolerance) return varied;
  const tight = planDayOnce(args, 1);
  if (tight.withinTolerance) return tight;
  const best = planDayOnce(args, 0);
  return Math.abs(best.deviation.kcalPct) < Math.abs(tight.deviation.kcalPct) ? best : tight;
}

function planDayOnce(args: {
  date: string;
  profile: MenuProfile;
  target: MenuTargets;
  avoid?: string[]; // recipes used in the last few days (most recent first)
  /** Per-user variety seed, so two people never get the same rotation. */
  seed?: string;
  fixed?: Partial<Record<number, string>>; // slot index -> recipe forced by the user
  preferences?: Record<string, number>; // learned: -1 (dislikes) .. +1 (loves)
  workout?: WorkoutWindow;
}, variety: 0 | 1 | 2): DayPlan {
  const slots = slotsFor(args.profile.mealsPerDay);
  const pool = eligibleRecipes(args.profile);
  const seed = hash(args.date + '|' + (args.seed ?? ''));
  const perSlot = slotTargets(slots, args.target, args.workout);
  const used = new Set<string>();
  const meals: PlannedMeal[] = [];
  const prefs = args.preferences ?? {};

  slots.forEach((slot, idx) => {
    const forced = args.fixed?.[idx];
    let candidates = forced ? RECIPES.filter((r) => r.id === forced) : pool.filter((r) => r.slots.includes(slot) && !used.has(r.id));
    if (!candidates.length) candidates = pool.filter((r) => r.slots.includes(slot));
    if (!candidates.length) return;
    // remaining-day correction: steer each meal toward what is still needed
    const done = sumNutrients(meals.map((m) => m.nutrients));
    const remainingShare = perSlot.slice(idx).reduce((a, b) => a + b.kcal, 0) || 1;
    const k = perSlot[idx].kcal / remainingShare;
    const t: MenuTargets = {
      kcal: Math.max((args.target.kcal - done.kcal) * k, perSlot[idx].kcal * 0.5),
      protein: Math.max((args.target.protein - done.protein) * k, perSlot[idx].protein * 0.4),
      fat: Math.max((args.target.fat - done.fat) * k, perSlot[idx].fat * 0.3),
      carbs: Math.max((args.target.carbs - done.carbs) * k, perSlot[idx].carbs * 0.3),
    };
    const scored = candidates.map((r) => {
      const fit = fitRecipe(r, t);
      const pref = prefs[r.id] ?? 0;
      const ago = args.avoid ? args.avoid.indexOf(r.id) : -1;
      const repeat = ago < 0 ? 0 : ago < 4 ? 0.02 : 0.006; // strongly avoid what was planned in the last days
      return { r, fit, rank: fit.s - pref * 0.003 + repeat };
    });
    scored.sort((a, b) => a.rank - b.rank);
    // variety: choose among the recipes that fit almost as well as the best one
    const [mult, floor, size] = variety === 2 ? [8, 0.015, 16] : variety === 1 ? [1.5, 0.0012, 6] : [1, 0, 1];
    const good = scored.filter((x) => x.fit.s <= Math.max(scored[0].fit.s * mult, floor) && (prefs[x.r.id] ?? 0) > -0.5 && (variety === 0 || !(args.avoid ?? []).includes(x.r.id)));
    const liked = scored.filter((x) => (prefs[x.r.id] ?? 0) > -0.5);
    const pick = forced ? scored[0] : good.length ? good[(seed + idx * 7) % Math.min(good.length, size)] : (liked[0] ?? scored[0]);
    used.add(pick.r.id);
    const role = args.workout?.pre === idx ? 'pre' : args.workout?.post === idx ? 'post' : undefined;
    meals.push({ slot, recipeId: pick.r.id, items: pick.fit.items, nutrients: pick.fit.nutrients, ...(role ? { role } : {}) });
  });

  // day-level pass: fine-tune every ingredient of every meal together against the day's targets
  if (meals.length > 1) fitDay(meals, args.target);

  const totals = sumNutrients(meals.map((m) => m.nutrients));
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

/**
 * Joint coordinate descent over all ingredients of the day. Minimises the day's error, while
 * keeping each ingredient inside its realistic bounds and close to the recipe's proportions.
 */
function fitDay(meals: PlannedMeal[], t: MenuTargets) {
  const slots: { m: number; i: number; lo: number; hi: number; base: number; step: number }[] = [];
  meals.forEach((meal, m) => {
    const r = RECIPES.find((x) => x.id === meal.recipeId);
    if (!r) return;
    meal.items.forEach((it, i) => {
      const role = FOOD_BY_ID[it.foodId]?.role ?? 'other';
      const [lo, hi] = BOUNDS[role] ?? BOUNDS.other;
      const base = r.items[i]?.grams ?? it.grams;
      if (lo === hi) return;
      slots.push({ m, i, base, lo: base * lo, hi: Math.max(base, Math.min(base * hi, portionCap(it.foodId))), step: stepFor(it.foodId) });
    });
  });
  const per = meals.map((meal) => meal.items.map((it) => nutrientsFor(it.foodId, 100)));
  const dayScore = () => {
    let k = 0, p = 0, f = 0, c = 0, reg = 0;
    meals.forEach((meal, m) =>
      meal.items.forEach((it, i) => {
        const n = per[m][i];
        k += (n.kcal * it.grams) / 100;
        p += (n.protein * it.grams) / 100;
        f += (n.fat * it.grams) / 100;
        c += (n.carbs * it.grams) / 100;
      }),
    );
    for (const s of slots) reg += Math.log(Math.max(meals[s.m].items[s.i].grams, 1) / s.base) ** 2;
    const e = (a: number, b: number) => (b > 0 ? (a - b) / b : 0);
    return e(k, t.kcal) ** 2 + e(p, t.protein) ** 2 * 1.2 + e(f, t.fat) ** 2 * 0.25 + e(c, t.carbs) ** 2 * 0.25 + reg * 0.0015;
  };
  let best = dayScore();
  for (let iter = 0; iter < 25; iter++) {
    let improved = false;
    for (const s of slots) {
      const item = meals[s.m].items[s.i];
      const orig = item.grams;
      let bestG = orig;
      for (const k of [-3, -2, -1, 1, 2, 3]) {
        const g = roundTo(orig + k * s.step, s.step);
        if (g < s.lo - 1e-9 || g > s.hi + 1e-9 || g <= 0) continue;
        item.grams = g;
        const v = dayScore();
        if (v < best - 1e-9) {
          best = v;
          bestG = g;
          improved = true;
        }
      }
      item.grams = bestG;
    }
    if (!improved) break;
  }
  meals.forEach((meal) => {
    meal.items = meal.items.map((x) => ({ ...x }));
    meal.nutrients = itemsNutrients(meal.items);
  });
}

/** Three alternatives for one meal that keep the day on target (spec: "החלפת מנה"). */
export function alternativesFor(plan: DayPlan, mealIndex: number, args: { profile: MenuProfile; target: MenuTargets; preferences?: Record<string, number> }) {
  const meal = plan.meals[mealIndex];
  const pool = eligibleRecipes(args.profile).filter((r) => r.slots.includes(meal.slot) && r.id !== meal.recipeId);
  const rest = sumNutrients(plan.meals.filter((_, i) => i !== mealIndex).map((m) => m.nutrients));
  const need: MenuTargets = {
    kcal: Math.max(args.target.kcal - rest.kcal, 100),
    protein: Math.max(args.target.protein - rest.protein, 5),
    fat: Math.max(args.target.fat - rest.fat, 3),
    carbs: Math.max(args.target.carbs - rest.carbs, 5),
  };
  return pool
    .map((r) => {
      const f = fitRecipe(r, need);
      return { recipe: r, items: f.items, nutrients: f.nutrients, s: f.s - (args.preferences?.[r.id] ?? 0) * 0.003 };
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
  for (const d of plans) for (const m of d.meals) for (const it of m.items) map.set(it.foodId, (map.get(it.foodId) ?? 0) + it.grams);
  return [...map.entries()].map(([foodId, grams]) => ({ foodId, grams: Math.round(grams) })).sort((a, b) => b.grams - a.grams);
}

/** Human-readable amount: "2 ביצים (99 ג׳)", "1.5 פרוסה (48 ג׳)", "120 ג׳". */
export function describeAmount(foodId: string, grams: number): string {
  const f = FOOD_BY_ID[foodId];
  const g = Math.round(grams);
  if (!f) return `${g} ג׳`;
  const unit = f.units.find((u) => /יחידה|פרוסה|עיגול|כף/.test(u.label) && u.grams >= 15 && u.grams <= 130);
  if (unit) {
    const q = Math.round((grams / unit.grams) * 2) / 2;
    const maxQ = unit.label.includes('כף') ? 4 : 8;
    if (q >= 0.5 && q <= maxQ && Math.abs(q * unit.grams - grams) / grams < 0.2) return `${q.toLocaleString('he-IL')} ${unit.label} (${g} ג׳)`;
  }
  return `${g} ג׳`;
}
