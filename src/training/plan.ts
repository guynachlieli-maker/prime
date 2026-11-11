import { CORE_EXERCISES, CORE_BY_ID, type CoreExercise, type Equip, type Limit, type Pattern } from './exercises';

/**
 * Training program generator.
 * Evidence used (see training sources):
 *  - Volume: 10-20 hard sets per muscle per week for hypertrophy (Schoenfeld 2017; Pelland 2024 meta-regression).
 *  - Frequency: each muscle at least twice a week (Schoenfeld 2016).
 *  - Load: 6-15 reps near failure builds muscle; heavy 3-6 reps for strength (Schoenfeld 2017 load meta-analysis; ACSM 2009 progression).
 *  - Proximity to failure: 1-3 reps in reserve (Robinson 2024).
 *  - Rest: 2-3 min on compound lifts (Schoenfeld 2016 rest study).
 *  - Aerobic: 150-300 min moderate or 75-150 min vigorous a week (WHO 2020).
 *  - Fat loss with resistance training preserves lean mass (Helms 2014).
 */
export type TrainingGoal = 'cut' | 'muscle' | 'bulk' | 'strength' | 'recomp' | 'endurance' | 'health';
export type EquipChoice = 'gym' | 'home_db' | 'bands' | 'bodyweight';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type CardioType = 'walk' | 'incline_walk' | 'run' | 'bike' | 'row' | 'elliptical' | 'swim' | 'stairs' | 'rope';

export interface TrainingPrefs {
  goal: TrainingGoal;
  days: number; // resistance sessions per week, 2-6
  minutes: number; // per session
  cardio: 'little' | 'balanced' | 'lots';
  cardioTypes: CardioType[];
  equipment: EquipChoice;
  level: Level;
  limits: Limit[];
  time: string; // usual training time HH:MM (for reminders)
}

export interface PlannedExercise {
  exId: string;
  sets: number;
  reps: [number, number];
  rir: number;
  restSec: number;
  alternatives: string[];
  unit?: 'sec';
}

export interface CardioBlock {
  type: CardioType;
  minutes: number;
  intensity: 'easy' | 'moderate' | 'intervals';
  note: string;
}

export interface WorkoutDay {
  id: string;
  title: string;
  focus: string;
  weekday: number; // 0 = Sunday
  exercises: PlannedExercise[];
  cardio?: CardioBlock;
  estMinutes: number;
}

export interface TrainingPlan {
  id: string;
  createdAt: string;
  prefs: TrainingPrefs;
  split: string;
  splitWhy: string;
  days: WorkoutDay[];
  cardioDays: { weekday: number; block: CardioBlock }[];
  weeklyCardioMin: number;
  deloadEvery: number; // weeks
  notes: string[];
}

export const WEEKDAY = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export const GOAL_LABEL: Record<TrainingGoal, string> = {
  cut: 'חיטוב (ירידה בשומן)',
  muscle: 'הגדלת שריר (מסה נקייה)',
  bulk: 'מסה',
  strength: 'כוח',
  recomp: 'ריקומפוזיציה',
  endurance: 'סיבולת ואירובי',
  health: 'כושר ובריאות',
};

