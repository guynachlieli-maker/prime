import { KCAL_PER_KG_TISSUE } from './targets';

export interface WeighIn {
  date: string; // YYYY-MM-DD
  kg: number;
}

const DAY = 86400000;
const toDay = (d: string) => Math.floor(Date.parse(d + 'T00:00:00Z') / DAY);

/** Exponentially smoothed weight trend (alpha 0.1), one point per calendar day. */
export function weightTrend(weighIns: WeighIn[], alpha = 0.1): { date: string; kg: number; trend: number }[] {
  const byDay = new Map<string, number>();
  for (const w of [...weighIns].sort((a, b) => a.date.localeCompare(b.date))) byDay.set(w.date, w.kg); // last of the day wins
  const days = [...byDay.keys()].sort();
  const out: { date: string; kg: number; trend: number }[] = [];
  let trend: number | null = null;
  let prevDay: number | null = null;
  for (const d of days) {
    const kg = byDay.get(d)!;
    if (trend === null) trend = kg;
    else {
      // account for skipped days: apply the smoothing once per elapsed day
      const gap = Math.max(1, toDay(d) - (prevDay as number));
      const a = 1 - Math.pow(1 - alpha, gap);
      trend = trend + a * (kg - trend);
    }
    prevDay = toDay(d);
    out.push({ date: d, kg, trend: Math.round(trend * 100) / 100 });
  }
  return out;
}

export interface AdaptiveEstimate {
  ready: boolean;
  estimatedTdee?: number;
  suggestedTdee?: number;
  daysLogged: number;
  trendChangeKgPerWeek?: number;
  reason: string;
}

/**
 * Re-estimates the user's real TDEE from logged intake and the weight trend.
 * Requires >=14 days of span, >=10 days with food logged and >=4 weigh-ins.
 * The suggestion blends with the current value and is capped at ±15% per update.
 */
export function estimateTdee(args: {
  intake: { date: string; kcal: number }[];
  weighIns: WeighIn[];
  currentTdee: number;
  windowDays?: number;
}): AdaptiveEstimate {
  const windowDays = args.windowDays ?? 21;
  const trend = weightTrend(args.weighIns);
  if (trend.length < 4) return { ready: false, daysLogged: 0, reason: 'צריך לפחות 4 שקילות כדי לחשב מגמה.' };
  const lastDay = toDay(trend[trend.length - 1].date);
  const windowTrend = trend.filter((t) => lastDay - toDay(t.date) <= windowDays);
  const span = lastDay - toDay(windowTrend[0].date);
  const intakeInWindow = args.intake.filter((i) => i.kcal > 0 && lastDay - toDay(i.date) <= windowDays && lastDay - toDay(i.date) >= 0);
  const daysLogged = intakeInWindow.length;
  if (span < 14) return { ready: false, daysLogged, reason: 'צריך לפחות שבועיים של נתונים.' };
  if (daysLogged < 10) return { ready: false, daysLogged, reason: 'צריך לפחות 10 ימים עם רישום אוכל מלא.' };

  // Least-squares slope of the trend line (kg/day)
  const xs = windowTrend.map((t) => toDay(t.date));
  const ys = windowTrend.map((t) => t.trend);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const avgIntake = intakeInWindow.reduce((a, b) => a + b.kcal, 0) / daysLogged;
  const est = avgIntake - slope * KCAL_PER_KG_TISSUE;
  const blended = 0.5 * args.currentTdee + 0.5 * est;
  const capped = Math.min(args.currentTdee * 1.15, Math.max(args.currentTdee * 0.85, blended));
  return {
    ready: true,
    estimatedTdee: Math.round(est),
    suggestedTdee: Math.round(capped / 10) * 10,
    daysLogged,
    trendChangeKgPerWeek: Math.round(slope * 7 * 100) / 100,
    reason: `ממוצע של ${Math.round(avgIntake)} קק"ל ביום, ומגמת משקל של ${(slope * 7).toFixed(2)} ק"ג בשבוע.`,
  };
}
