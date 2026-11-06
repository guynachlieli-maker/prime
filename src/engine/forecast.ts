import { mifflinStJeor } from './targets';
import type { Sex } from './types';

/**
 * Body-composition forecast.
 * Energy balance drives the change; the split between fat mass (FM) and fat-free mass (FFM)
 * follows the Forbes relation dFFM/dFM = C / FM (C = 10.4 kg), as used in Hall's models.
 * Energy densities: fat 9440 kcal/kg, fat-free mass 1816 kcal/kg (Hall 2008/2011).
 *
 * ASSUMPTIONS (flagged for the scientific committee):
 *  - Resistance training + high protein halves lean-mass loss in a deficit (leanSparing = 0.5).
 *  - In a surplus with resistance training, half of the gained mass is lean (gainLeanShare = 0.5).
 *  - TDEE scales with the Mifflin BMR as weight changes (no extra adaptive thermogenesis term).
 *  - Uncertainty band: ±10% on the true TDEE.
 */
const RHO_F = 9440;
const RHO_L = 1816;
const FORBES_C = 10.4;

export interface ForecastInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number;
  tdee: number;
  intakeKcal: number;
  strengthTraining: boolean;
  weeks: number;
}

export interface ForecastPoint {
  week: number;
  weightKg: number;
  fatKg: number;
  leanKg: number;
  bodyFatPct: number;
  weightLowKg: number;
  weightHighKg: number;
}

function simulate(inp: ForecastInput, tdeeScale: number): { weightKg: number; fatKg: number; leanKg: number }[] {
  let fm = inp.weightKg * (inp.bodyFatPct / 100);
  let ffm = inp.weightKg - fm;
  const bmr0 = mifflinStJeor(inp.sex, inp.weightKg, inp.heightCm, inp.age);
  const actFactor = (inp.tdee * tdeeScale) / bmr0;
  const out = [{ weightKg: fm + ffm, fatKg: fm, leanKg: ffm }];
  for (let day = 1; day <= inp.weeks * 7; day++) {
    const w = fm + ffm;
    const tdee = mifflinStJeor(inp.sex, w, inp.heightCm, inp.age) * actFactor;
    const eb = inp.intakeKcal - tdee;
    let dF: number;
    let dL: number;
    if (eb < 0) {
      const k = inp.strengthTraining ? 0.5 : 1;
      const ratio = (k * FORBES_C) / Math.max(fm, 2);
      dF = eb / (RHO_F + RHO_L * ratio);
      dL = ratio * dF;
    } else {
      const leanShare = inp.strengthTraining ? 0.5 : FORBES_C / (FORBES_C + Math.max(fm, 2));
      const dm = eb / (leanShare * RHO_L + (1 - leanShare) * RHO_F);
      dL = leanShare * dm;
      dF = (1 - leanShare) * dm;
    }
    fm = Math.max(fm + dF, 1);
    ffm = ffm + dL;
    if (day % 7 === 0) out.push({ weightKg: fm + ffm, fatKg: fm, leanKg: ffm });
  }
  return out;
}

export function forecastBody(inp: ForecastInput): ForecastPoint[] {
  const mid = simulate(inp, 1);
  const lowTdee = simulate(inp, 0.9); // body burns less => heavier
  const highTdee = simulate(inp, 1.1); // body burns more => lighter
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return mid.map((m, i) => {
    const a = lowTdee[i].weightKg;
    const b = highTdee[i].weightKg;
    return {
      week: i,
      weightKg: r1(m.weightKg),
      fatKg: r1(m.fatKg),
      leanKg: r1(m.leanKg),
      bodyFatPct: r1((m.fatKg / m.weightKg) * 100),
      weightLowKg: r1(Math.min(a, b)),
      weightHighKg: r1(Math.max(a, b)),
    };
  });
}