export const CARDIO: Record<CardioType, { name: string; met: { easy: number; moderate: number; intervals: number }; impact: 'low' | 'high' }> = {
  // MET values: Compendium of Physical Activities 2024 (Herrmann et al.)
  walk: { name: 'הליכה מהירה', met: { easy: 3.5, moderate: 4.3, intervals: 5.0 }, impact: 'low' },
  incline_walk: { name: 'הליכה בשיפוע על הליכון', met: { easy: 5.0, moderate: 6.5, intervals: 8.0 }, impact: 'low' },
  run: { name: 'ריצה', met: { easy: 8.0, moderate: 9.8, intervals: 11.0 }, impact: 'high' },
  bike: { name: 'אופניים / אופני כושר', met: { easy: 4.8, moderate: 6.8, intervals: 8.8 }, impact: 'low' },
  row: { name: 'מכשיר חתירה', met: { easy: 4.8, moderate: 7.0, intervals: 8.5 }, impact: 'low' },
  elliptical: { name: 'אליפטי', met: { easy: 4.6, moderate: 5.0, intervals: 7.0 }, impact: 'low' },
  swim: { name: 'שחייה', met: { easy: 5.8, moderate: 7.0, intervals: 9.8 }, impact: 'low' },
  stairs: { name: 'מכשיר מדרגות', met: { easy: 6.0, moderate: 9.0, intervals: 10.0 }, impact: 'low' },
  rope: { name: 'קפיצה בחבל', met: { easy: 8.8, moderate: 11.8, intervals: 12.3 }, impact: 'high' },
};

export const kcalForCardio = (b: CardioBlock, kg: number) => Math.round(CARDIO[b.type].met[b.intensity] * kg * (b.minutes / 60));

const EQUIP_OK: Record<EquipChoice, Equip[]> = { gym: ['gym', 'db', 'bw', 'band'], home_db: ['db', 'bw'], bands: ['band', 'bw'], bodyweight: ['bw'] };
const LEVEL_N: Record<Level, number> = { beginner: 1, intermediate: 2, advanced: 3 };

/** Pattern slots per day type, in priority order. Patterns after the first 4 are dropped first when time is short. */
const TEMPLATES: Record<string, { title: string; focus: string; slots: Pattern[] }> = {
  fbA: { title: 'גוף מלא A', focus: 'סקוואט, לחיצה וחתירה', slots: ['squat', 'h_push', 'h_pull', 'hinge', 'lateral', 'core_anti_ext', 'biceps', 'triceps'] },
  fbB: { title: 'גוף מלא B', focus: 'דדליפט, מתח ולחיצה מעל הראש', slots: ['hinge', 'v_pull', 'v_push', 'lunge', 'rear_delt', 'core_flex', 'triceps', 'biceps'] },
  fbC: { title: 'גוף מלא C', focus: 'רגליים, חזה בשיפוע וגב', slots: ['squat', 'h_push', 'h_pull', 'glute', 'lateral', 'calf', 'core_rot'] },
  upA: { title: 'פלג גוף עליון A', focus: 'חזה וגב בכוח', slots: ['h_push', 'h_pull', 'v_push', 'v_pull', 'lateral', 'triceps', 'biceps'] },
  upB: { title: 'פלג גוף עליון B', focus: 'נפח לחזה, גב וכתפיים', slots: ['h_push', 'v_pull', 'h_pull', 'fly', 'rear_delt', 'biceps', 'triceps'] },
  loA: { title: 'פלג גוף תחתון A', focus: 'סקוואט וירך אחורית', slots: ['squat', 'hinge', 'lunge', 'knee_flex', 'calf', 'core_anti_ext'] },
  loB: { title: 'פלג גוף תחתון B', focus: 'אגן, ישבן ורגל אחת', slots: ['hinge', 'squat', 'glute', 'knee_ext', 'knee_flex', 'calf', 'core_flex'] },
  push: { title: 'דחיפה', focus: 'חזה, כתפיים ויד אחורית', slots: ['h_push', 'v_push', 'h_push', 'lateral', 'fly', 'triceps', 'triceps'] },
  pull: { title: 'משיכה', focus: 'גב, כתף אחורית ויד קדמית', slots: ['v_pull', 'h_pull', 'h_pull', 'rear_delt', 'v_pull', 'biceps', 'biceps'] },
  legs: { title: 'רגליים', focus: 'ירך קדמית, אחורית וישבן', slots: ['squat', 'hinge', 'lunge', 'knee_flex', 'knee_ext', 'calf', 'core_anti_ext'] },
};

