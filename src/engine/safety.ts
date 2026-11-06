import type { Profile, Screening } from './types';

/**
 * Safety parameters. PENDING CLINICAL APPROVAL: the spec requires the clinical
 * advisor to set the final values. These defaults are conservative placeholders
 * and are surfaced in the UI as "ממתין לאישור קליני".
 */
export const SAFETY_CONFIG = {
  approvedByClinician: false,
  minAge: 18,
  absoluteKcalFloor: { male: 1500, female: 1200 },
  maxWeeklyLossPctOfBodyweight: 1.0,
  minBmiTarget: 18.5,
  minBodyFatPctTarget: { male: 8, female: 16 },
  scoffPositiveThreshold: 2,
  weighInsPerDayAlert: 3,
  daysUnderFloorAlert: 3,
  rescreenEveryWeeks: 12,
} as const;

export type SafetyFlag =
  | 'underage'
  | 'needs_doctor_for_training'
  | 'no_deficit'
  | 'refer_dietitian'
  | 'hide_avatar'
  | 'protein_limited';

export interface SafetyResult {
  blocked: boolean;
  flags: SafetyFlag[];
  reasons: string[];
  scoffScore: number;
}

export function scoffScore(s: Screening): number {
  return [s.scoffSick, s.scoffControl, s.scoffLost6kg, s.scoffBelieveFat, s.scoffFoodDominates].filter(Boolean).length;
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function evaluateSafety(p: Pick<Profile, 'age' | 'weightKg' | 'heightCm' | 'screening'>): SafetyResult {
  const flags = new Set<SafetyFlag>();
  const reasons: string[] = [];
  const s = p.screening;

  if (p.age < SAFETY_CONFIG.minAge) {
    flags.add('underage');
    reasons.push('האפליקציה מיועדת לבני 18 ומעלה.');
    return { blocked: true, flags: [...flags], reasons, scoffScore: scoffScore(s) };
  }

  if (s.parqHeart || s.parqChestPain || s.parqDizziness || s.parqBloodPressureMeds || s.parqJointProblem) {
    flags.add('needs_doctor_for_training');
    reasons.push('ענית "כן" על שאלה בשאלון המוכנות לפעילות. מומלץ לקבל אישור רופא לפני שמתחילים תכנית אימונים.');
  }

  if (s.pregnantOrBreastfeeding) {
    flags.add('no_deficit');
    flags.add('refer_dietitian');
    reasons.push('בהריון או בהנקה לא בונים גירעון קלורי. התפריט מכוון לשמירה, ומומלץ ליווי של דיאטנית.');
  }
  if (s.diabetesInsulin) {
    flags.add('no_deficit');
    flags.add('refer_dietitian');
    reasons.push('בסוכרת שמטופלת באינסולין, שינוי בכמות הפחמימות משפיע על המינון. צריך ליווי של הצוות המטפל.');
  }
  if (s.kidneyDisease) {
    flags.add('protein_limited');
    flags.add('refer_dietitian');
    reasons.push('במחלת כליות לא מעלים חלבון מעבר להמלצה הכללית. היעד מוגבל, ומומלץ ליווי של דיאטנית.');
  }
  if (s.glp1) {
    flags.add('refer_dietitian');
    reasons.push('בטיפול בתרופה מקבוצת GLP-1 התיאבון משתנה. כדאי לתאם את היעדים עם הרופא המטפל.');
  }
  if (s.ibd || s.thyroid) {
    flags.add('refer_dietitian');
    reasons.push('יש מצב רפואי שמשפיע על התזונה. התכנית כללית, ומומלץ להתייעץ עם דיאטנית.');
  }

  const score = scoffScore(s);
  const b = bmi(p.weightKg, p.heightCm);
  if (score >= SAFETY_CONFIG.scoffPositiveThreshold || b < SAFETY_CONFIG.minBmiTarget) {
    flags.add('no_deficit');
    flags.add('hide_avatar');
    reasons.push(
      'חלק מהתשובות מצביעות על כך שמעקב קלוריות עלול לא להיטיב איתך כרגע. במקום ירידה במשקל, נתמקד באכילה מסודרת. אם קשה לך, אפשר לפנות לרופא המשפחה או לקו הסיוע של ער"ן בטלפון 1201.',
    );
  }

  return { blocked: false, flags: [...flags], reasons, scoffScore: score };
}

export interface BehaviorAlert {
  kind: 'under_floor' | 'too_many_weighins' | 'fast_loss';
  message: string;
}

/** Detects risky usage patterns over recent days (spec: "זיהוי דפוסים מסוכנים"). */
export function detectBehavior(args: {
  dailyKcal: { date: string; kcal: number }[];
  floorKcal: number;
  weighInsToday: number;
  weeklyLossPct: number | null;
}): BehaviorAlert[] {
  const alerts: BehaviorAlert[] = [];
  const recent = [...args.dailyKcal].sort((a, b) => a.date.localeCompare(b.date)).slice(-SAFETY_CONFIG.daysUnderFloorAlert);
  if (recent.length === SAFETY_CONFIG.daysUnderFloorAlert && recent.every((d) => d.kcal > 0 && d.kcal < args.floorKcal)) {
    alerts.push({
      kind: 'under_floor',
      message: `שמנו לב שבשלושת הימים האחרונים אכלת פחות מהמינימום הבטוח (${args.floorKcal} קק"ל). שווה לדבר על זה עם דיאטנית. אנחנו כאן כדי לעזור, לא כדי לשפוט.`,
    });
  }
  if (args.weighInsToday >= SAFETY_CONFIG.weighInsPerDayAlert) {
    alerts.push({
      kind: 'too_many_weighins',
      message: 'שקילה אחת ביום בבוקר מספיקה. המשקל משתנה במהלך היום בגלל מים ואוכל, ושקילות חוזרות לא מוסיפות מידע.',
    });
  }
  if (args.weeklyLossPct !== null && args.weeklyLossPct > SAFETY_CONFIG.maxWeeklyLossPctOfBodyweight * 1.5) {
    alerts.push({
      kind: 'fast_loss',
      message: 'הירידה בשבוע האחרון מהירה מהמתוכנן. לא נוריד את היעד יותר. כדאי לוודא שאתה אוכל מספיק.',
    });
  }
  return alerts;
}
