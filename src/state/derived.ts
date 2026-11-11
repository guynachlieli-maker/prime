import { useMemo } from 'react';
import { planDay, type DayPlan, type MenuTargets } from '../engine/menu';
import { sumNutrients } from '../data/foods';
import { supplementNutrients } from '../data/supplements';
import { estimateTdee } from '../engine/adaptive';
import { detectBehavior } from '../engine/safety';
import { SAFETY_CONFIG, evaluateSafety } from '../engine/safety';
import { useStore, todayISO, type MealLog, type State } from './store';
import type { Nutrients } from '../engine/types';
import { preferences } from '../engine/learning';
import { dayLink, periodize } from './daylink';

export function menuTargets(s: State): MenuTargets | null {
  if (!s.targets) return null;
  // caloric supplements (protein powder, bars…) are part of the day: the menu fills the rest
  const sp = supplementNutrients(s.profile?.supplements);
  const t = s.targets;
  return {
    kcal: Math.max(t.kcal.value * 0.6, t.kcal.value - sp.kcal),
    protein: Math.max(t.proteinG.value * 0.5, t.proteinG.value - sp.protein),
    fat: Math.max(t.fatG.value * 0.6, t.fatG.value - sp.fat),
    carbs: Math.max(t.carbsG.value * 0.5, t.carbsG.value - sp.carbs),
  };
}

/** The day's menu targets: supplements removed, carbohydrate matched to the training load. */
export function dayTargets(s: State, date: string): MenuTargets | null {
  const base = menuTargets(s);
  if (!s.profile || !base) return null;
  return periodize(base, dayLink(s, date), s.profile.weightKg);
}

/** The whole day's targets (supplements included), with carbohydrate matched to the training load. */
export function fullDayTargets(s: State, date: string): MenuTargets | null {
  if (!s.profile || !s.targets) return null;
  const t = s.targets;
  return periodize({ kcal: t.kcal.value, protein: t.proteinG.value, fat: t.fatG.value, carbs: t.carbsG.value }, dayLink(s, date), s.profile.weightKg);
}

/**
 * Which planned meals were already eaten: a log of the planned dish itself, or any other food
 * logged for that meal (photo, barcode, search…). Supplements never count as a meal.
 */
export function mealsDone(plan: DayPlan, logs: MealLog[]): boolean[] {
  const day = logs.filter((l) => l.date === plan.date && l.method !== 'supplement');
  const planned = new Set(plan.meals.map((m) => m.recipeId));
  const eatenRecipes = new Map<string, number>();
  const otherBySlot = new Map<string, number>();
  for (const l of day) {
    const id = l.items[0]?.foodId;
    if (l.method === 'plan' && id && planned.has(id)) eatenRecipes.set(id, (eatenRecipes.get(id) ?? 0) + 1);
    else otherBySlot.set(l.slot, (otherBySlot.get(l.slot) ?? 0) + 1);
  }
  return plan.meals.map((m) => {
    const r = eatenRecipes.get(m.recipeId) ?? 0;
    if (r > 0) {
      eatenRecipes.set(m.recipeId, r - 1);
      return true;
    }
    const o = otherBySlot.get(m.slot) ?? 0;
    if (o > 0) {
      otherBySlot.set(m.slot, o - 1);
      return true;
    }
    return false;
  });
}

const cache = new Map<string, DayPlan>();
const remember = (k: string, p: DayPlan) => {
  if (cache.size > 400) cache.clear(); // a long session never grows without bound
  cache.set(k, p);
  return p;
};

export function planFor(s: State, date: string): DayPlan | null {
  const base = menuTargets(s);
  if (!s.profile || !base) return null;
  const link = dayLink(s, date);
  const t = periodize(base, link, s.profile.weightKg);
  const workout = link.window;
  const prefs = preferences(s.learning);
  const key = JSON.stringify([date, t, workout, s.profile.diet, s.profile.allergies, s.profile.kosher, s.profile.mealsPerDay, s.profile.maxPrepMinutes, s.profile.dislikes, s.planFixed[date] ?? {}, prefs]);
  const hit = cache.get(key);
  if (hit) return hit;
  const seed = s.startedAt ?? s.profile.name ?? '';
  // avoid what was planned on the previous 3 days (computed without their own history, to stay cheap)
  const avoid: string[] = [];
  for (let d = 1; d <= 3; d++) {
    const y = new Date(date + 'T12:00:00');
    y.setDate(y.getDate() - d);
    const prev = planDayNoCache(s, todayISO(y), t, seed);
    avoid.push(...prev.meals.map((m) => m.recipeId));
  }
  const plan = planDay({ date, profile: s.profile, target: t, avoid, fixed: s.planFixed[date], preferences: prefs, seed, workout });
  return remember(key, plan);
}

function planDayNoCache(s: State, date: string, t: MenuTargets, seed: string): DayPlan {
  const k = `nc|${date}|${seed}|${JSON.stringify(t)}|${s.profile!.diet}|${s.profile!.mealsPerDay}|${s.profile!.allergies}|${s.profile!.kosher}|${s.profile!.maxPrepMinutes}|${s.profile!.dislikes}|${JSON.stringify(s.planFixed[date] ?? {})}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const p = planDay({ date, profile: s.profile!, target: t, fixed: s.planFixed[date], preferences: preferences(s.learning), seed });
  return remember(k, p);
}

export function usePlan(date: string) {
  const s = useStore((x) => x);
  return useMemo(() => planFor(s, date), [s, date]);
}

export function eatenOn(s: State, date: string): Nutrients {
  return sumNutrients(s.logs.filter((l) => l.date === date).map((l) => l.nutrients));
}

export function dailyIntake(s: State): { date: string; kcal: number }[] {
  const m = new Map<string, number>();
  for (const l of s.logs) m.set(l.date, (m.get(l.date) ?? 0) + l.nutrients.kcal);
  return [...m.entries()].map(([date, kcal]) => ({ date, kcal })).sort((a, b) => a.date.localeCompare(b.date));
}

export function useAlerts() {
  const s = useStore((x) => x);
  return useMemo(() => {
    if (!s.profile || !s.targets) return [];
    const today = todayISO();
    const intake = dailyIntake(s).filter((d) => d.date < today);
    const floor = Math.max(s.targets.bmr.value, SAFETY_CONFIG.absoluteKcalFloor[s.profile.sex]);
    const weighInsToday = s.weighIns.filter((w) => w.date === today).length;
    const week = s.weighIns.filter((w) => w.date >= todayISO(new Date(Date.now() - 7 * 864e5))).sort((a, b) => a.date.localeCompare(b.date));
    const weeklyLossPct = week.length >= 2 ? ((week[0].kg - week[week.length - 1].kg) / week[0].kg) * 100 : null;
    return detectBehavior({ dailyKcal: intake, floorKcal: floor, weighInsToday, weeklyLossPct });
  }, [s]);
}

export function useAdaptive() {
  const s = useStore((x) => x);
  return useMemo(() => {
    if (!s.targets) return null;
    return estimateTdee({ intake: dailyIntake(s).filter((d) => d.date < todayISO()), weighIns: s.weighIns, currentTdee: s.targets.tdee.value });
  }, [s]);
}

export function useSafety() {
  const p = useStore((x) => x.profile);
  return useMemo(() => (p ? evaluateSafety(p) : null), [p]);
}