const SPLITS: Record<number, { keys: string[]; name: string; why: string }> = {
  2: { keys: ['fbA', 'fbB'], name: 'גוף מלא, פעמיים בשבוע', why: 'בשני אימונים, גוף מלא מאפשר לעבוד על כל שריר פעמיים בשבוע. זו התדירות שהמחקר מראה שעדיפה לבניית שריר.' },
  3: { keys: ['fbA', 'fbB', 'fbC'], name: 'גוף מלא, 3 פעמים בשבוע', why: 'שלושה אימוני גוף מלא נותנים לכל שריר 2-3 גירויים בשבוע עם זמן התאוששות טוב ביניהם.' },
  4: { keys: ['upA', 'loA', 'upB', 'loB'], name: 'עליון / תחתון', why: 'חלוקה לעליון ותחתון מאפשרת יותר נפח לכל שריר, פעמיים בשבוע, באימונים באורך סביר.' },
  5: { keys: ['upA', 'loA', 'push', 'pull', 'legs'], name: 'עליון / תחתון + דחיפה / משיכה / רגליים', why: 'חמישה אימונים מאפשרים נפח גבוה עם תדירות של פעמיים בשבוע לכל שריר.' },
  6: { keys: ['push', 'pull', 'legs', 'push', 'pull', 'legs'], name: 'דחיפה / משיכה / רגליים פעמיים', why: 'למתאמנים מנוסים: כל שריר פעמיים בשבוע בנפח גבוה, כשכל אימון ממוקד.' },
};

const WEEKDAYS: Record<number, number[]> = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };

function scheme(goal: TrainingGoal, level: Level, ex: CoreExercise, first: boolean): Omit<PlannedExercise, 'exId' | 'alternatives'> {
  const beginner = level === 'beginner';
  const iso = !ex.compound;
  if (ex.pattern === 'core_anti_ext' && /plank|side_plank/.test(ex.id)) return { sets: 3, reps: [30, 45], rir: 2, restSec: 60, unit: 'sec' };
  if (ex.pattern === 'carry') return { sets: 3, reps: [30, 40], rir: 2, restSec: 90, unit: 'sec' };
  if (goal === 'strength' && !iso && first) return { sets: beginner ? 3 : 4, reps: [3, 6], rir: 2, restSec: 180 };
  if (goal === 'strength') return { sets: 3, reps: iso ? [8, 12] : [5, 8], rir: 2, restSec: iso ? 90 : 150 };
  if (goal === 'endurance' || goal === 'health') return { sets: beginner ? 2 : 3, reps: iso ? [12, 15] : [8, 12], rir: 3, restSec: iso ? 60 : 90 };
  if (goal === 'cut' || goal === 'recomp') return { sets: iso ? 2 : 3, reps: iso ? [10, 15] : [6, 10], rir: 2, restSec: iso ? 60 : 150 };
  // muscle / bulk
  return { sets: beginner ? 3 : iso ? 3 : 4, reps: iso ? [10, 15] : [6, 10], rir: beginner ? 2 : 1, restSec: iso ? 75 : 150 };
}

export function eligible(prefs: Pick<TrainingPrefs, 'equipment' | 'level' | 'limits'>): CoreExercise[] {
  const ok = EQUIP_OK[prefs.equipment];
  const lvl = LEVEL_N[prefs.level];
  return CORE_EXERCISES.filter((e) => e.equip.some((q) => ok.includes(q)) && e.level <= lvl + (lvl === 1 ? 1 : 0) && !(e.avoidIf ?? []).some((l) => prefs.limits.includes(l)));
}

export function alternativesFor(exId: string, prefs: Pick<TrainingPrefs, 'equipment' | 'level' | 'limits'>): string[] {
  const ex = CORE_BY_ID[exId];
  if (!ex) return [];
  return eligible(prefs).filter((e) => e.pattern === ex.pattern && e.id !== exId).map((e) => e.id);
}

