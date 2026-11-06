import type { Sex } from './types';

export interface BodyParams {
  sex: Sex;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number;
}

/**
 * Shape coefficients derived from height, weight and body fat (and from them, lean mass).
 * The shape follows the numbers; it does not exaggerate change. Exported for tests.
 */
export function bodyShape(p: BodyParams) {
  const H = p.heightCm / 100;
  const bmi = p.weightKg / (H * H);
  const lean = p.weightKg * (1 - p.bodyFatPct / 100);
  const ffmi = lean / (H * H);
  const male = p.sex === 'male';
  const refBf = male ? 15 : 25;
  const refFfmi = male ? 19 : 15.5;
  const girth = Math.pow(bmi / 22, 0.9);
  const fat = (p.bodyFatPct - refBf) / 100;
  const muscle = Math.max(0.9, 1 + (ffmi - refFfmi) * 0.03);
  const s = H / 1.75;
  return {
    H,
    fat,
    muscle,
    shoulder: (male ? 0.205 : 0.178) * s * girth * muscle,
    chest: (male ? 0.165 : 0.152) * s * girth * (1 + fat * 0.9) * Math.max(0.92, muscle),
    waist: (male ? 0.136 : 0.12) * s * girth * (1 + fat * (male ? 3.6 : 2.4)),
    belly: (male ? 0.14 : 0.126) * s * girth * (1 + fat * (male ? 4.4 : 3.0)),
    hip: (male ? 0.156 : 0.176) * s * girth * (1 + fat * (male ? 1.6 : 2.4)),
    thigh: (male ? 0.074 : 0.08) * s * girth * (1 + fat * 1.9) * muscle,
    calf: (male ? 0.05 : 0.048) * s * girth * (1 + fat * 0.6) * muscle,
    arm: (male ? 0.047 : 0.041) * s * girth * (1 + fat * 1.7) * muscle,
    neck: (male ? 0.056 : 0.048) * s * Math.max(0.9, girth * 0.95),
  };
}

