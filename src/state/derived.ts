import { useMemo } from 'react';
import { planDay, type DayPlan, type MenuTargets } from '../engine/menu';
import { sumNutrients } from '../data/foods';
import { supplementNutrients } from '../data/supplements';
import { estimateTdee } from '../engine/adaptive';
import { detectBehavior } from '../engine/safety';
import { SAFETY_CONFIG, evaluateSafety } from '../engine/safety';
import { useStore, todayISO, type State } from './store';
import type { Nutrients } from '../engine/types';
import { preferences } from '../engine/learning';

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

const cache = new Map<string, DayPlan>();

export function planFor(s: State, date: string): DayPlan | null {
  const t = menuTargets(s);
  if (!s.profile || !t) return null;
  const prefs = preferences(s.learning);
  const key = JSON.stringify([date, t, s.profile.diet, s.profile.allergies, s.profile.kosher, s.profile.mealsPerDay, s.profile.maxPrepMinutes, s.profile.dislikes, s.planFixed[date] ?? {}, prefs]);
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
  const plan = planDay({ date, profile: s.profile, target: t, avoid, fixed: s.planFixed[date], preferences: prefs, seed });
  cache.set(key, plan);
  return plan;
}

function planDayNoCache(s: State, date: string, t: MenuTargets, seed: string): DayPlan {
  const k = `nc|${date}|${seed}|${JSON.stringify(t)}|${s.profile!.diet}|${s.profile!.mealsPerDay}|${s.profile!.allergies}|${s.profile!.kosher}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const p = planDay({ date, profile: s.profile!, target: t, fixed: s.planFixed[date], preferences: preferences(s.learning), seed });
  cache.set(k, p);
  return p;
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
    const week = s.weighIns.filter((w) => w.date >= todayISO(new Date(Date.now() - 7 * 864e5)));
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