// when the equipment has no exercise for a pattern, use the closest one
const FALLBACK: Partial<Record<Pattern, Pattern[]>> = {
  lateral: ['rear_delt', 'v_push'], fly: ['h_push'], knee_ext: ['lunge', 'squat'], knee_flex: ['glute', 'hinge'], v_pull: ['h_pull'], h_pull: ['v_pull'],
  calf: ['lunge'], biceps: ['h_pull', 'v_pull'], triceps: ['h_push'], core_rot: ['core_anti_ext'], core_flex: ['core_anti_ext'], hinge: ['glute'], glute: ['hinge', 'lunge'],
  v_push: ['h_push'], rear_delt: ['h_pull'], squat: ['lunge'], lunge: ['squat'],
};

function pick(pool: CoreExercise[], pattern: Pattern, used: Set<string>, variant: number, level: Level): CoreExercise | null {
  for (const p of [pattern, ...(FALLBACK[pattern] ?? [])]) {
    const hit = pickExact(pool, p, used, variant, level);
    if (hit) return hit;
  }
  return null;
}

function pickExact(pool: CoreExercise[], pattern: Pattern, used: Set<string>, variant: number, level: Level): CoreExercise | null {
  const c = pool.filter((e) => e.pattern === pattern && !used.has(e.id));
  if (!c.length) return null;
  // prefer compound, then level closest to the user's
  const lvl = LEVEL_N[level];
  c.sort((a, b) => Number(b.compound) - Number(a.compound) || Math.abs(a.level - lvl) - Math.abs(b.level - lvl) || CORE_EXERCISES.indexOf(a) - CORE_EXERCISES.indexOf(b));
  return c[variant % Math.min(c.length, 3)];
}

const minutesOf = (list: PlannedExercise[]) => Math.round(8 + list.reduce((a, e) => a + e.sets * (0.75 + e.restSec / 60), 0));

export function weeklyCardioTarget(goal: TrainingGoal, share: TrainingPrefs['cardio']): number {
  const base: Record<TrainingGoal, number> = { cut: 150, muscle: 90, bulk: 75, strength: 60, recomp: 120, endurance: 240, health: 150 };
  return Math.round((base[goal] * { little: 0.6, balanced: 1, lots: 1.5 }[share]) / 5) * 5;
}

