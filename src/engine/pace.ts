import { SAFETY_CONFIG, bmi } from './safety';
import type { Profile } from './types';

/**
 * Chooses the weekly rate of change from the user's target weight and (optional) target date.
 * Safety first: loss is capped at SAFETY_CONFIG.maxWeeklyLossPctOfBodyweight per week, and leaner
 * people get a gentler cap (lean mass is easier to lose when body fat is low). Gain is capped at
 * 0.5% of bodyweight per week (beyond that most of the gain is fat).
 */
export interface PacePlan {
  weeklyKg: number; // negative = loss
  pctPerWeek: number; // of current bodyweight
  weeks: number | null; // to target
  etaISO: string | null;
  requestedFeasible: boolean | null; // null when no date was given
  insight: string;
}

const DAY = 864e5;

export function minHealthyWeight(heightCm: number): number {
  return Math.round(18.5 * (heightCm / 100) ** 2 * 10) / 10;
}

/** Highest safe loss pace (% bodyweight / week) for this person. */
export function maxLossPct(p: Pick<Profile, 'bodyFatPct' | 'sex' | 'weightKg' | 'heightCm'>): number {
  const bf = p.bodyFatPct ?? 25;
  const lean = p.sex === 'male' ? bf < 15 : bf < 23;
  const veryHigh = p.sex === 'male' ? bf >= 30 : bf >= 38;
  const cap = SAFETY_CONFIG.maxWeeklyLossPctOfBodyweight;
  if (lean) return Math.min(cap, 0.5);
  if (veryHigh || bmi(p.weightKg, p.heightCm) >= 32) return cap;
  return Math.min(cap, 0.75);
}

const fmtDate = (d: Date) => d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function planPace(p: Pick<Profile, 'weightKg' | 'heightCm' | 'sex' | 'bodyFatPct' | 'targetWeightKg' | 'targetDate'>, now = new Date()): PacePlan | null {
  const target = p.targetWeightKg !== undefined ? Math.max(p.targetWeightKg, minHealthyWeight(p.heightCm)) : undefined;
  if (!target || Math.abs(target - p.weightKg) < 0.5) return null;
  const losing = target < p.weightKg;
  const diff = target - p.weightKg;
  const maxPct = losing ? maxLossPct(p) : 0.5;
  const defaultPct = losing ? Math.min(maxPct, (p.bodyFatPct ?? 25) >= (p.sex === 'male' ? 25 : 32) ? 0.75 : 0.5) : 0.25;
  const maxKg = (p.weightKg * maxPct) / 100;

  let weeklyAbs = (p.weightKg * defaultPct) / 100;
  let requestedFeasible: boolean | null = null;
  let insight: string;

  const dateMs = p.targetDate ? Date.parse(p.targetDate + 'T12:00:00') : NaN;
  if (Number.isFinite(dateMs) && dateMs > now.getTime() + 7 * DAY) {
    const weeksAvail = (dateMs - now.getTime()) / (7 * DAY);
    const needed = Math.abs(diff) / weeksAvail;
    if (needed <= maxKg) {
      requestedFeasible = true;
      // a minimum pace keeps progress visible; never slower than 0.15% / week when there is a date
      weeklyAbs = Math.max(needed, (p.weightKg * 0.15) / 100);
      const weeks = Math.abs(diff) / weeklyAbs;
      insight = `כדי להגיע ל-${r1(target)} ק"ג עד ${fmtDate(new Date(dateMs))}, צריך ${losing ? 'לרדת' : 'לעלות'} כ-${r2(weeklyAbs)} ק"ג בשבוע (${r2((weeklyAbs / p.weightKg) * 100)}% ממשקל הגוף). זה בתוך הקצב הבטוח עבורך, ולכן זה הקצב שנבחר. צפי: ${Math.ceil(weeks)} שבועות.`;
    } else {
      requestedFeasible = false;
      weeklyAbs = maxKg;
      const eta = new Date(now.getTime() + (Math.abs(diff) / weeklyAbs) * 7 * DAY);
      insight = `כדי להגיע ל-${r1(target)} ק"ג עד ${fmtDate(new Date(dateMs))} צריך ${losing ? 'לרדת' : 'לעלות'} ${r2(needed)} ק"ג בשבוע. זה מהיר מהקצב הבטוח עבורך (עד ${r2(maxKg)} ק"ג בשבוע), ובקצב מהיר יותר ${losing ? 'יורד גם שריר והסיכוי לחזור למשקל עולה' : 'רוב העלייה היא שומן'}. לכן נבחר הקצב הבטוח המרבי, וצפי ההגעה הוא ${fmtDate(eta)}.`;
    }
  } else {
    insight = losing
      ? `נבחר קצב של כ-${r2(weeklyAbs)} ק"ג בשבוע (${defaultPct}% ממשקל הגוף), שמתאים להרכב הגוף שלך ושומר על מסת השריר.`
      : `נבחר קצב עלייה של כ-${r2(weeklyAbs)} ק"ג בשבוע, כדי שרוב העלייה תהיה שריר ולא שומן.`;
  }
  const weeks = Math.abs(diff) / weeklyAbs;
  const eta = new Date(now.getTime() + weeks * 7 * DAY);
  if (requestedFeasible === null) insight += ` צפי הגעה ליעד: ${fmtDate(eta)} (בערך ${Math.ceil(weeks)} שבועות).`;
  return {
    weeklyKg: losing ? -weeklyAbs : weeklyAbs,
    pctPerWeek: (weeklyAbs / p.weightKg) * 100,
    weeks: Math.ceil(weeks),
    etaISO: eta.toISOString().slice(0, 10),
    requestedFeasible,
    insight,
  };
}