/** First week index where the forecast reaches the target weight, as a [earliest, latest] range. */
export function weeksToTarget(inp: ForecastInput, targetKg: number, maxWeeks = 104): { earliest: number | null; latest: number | null } {
  const losing = targetKg < inp.weightKg;
  const reached = (w: number) => (losing ? w <= targetKg : w >= targetKg);
  const find = (scale: number) => {
    const s = simulate({ ...inp, weeks: maxWeeks }, scale);
    const idx = s.findIndex((p) => reached(p.weightKg));
    return idx < 0 ? null : idx;
  };
  const fast = find(losing ? 1.1 : 0.9);
  const slow = find(losing ? 0.9 : 1.1);
  return { earliest: fast, latest: slow };
}

/** Rough body-fat estimate when the user does not know it (Deurenberg BMI equation). Flagged as estimate. */
export function estimateBodyFatFromBmi(sex: Sex, age: number, bmiValue: number): number {
  const v = 1.2 * bmiValue + 0.23 * age - 10.8 * (sex === 'male' ? 1 : 0) - 5.4;
  return Math.round(Math.min(55, Math.max(5, v)) * 10) / 10;
}

/** U.S. Navy circumference method (cm). */
export function navyBodyFat(args: { sex: Sex; heightCm: number; waistCm: number; neckCm: number; hipCm?: number }): number | null {
  const { sex, heightCm, waistCm, neckCm, hipCm } = args;
  if (sex === 'male') {
    if (waistCm - neckCm <= 0) return null;
    const v = 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450;
    return Math.round(v * 10) / 10;
  }
  if (!hipCm || waistCm + hipCm - neckCm <= 0) return null;
  const v = 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450;
  return Math.round(v * 10) / 10;
}

export interface JourneyPoint {
  week: number;
  weightKg: number;
  bodyFatPct: number;
  reached: boolean;
}

/**
 * The path to the target the way the app actually runs it: each week the calorie target is
 * re-computed from the current weight, so the pace stays close to the planned weekly change until
 * the target is reached, then intake returns to maintenance. Fat / lean split follows Forbes.
 */
export function simulateJourney(inp: Omit<ForecastInput, 'intakeKcal' | 'weeks'> & { weeklyKg: number; targetKg?: number; maxWeeks?: number; kcalFloor?: number }): JourneyPoint[] {
  let fm = inp.weightKg * (inp.bodyFatPct / 100);
  let ffm = inp.weightKg - fm;
  const bmr0 = mifflinStJeor(inp.sex, inp.weightKg, inp.heightCm, inp.age);
  const actFactor = inp.tdee / bmr0;
  const maxWeeks = inp.maxWeeks ?? 104;
  const losing = inp.weeklyKg < 0;
  const target = inp.targetKg;
  const hit = (w: number) => target !== undefined && (losing ? w <= target : w >= target);
  const out: JourneyPoint[] = [{ week: 0, weightKg: inp.weightKg, bodyFatPct: inp.bodyFatPct, reached: false }];
  let reached = false;
  for (let day = 1; day <= maxWeeks * 7; day++) {
    const w = fm + ffm;
    const tdee = mifflinStJeor(inp.sex, w, inp.heightCm, inp.age) * actFactor;
    if (!reached && hit(w)) reached = true;
    let intake = reached ? tdee : tdee + (inp.weeklyKg * 7700) / 7;
    if (inp.kcalFloor) intake = Math.max(intake, inp.kcalFloor);
    const eb = intake - tdee;
    let dF: number;
    let dL: number;
    if (eb < 0) {
      const k = inp.strengthTraining ? 0.5 : 1;
      const ratio = (k * FORBES_C) / Math.max(fm, 2);
      dF = eb / (RHO_F + RHO_L * ratio);
      dL = ratio * dF;
    } else {
      const leanShare = inp.strengthTraining ? 0.5 : FORBES_C / (FORBES_C + Math.max(fm, 2));
      const dm = eb / (leanShare * RHO_L + (1 - leanShare) * RHO_F);
      dL = leanShare * dm;
      dF = (1 - leanShare) * dm;
    }
    fm = Math.max(fm + dF, 1);
    ffm += dL;
    if (day % 7 === 0) {
      const wk = fm + ffm;
      out.push({ week: day / 7, weightKg: Math.round(wk * 10) / 10, bodyFatPct: Math.round((fm / wk) * 1000) / 10, reached });
      if (reached) break;
    }
  }
  return out;
}