export function generatePlan(prefs: TrainingPrefs, now = new Date()): TrainingPlan {
  const days = Math.max(2, Math.min(6, prefs.days));
  const split = SPLITS[days];
  const pool = eligible(prefs);
  const weekdays = WEEKDAYS[days];
  const budget = Math.max(25, prefs.minutes);
  const highImpactOk = !prefs.limits.includes('knee');
  const cardioType = (prefs.cardioTypes.find((t) => highImpactOk || CARDIO[t].impact === 'low') ?? 'walk') as CardioType;

  const seen = new Map<string, number>();
  const planDays: WorkoutDay[] = split.keys.map((key, i) => {
    const tpl = TEMPLATES[key];
    const variant = seen.get(key) ?? 0;
    seen.set(key, variant + 1);
    const used = new Set<string>();
    const list: PlannedExercise[] = [];
    tpl.slots.forEach((pattern, idx) => {
      const ex = pick(pool, pattern, used, variant + (idx > 3 ? 1 : 0), prefs.level);
      if (!ex) return;
      used.add(ex.id);
      list.push({ exId: ex.id, ...scheme(prefs.goal, prefs.level, ex, idx === 0), alternatives: alternativesFor(ex.id, prefs).slice(0, 4) });
    });
    // never fewer than 4 exercises: fill with core and glute work when the equipment is limited
    for (const extra of ['core_anti_ext', 'core_flex', 'glute', 'core_rot'] as Pattern[]) {
      if (list.length >= 4) break;
      const ex = pickExact(pool, extra, used, variant, prefs.level);
      if (ex) {
        used.add(ex.id);
        list.push({ exId: ex.id, ...scheme(prefs.goal, prefs.level, ex, false), alternatives: alternativesFor(ex.id, prefs).slice(0, 4) });
      }
    }
    // fit the session into the time the user has: drop from the end, then trim sets
    while (list.length > 3 && minutesOf(list) > budget) list.pop();
    for (let k = list.length - 1; minutesOf(list) > budget && k >= 0; k--) if (list[k].sets > 2) list[k] = { ...list[k], sets: list[k].sets - 1 };
    return { id: `d${i + 1}`, title: tpl.title, focus: tpl.focus, weekday: weekdays[i], exercises: list, estMinutes: minutesOf(list) };
  });

  // aerobic: finishers after lifting when time allows, the rest on separate days
  const weekly = weeklyCardioTarget(prefs.goal, prefs.cardio);
  let remaining = weekly;
  const intervalsOk = prefs.level !== 'beginner' && (prefs.goal === 'endurance' || prefs.goal === 'cut' || prefs.goal === 'health');
  for (const d of planDays) {
    const free = budget - d.estMinutes;
    if (remaining > 0 && free >= 12 && prefs.goal !== 'strength') {
      const m = Math.min(20, free, remaining);
      d.cardio = { type: cardioType, minutes: m, intensity: 'moderate', note: 'אחרי האימון, בקצב שאפשר לדבר בו במשפטים קצרים.' };
      d.estMinutes += m;
      remaining -= m;
    }
  }
  const restDays = [0, 1, 2, 3, 4, 5, 6].filter((w) => !weekdays.includes(w) && w !== 6);
  const cardioDays: TrainingPlan['cardioDays'] = [];
  let usedIntervals = false;
  for (const w of [...restDays, 6]) {
    if (remaining < 15) break;
    const m = Math.min(remaining, prefs.cardio === 'lots' ? 45 : 35);
    const intervals: boolean = intervalsOk && !usedIntervals && m >= 20;
    usedIntervals ||= intervals;
    cardioDays.push({
      weekday: w,
      block: intervals
        ? { type: cardioType, minutes: Math.min(m, 25), intensity: 'intervals', note: 'חימום 5 דקות, ואז 6 פעמים: דקה מאמץ גבוה ושתי דקות קלות. שחרור 3 דקות.' }
        : { type: cardioType, minutes: m, intensity: m >= 40 ? 'easy' : 'moderate', note: 'קצב נוח ורציף (אזור 2): נושמים מהר, אבל עדיין אפשר לדבר.' },
    });
    remaining -= intervals ? Math.min(m, 25) : m;
  }
  // whatever is left goes to the longest easy block
  const easy = cardioDays.filter((c) => c.block.intensity !== 'intervals').sort((a, b) => b.block.minutes - a.block.minutes)[0];
  if (remaining > 0 && easy) easy.block = { ...easy.block, minutes: easy.block.minutes + remaining };

  const notes: string[] = [];
  if (prefs.goal === 'cut') notes.push('בחיטוב לא מורידים משקלים: האימון הכבד הוא מה ששומר על השריר בזמן הגירעון.');
  if (prefs.goal === 'bulk') notes.push('במסה מעלים משקל באופן הדרגתי כל שבוע. רוב השריר נבנה מחזרות קרובות לכשל, לא מאכילת יתר.');
  if (prefs.level === 'beginner') notes.push('בחודש הראשון מתמקדים בטכניקה: משאירים 2-3 חזרות ברזרבה בכל סט.');
  if (prefs.limits.length) notes.push('הוצאנו מהתוכנית תרגילים שמעמיסים על האזור שסימנת. כאב חד במהלך תרגיל הוא סימן לעצור.');

  return {
    id: `plan-${now.getTime().toString(36)}`,
    createdAt: now.toISOString(),
    prefs,
    split: split.name,
    splitWhy: split.why,
    days: planDays,
    cardioDays,
    weeklyCardioMin: weekly,
    deloadEvery: prefs.level === 'beginner' ? 8 : 5,
    notes,
  };
}

