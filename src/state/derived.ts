import { useMemo } from 'react';
import { planDay, type DayPlan, type MenuTargets } from '../engine/menu';
import { sumNutrients } from '../data/foods';
import { estimateTdee } from '../engine/adaptive';
import { detectBehavior } from '../engine/safety';
import { SAFETY_CONFIG, evaluateSafety } from '../engine/safety';
import { useStore, todayISO, type State } from './store';
import type { Nutrients } from '../engine/types';
import { preferences } from '../engine/learning';

export function menuTargets(s: State): MenuTargets | null {
  if (!s.targets) return null;
  return { kcal: s.targets.kcal.value, protein: s.targets.proteinG.value, fat: s.targets.fatG.value, carbs: s.targets.carbsG.value };
}

const cache = new Map<string, DayPlan>();

export function planFor(s: State, date: string): DayPlan | null {
  const t = menuTargets(s);
  if (!s.profile || !t) return null;
  const prefs = preferences(s.learning);
  const key = JSON.stringify([date, t, s.profile.diet, s.profile.allergies, s.profile.kosher, s.profile.mealsPerDay, s.profile.maxPrepMinutes, s.profile.dislikes, s.planFixed[date] ?? {}, prefs]);
  const hit = cache.get(key);
  if (hit) return hit;
  const y = new Date(date + 'T12:00:00');
  y.setDate(y.getDate() - 1);
  const yKey = todayISO(y);
  const prev = yKey < date ? planDayNoCache(s, yKey, t) : null;
  const plan = planDay({ date, profile: s.profile, target: t, avoid: prev?.meals.map((m) => m.recipeId), fixed: s.planFixed[date], preferences: prefs });
  cache.set(key, plan);
  return plan;
}

function planDayNoCache(s: State, date: string, t: MenuTargets): DayPlan {
  return planDay({ date, profile: s.profile!, target: t, fixed: s.planFixed[date], preferences: preferences(s.learning) });
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
