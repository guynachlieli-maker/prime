import type { Slot } from '../data/recipes';

/**
 * Personal learning. Everything here is learned from the user's own actions, stays on the device,
 * is shown to the user ("מה המערכת למדה עליך"), and can be reset. It only re-ranks and calibrates
 * inside the safety rails: it never changes the calorie floor, the pace cap or the screening rules.
 *
 *  - Food preferences: which recipes the user eats, swaps in, or swaps out.
 *  - Photo calibration: how the user's corrections compare with the photo estimate.
 *  - Meal timing: when each meal is usually logged (default meal, reminders).
 *  - Energy expenditure: see adaptive.ts (weight trend vs intake).
 */
export interface RecipeStat {
  shown: number;
  eaten: number;
  swappedIn: number;
  swappedOut: number;
}

export interface LearningState {
  recipes: Record<string, RecipeStat>;
  photo: { n: number; ratio: number }; // EMA of (final kcal / estimated kcal)
  mealMinutes: Partial<Record<Slot, number[]>>; // recent log times (minutes after midnight), last 20 per slot
}

export const EMPTY_LEARNING: LearningState = { recipes: {}, photo: { n: 0, ratio: 1 }, mealMinutes: {} };

const stat = (l: LearningState, id: string): RecipeStat => l.recipes[id] ?? { shown: 0, eaten: 0, swappedIn: 0, swappedOut: 0 };

export function recordRecipe(l: LearningState, id: string, event: keyof RecipeStat): LearningState {
  const s = { ...stat(l, id) };
  s[event] += 1;
  return { ...l, recipes: { ...l.recipes, [id]: s } };
}

/** -1 (avoid) .. +1 (favourite). Needs a few events before it moves much (Bayesian-style prior of 2). */
export function preferenceScore(s: RecipeStat): number {
  const v = (s.eaten + s.swappedIn * 1.5 - s.swappedOut * 2) / (s.eaten + s.swappedIn + s.swappedOut + 2);
  return Math.max(-1, Math.min(1, v));
}

export function preferences(l: LearningState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, s] of Object.entries(l.recipes)) out[id] = preferenceScore(s);
  return out;
}

/** Update the photo calibration after the user confirmed a photo estimate. */
export function recordPhotoCorrection(l: LearningState, estimatedKcal: number, finalKcal: number): LearningState {
  if (estimatedKcal < 50 || finalKcal <= 0) return l;
  const r = Math.max(0.5, Math.min(2, finalKcal / estimatedKcal));
  const alpha = l.photo.n < 5 ? 1 / (l.photo.n + 1) : 0.2;
  return { ...l, photo: { n: l.photo.n + 1, ratio: l.photo.ratio + alpha * (r - l.photo.ratio) } };
}

/** Multiplier applied to future photo estimates. Neutral until 3 corrections; bounded to ±25%. */
export function photoFactor(l: LearningState): number {
  if (l.photo.n < 3) return 1;
  return Math.max(0.75, Math.min(1.25, l.photo.ratio));
}

export function recordMealTime(l: LearningState, slot: Slot, time: string): LearningState {
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h)) return l;
  const list = [...(l.mealMinutes[slot] ?? []), h * 60 + (m || 0)].slice(-20);
  return { ...l, mealMinutes: { ...l.mealMinutes, [slot]: list } };
}

export function usualTime(l: LearningState, slot: Slot): string | null {
  const list = l.mealMinutes[slot];
  if (!list || list.length < 3) return null;
  const s = [...list].sort((a, b) => a - b);
  const med = s[Math.floor(s.length / 2)];
  return `${String(Math.floor(med / 60)).padStart(2, '0')}:${String(med % 60).padStart(2, '0')}`;
}

/** The slot whose usual time is closest to now; null until there is enough history. */
export function likelySlot(l: LearningState, now = new Date()): Slot | null {
  const mins = now.getHours() * 60 + now.getMinutes();
  let best: { slot: Slot; d: number } | null = null;
  for (const slot of ['breakfast', 'lunch', 'snack', 'dinner'] as Slot[]) {
    const t = usualTime(l, slot);
    if (!t) continue;
    const [h, m] = t.split(':').map(Number);
    const d = Math.abs(h * 60 + m - mins);
    if (!best || d < best.d) best = { slot, d };
  }
  return best && best.d <= 90 ? best.slot : null;
}

export interface LearnedFact {
  title: string;
  detail: string;
}

/** Plain-language summary for the transparency screen. */
export function summarize(l: LearningState, recipeName: (id: string) => string): LearnedFact[] {
  const facts: LearnedFact[] = [];
  const prefs = Object.entries(preferences(l)).filter(([id]) => (l.recipes[id].eaten + l.recipes[id].swappedIn + l.recipes[id].swappedOut) >= 2);
  const liked = prefs.filter(([, v]) => v >= 0.4).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const disliked = prefs.filter(([, v]) => v <= -0.3).sort((a, b) => a[1] - b[1]).slice(0, 4);
  if (liked.length) facts.push({ title: 'מנות אהובות', detail: `${liked.map(([id]) => recipeName(id)).join(', ')}. הן יופיעו בתפריט קצת יותר.` });
  if (disliked.length) facts.push({ title: 'מנות שמוחלפות הרבה', detail: `${disliked.map(([id]) => recipeName(id)).join(', ')}. הן יופיעו פחות.` });
  if (l.photo.n >= 3) {
    const pct = Math.round((photoFactor(l) - 1) * 100);
    facts.push({
      title: 'הכיול של הצילום',
      detail:
        Math.abs(pct) < 4
          ? `אחרי ${l.photo.n} תיקונים, ההערכה מהתמונה קרובה למה שאושר בפועל. אין תיקון.`
          : `אחרי ${l.photo.n} תיקונים, המנות שלך בדרך כלל ${pct > 0 ? 'גדולות' : 'קטנות'} ב-${Math.abs(pct)}% מההערכה מהתמונה. ההערכות הבאות מתוקנות בהתאם.`,
    });
  }
  const times = (['breakfast', 'lunch', 'dinner'] as Slot[]).map((s) => [s, usualTime(l, s)] as const).filter(([, t]) => t);
  if (times.length) {
    const label: Record<string, string> = { breakfast: 'בוקר', lunch: 'צהריים', dinner: 'ערב' };
    facts.push({ title: 'שעות הארוחות שלך', detail: times.map(([s, t]) => `${label[s]} בסביבות ${t}`).join(', ') + '. התזכורות מותאמות לזה.' });
  }
  return facts;
}