/** Week number in the plan (1-based) and whether it is a lighter deload week. */
export function planWeek(plan: TrainingPlan, now = new Date()): { week: number; deload: boolean } {
  const week = Math.floor((now.getTime() - Date.parse(plan.createdAt)) / (7 * 864e5)) + 1;
  return { week, deload: week > 1 && week % plan.deloadEvery === 0 };
}

/** Sets per muscle per week (primary = 1, secondary = 0.5), to check against 10-20. */
export function weeklyVolume(plan: TrainingPlan): Record<string, number> {
  const v: Record<string, number> = {};
  for (const d of plan.days)
    for (const e of d.exercises) {
      const ex = CORE_BY_ID[e.exId];
      if (!ex) continue;
      ex.primary.forEach((m) => (v[m] = (v[m] ?? 0) + e.sets));
      ex.secondary.forEach((m) => (v[m] = (v[m] ?? 0) + e.sets * 0.5));
    }
  return v;
}

/* ---------------- progression ---------------- */

export interface SetLog {
  kg: number;
  reps: number;
  done: boolean;
}
export interface ExerciseLog {
  exId: string;
  sets: SetLog[];
}
export interface SessionLog {
  id: string;
  date: string;
  dayId: string;
  planId: string;
  exercises: ExerciseLog[];
  cardio?: { type: CardioType; minutes: number; intensity: CardioBlock['intensity'] };
  minutes?: number;
  rpe?: number;
}

const LOWER = new Set<Pattern>(['squat', 'hinge', 'lunge', 'glute']);

/**
 * Double progression: when every set reached the top of the rep range, add load next time
 * (2.5 kg upper body / 5 kg lower body barbell, ~2 kg dumbbells). If the bottom of the range was
 * missed twice in a row, drop 5-10%.
 */
export function suggestNext(exId: string, planned: PlannedExercise, history: SessionLog[]): { kg: number | null; note: string } {
  const logs = history.map((s) => s.exercises.find((e) => e.exId === exId)).filter((e): e is ExerciseLog => !!e && e.sets.some((x) => x.done && x.kg > 0));
  const last = logs[logs.length - 1];
  if (!last) return { kg: null, note: 'פעם ראשונה: בחרו משקל שמשאיר בערך ' + planned.rir + ' חזרות ברזרבה בסוף הסט.' };
  const done = last.sets.filter((s) => s.done);
  const top = Math.max(...done.map((s) => s.kg));
  const ex = CORE_BY_ID[exId];
  const step = ex?.equip.includes('gym') && !ex.equip.includes('db') ? (ex && LOWER.has(ex.pattern) ? 5 : 2.5) : 2;
  if (done.length >= planned.sets && done.every((s) => s.reps >= planned.reps[1])) return { kg: top + step, note: `הגעת לראש טווח החזרות בכל הסטים. היום: ${top + step} ק"ג.` };
  const prev = logs[logs.length - 2];
  const missed = (l: ExerciseLog | undefined) => !!l && l.sets.filter((s) => s.done).some((s) => s.reps < planned.reps[0]);
  if (missed(last) && missed(prev)) {
    const kg = Math.round((top * 0.92) / 0.5) * 0.5;
    return { kg, note: `פעמיים מתחת לטווח: מורידים מעט ל-${kg} ק"ג ובונים חזרה.` };
  }
  return { kg: top, note: `אותו משקל (${top} ק"ג). המטרה: עוד חזרה בכל סט עד ${planned.reps[1]}.` };
}

/** Epley estimated 1RM. */
export const e1rm = (kg: number, reps: number) => (reps <= 1 ? kg : Math.round(kg * (1 + reps / 30) * 10) / 10);

/* ---------------- long-term phases ---------------- */

