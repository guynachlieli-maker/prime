import { defaultReminders, parseTime } from '../engine/reminders';
import { slotsFor, type MenuTargets, type WorkoutWindow } from '../engine/menu';
import type { Slot } from '../data/recipes';
import type { State } from './store';
import type { CardioBlock, WorkoutDay } from '../training/plan';

/**
 * The link between the training plan and the menu.
 *  - Training days and rest days: same calories (the weekly energy balance is what moves weight),
 *    but carbohydrate follows the training load (ACSM/AND/DC 2016: "fuel for the work required").
 *  - Meals before and after a workout are found from the user's meal times and training time, and the
 *    menu shifts carbohydrate/protein into them (ISSN nutrient timing, Kerksick 2017).
 */
export interface DayLink {
  kind: 'lift' | 'cardio' | 'rest';
  workout?: WorkoutDay;
  cardio?: CardioBlock;
  startMin?: number; // minutes after midnight
  endMin?: number;
  mealTimes: number[]; // per meal slot, minutes after midnight
  window?: WorkoutWindow;
}

const toMin = (t: string) => {
  const p = parseTime(t);
  return p ? p.h * 60 + p.m : 0;
};
export const fmtMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;

export function mealTimesFor(s: State): { slots: Slot[]; times: number[] } {
  const slots = slotsFor(s.profile?.mealsPerDay ?? 4);
  const rem = s.reminders ?? defaultReminders(s.profile?.mealsPerDay ?? 4, s.learning);
  const at = (slot: Slot, fallback: string) => toMin(rem.find((r) => r.id === `meal-${slot}`)?.time ?? fallback);
  const b = at('breakfast', '08:00');
  const l = at('lunch', '13:00');
  const d = at('dinner', '19:30');
  const sn = at('snack', '16:30');
  let snackSeen = 0;
  const times = slots.map((slot) => {
    if (slot === 'breakfast') return b;
    if (slot === 'lunch') return l;
    if (slot === 'dinner') return d;
    snackSeen++;
    // with 5 meals the first snack sits between breakfast and lunch
    return slots.filter((x) => x === 'snack').length > 1 && snackSeen === 1 ? Math.round((b + l) / 2) : sn;
  });
  return { slots, times };
}

export function dayLink(s: State, date: string): DayLink {
  const { times } = mealTimesFor(s);
  const plan = s.training?.plan;
  if (!plan) return { kind: 'rest', mealTimes: times };
  const wd = new Date(date + 'T12:00:00').getDay();
  const workout = plan.days.find((d) => d.weekday === wd);
  const cardioDay = plan.cardioDays.find((c) => c.weekday === wd);
  const start = toMin(plan.prefs.time);
  if (!workout && !cardioDay) return { kind: 'rest', mealTimes: times };
  const dur = workout ? workout.estMinutes : cardioDay!.block.minutes;
  const end = start + dur;
  // pre: the last meal 1-4 h before training (else the last one before it); post: the first meal within 3 h after
  const before = times.map((t, i) => ({ t, i })).filter((x) => x.t <= start - 45);
  const pre = (before.filter((x) => x.t >= start - 240).pop() ?? before.pop())?.i ?? null;
  const post = times.map((t, i) => ({ t, i })).find((x) => x.t >= end - 15 && x.t <= end + 180)?.i ?? times.map((t, i) => ({ t, i })).find((x) => x.t >= end)?.i ?? null;
  return { kind: workout ? 'lift' : 'cardio', workout, cardio: workout?.cardio ?? cardioDay?.block, startMin: start, endMin: end, mealTimes: times, window: { pre: pre === post ? null : pre, post } };
}

/** Carbohydrate follows the training load; calories stay the same. */
export function periodize(t: MenuTargets, link: DayLink, weightKg: number): MenuTargets {
  const k = link.kind === 'lift' ? 1.1 : link.kind === 'cardio' ? 1.05 : 0.92;
  const carbs = t.carbs * k;
  const fat = Math.max(0.6 * weightKg, t.fat - ((carbs - t.carbs) * 4) / 9);
  const carbsFinal = t.carbs + ((t.fat - fat) * 9) / 4; // whatever fat could give up
  return { ...t, carbs: Math.round(carbsFinal), fat: Math.round(fat) };
}