export interface Phase {
  kind: 'cut' | 'bulk' | 'lean_gain' | 'maintain' | 'mini_cut';
  title: string;
  weeks: number;
  why: string;
  nutritionGoal: 'fat_loss' | 'muscle_gain' | 'bulk' | 'recomp' | 'performance';
}

/**
 * Macrocycle: decides the order of phases from goal, sex, body fat and level.
 * Gain rates and body-fat thresholds follow Iraki et al. 2019 (off-season bodybuilding nutrition)
 * and Helms et al. 2014 (contest preparation).
 */
export function phasePlan(args: { goal: TrainingGoal; sex: 'male' | 'female'; bodyFatPct: number; level: Level }): Phase[] {
  const { goal, sex, bodyFatPct: bf, level } = args;
  const high = sex === 'male' ? 20 : 30;
  const lean = sex === 'male' ? 15 : 24;
  const gainWeeks = level === 'beginner' ? 24 : level === 'intermediate' ? 16 : 12;
  const cutFirst = (w: number): Phase => ({ kind: 'cut', title: 'חיטוב', weeks: w, why: `אחוז השומן כרגע (${Math.round(bf)}%) גבוה מהטווח שבו כדאי להתחיל מסה. ירידה לכ-${lean}% קודם תשאיר יותר מקום לבניית שריר אחר כך.`, nutritionGoal: 'fat_loss' });
  const cutWeeks = Math.max(6, Math.min(20, Math.round((bf - lean) / 0.35)));
  const maintain = (w = 3): Phase => ({ kind: 'maintain', title: 'תחזוקה', weeks: w, why: 'שבועות באיזון קלורי אחרי שינוי, כדי לייצב את המשקל החדש ולהתאושש.', nutritionGoal: 'performance' });
  if (goal === 'bulk' || goal === 'muscle') {
    const gain: Phase =
      goal === 'bulk'
        ? { kind: 'bulk', title: 'מסה', weeks: gainWeeks, why: `עודף קלורי מתוכנן: עלייה של כ-${level === 'beginner' ? '1-1.5' : level === 'intermediate' ? '0.5-1' : '0.25-0.5'}% ממשקל הגוף בחודש. מעבר לזה רוב העלייה היא שומן.`, nutritionGoal: 'bulk' }
        : { kind: 'lean_gain', title: 'מסה נקייה', weeks: gainWeeks, why: 'עודף קטן, כדי לבנות שריר עם מינימום שומן.', nutritionGoal: 'muscle_gain' };
    const miniCut: Phase = { kind: 'mini_cut', title: 'חיטוב קצר', weeks: 6, why: `בסוף המסה אחוז השומן עולה. חיטוב קצר של כ-6 שבועות מחזיר אותו לכ-${lean}%, ומשם אפשר להתחיל סבב מסה נוסף.`, nutritionGoal: 'fat_loss' };
    return bf >= high ? [cutFirst(cutWeeks), maintain(2), gain, miniCut, maintain()] : [gain, miniCut, maintain()];
  }
  if (goal === 'cut') return [{ kind: 'cut', title: 'חיטוב', weeks: Math.max(8, cutWeeks), why: 'גירעון מתון עם אימוני כוח כבדים, כדי שרוב הירידה תהיה שומן.', nutritionGoal: 'fat_loss' }, maintain(4)];
  if (goal === 'recomp') return [{ kind: 'maintain', title: 'ריקומפוזיציה', weeks: 16, why: 'גירעון קטן מאוד וחלבון גבוה: בונים שריר ומורידים שומן במקביל. מתאים בעיקר למתחילים ולחוזרים לאימונים.', nutritionGoal: 'recomp' }];
  return [{ kind: 'maintain', title: goal === 'strength' ? 'בניית כוח' : 'כושר כללי', weeks: 12, why: 'באיזון קלורי, כדי שיהיה מספיק דלק לאימונים.', nutritionGoal: 'performance' }];
}
