import { SAFETY_CONFIG, bmi, evaluateSafety } from './safety';
import { planPace } from './pace';
import type { ActivityLevel, Pace, Profile, Sex, Targets } from './types';

export const KCAL_PER_KG_TISSUE = 7700; // common approximation for mixed tissue

export const ACTIVITY_FACTORS: Record<ActivityLevel, { factor: number; label: string }> = {
  sedentary: { factor: 1.2, label: 'יושבני (עבודה משרדית, כמעט בלי אימונים)' },
  light: { factor: 1.375, label: 'קל (1-3 אימונים בשבוע)' },
  moderate: { factor: 1.55, label: 'בינוני (3-5 אימונים בשבוע)' },
  very: { factor: 1.725, label: 'גבוה (6-7 אימונים בשבוע)' },
  extra: { factor: 1.9, label: 'גבוה מאוד (אימון כפול או עבודה פיזית)' },
};

export function mifflinStJeor(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

export function katchMcArdle(weightKg: number, bodyFatPct: number): number {
  const lbm = weightKg * (1 - bodyFatPct / 100);
  return 370 + 21.6 * lbm;
}

const PACE_LOSS_PCT: Record<Pace, number> = { gentle: 0.25, balanced: 0.5, fast: 0.75 };
const PACE_GAIN_KCAL: Record<Pace, number> = { gentle: 150, balanced: 250, fast: 350 };

export function computeBmr(p: Profile): { value: number; formula: 'mifflin' | 'katch' } {
  const reliableBf = p.bodyFatPct !== undefined && (p.bodyFatSource === 'dexa' || p.bodyFatSource === 'bia');
  if (reliableBf) return { value: Math.round(katchMcArdle(p.weightKg, p.bodyFatPct!)), formula: 'katch' };
  return { value: Math.round(mifflinStJeor(p.sex, p.weightKg, p.heightCm, p.age)), formula: 'mifflin' };
}

export function computeTargets(p: Profile, opts: { tdeeOverride?: number; now?: Date } = {}): Targets {
  const safety = evaluateSafety(p);
  const noDeficit = safety.flags.includes('no_deficit');
  const proteinLimited = safety.flags.includes('protein_limited');
  const bmrRes = computeBmr(p);
  const bmrV = bmrRes.value;
  const factor = ACTIVITY_FACTORS[p.activity].factor;
  const tdeeFormula = Math.round(bmrV * factor);
  const tdeeV = opts.tdeeOverride ? Math.round(opts.tdeeOverride) : tdeeFormula;

  const b = bmi(p.weightKg, p.heightCm);
  let goal = p.goal;
  if (goal === 'health') goal = b >= 25 ? 'fat_loss' : 'performance';
  const pace = p.pace;
  const plan = planPace(p, opts.now);
  if (plan && p.goal !== 'performance') goal = plan.weeklyKg < 0 ? 'fat_loss' : 'muscle_gain';

  let weeklyChange = 0; // kg / week (negative = loss)
  let kcal = tdeeV;
  let goalWhy = '';
  if (noDeficit) {
    kcal = tdeeV;
    goalWhy = 'לפי תשובות שאלון ההתאמה, היעד נשאר ברמת תחזוקה, בלי גירעון קלורי.';
  } else if (plan && goal === 'fat_loss') {
    weeklyChange = plan.weeklyKg;
    kcal = tdeeV + (weeklyChange * KCAL_PER_KG_TISSUE) / 7;
    goalWhy = plan.insight;
  } else if (plan && goal === 'muscle_gain') {
    weeklyChange = plan.weeklyKg;
    kcal = tdeeV + (weeklyChange * KCAL_PER_KG_TISSUE) / 7;
    goalWhy = plan.insight;
  } else if (goal === 'fat_loss') {
    let pct = PACE_LOSS_PCT[pace];
    pct = Math.min(pct, SAFETY_CONFIG.maxWeeklyLossPctOfBodyweight);
    weeklyChange = -(p.weightKg * pct) / 100;
    kcal = tdeeV + (weeklyChange * KCAL_PER_KG_TISSUE) / 7;
    goalWhy = `ירידה של כ-${pct}% ממשקל הגוף בשבוע. זה קצב שמאפשר לשמור על מסת שריר כשמשלבים אימוני כוח וחלבון גבוה.`;
  } else if (goal === 'muscle_gain') {
    const surplus = PACE_GAIN_KCAL[pace];
    kcal = tdeeV + surplus;
    weeklyChange = (surplus * 7) / KCAL_PER_KG_TISSUE;
    goalWhy = `עודף קטן של כ-${surplus} קק"ל ביום. עודף גדול יותר בדרך כלל מוסיף בעיקר שומן ולא שריר.`;
  } else if (goal === 'recomp') {
    kcal = tdeeV * 0.95;
    weeklyChange = ((kcal - tdeeV) * 7) / KCAL_PER_KG_TISSUE;
    goalWhy = 'גירעון קטן מאוד (כ-5%), יחד עם חלבון גבוה ואימוני כוח, כדי להוריד שומן ולבנות שריר במקביל.';
  } else {
    kcal = tdeeV;
    goalWhy = 'יעד ברמת תחזוקה, כדי שיהיה מספיק דלק לאימונים.';
  }

  const floor = Math.max(bmrV, SAFETY_CONFIG.absoluteKcalFloor[p.sex]);
  let floorApplied = false;
  if (kcal < floor) {
    kcal = floor;
    floorApplied = true;
    weeklyChange = ((kcal - tdeeV) * 7) / KCAL_PER_KG_TISSUE;
  }
  kcal = Math.round(kcal / 10) * 10;

  // Protein (ISSN 1.4-2.0 g/kg; higher in a deficit with resistance training)
  let gPerKg =
    goal === 'fat_loss' ? (p.strengthTraining ? 2.0 : 1.6) : goal === 'muscle_gain' ? 1.8 : goal === 'recomp' ? 2.0 : 1.6;
  if (p.goal === 'health') gPerKg = 1.4;
  // For high BMI, scale protein to the weight at BMI 25 (reference weight), a common clinical convention.
  const refWeight = b > 30 ? 25 * (p.heightCm / 100) ** 2 : p.weightKg;
  let proteinG = gPerKg * refWeight;
  let proteinWhy = `${gPerKg} גרם לכל ק"ג${b > 30 ? ' של משקל ייחוס (משקל ב-BMI 25)' : ' משקל גוף'}. זה בתוך הטווח שממליצה עמדת ISSN למתאמנים: 1.4-2.0 גרם לק"ג.`;
  if (proteinLimited) {
    proteinG = 0.8 * p.weightKg;
    proteinWhy = '0.8 גרם לק"ג, ההמלצה הכללית. לא מעלים חלבון במחלת כליות בלי ליווי של דיאטנית.';
  }
  proteinG = Math.round(proteinG);

  // Fat: 25% of energy, never below 0.6 g/kg
  let fatG = Math.round(Math.max((kcal * 0.25) / 9, 0.6 * p.weightKg));
  let carbsG = Math.round((kcal - proteinG * 4 - fatG * 9) / 4);
  if (carbsG < 50) {
    // keep a minimal carb floor by trimming fat towards its floor
    carbsG = 50;
    fatG = Math.round(Math.max((kcal - proteinG * 4 - carbsG * 4) / 9, 0.6 * p.weightKg));
  }
  const fiberG = Math.round((kcal / 1000) * 14);
  const waterMl = p.sex === 'male' ? 2500 : 2000;

  return {
    bmr: {
      value: bmrV,
      why:
        bmrRes.formula === 'katch'
          ? 'חושב לפי נוסחת Katch-McArdle, כי יש לך מדידת אחוז שומן מהימנה. הנוסחה מתאימה יותר למי שיש לו מסת שריר גבוהה.'
          : 'חושב לפי נוסחת Mifflin-St Jeor, הנוסחה שנמצאה מדויקת ביותר לאוכלוסייה הכללית. זו הערכה: אצל אנשים מסוימים ההוצאה בפועל שונה.',
      sources: [bmrRes.formula === 'katch' ? 'katch' : 'mifflin'],
    },
    tdee: {
      value: tdeeV,
      why: opts.tdeeOverride
        ? 'עודכן לפי מה שקרה בפועל: השווינו את הקלוריות שרשמת לשינוי במגמת המשקל שלך.'
        : `חילוף חומרים במנוחה × ${factor} (מקדם פעילות: ${ACTIVITY_FACTORS[p.activity].label}). אחרי שבועיים של רישום, נעדכן לפי הנתונים האמיתיים שלך.`,
      sources: opts.tdeeOverride ? ['hackersDiet', 'mifflin'] : ['mifflin'],
    },
    kcal: {
      value: kcal,
      why: goalWhy + (floorApplied ? ` היעד הועלה לרצפה הבטוחה (${floor} קק"ל). לא יורדים ממנה.` : ''),
      sources: ['hall2011', 'acsmNutrition'],
    },
    proteinG: { value: proteinG, why: proteinWhy, sources: ['issnProtein'] },
    fatG: {
      value: fatG,
      why: 'כ-25% מהאנרגיה, ולא פחות מ-0.6 גרם לק"ג. שומן חשוב לייצור הורמונים ולספיגת ויטמינים.',
      sources: ['acsmNutrition', 'dga'],
    },
    carbsG: {
      value: carbsG,
      why: 'מה שנשאר אחרי חלבון ושומן. פחמימות הן הדלק העיקרי לאימונים בעצימות גבוהה.',
      sources: ['acsmNutrition'],
    },
    fiberG: { value: fiberG, why: '14 גרם סיבים לכל 1,000 קק"ל.', sources: ['dga'] },
    waterMl: {
      value: waterMl,
      why: `ערך הייחוס של EFSA לשתייה כוללת ביום (${waterMl === 2500 ? 'גברים' : 'נשים'}), כולל המים שבאוכל. בימי אימון ובחום צריך יותר.`,
      sources: ['efsaWater'],
    },
    weeklyChangeKg: {
      value: Math.round(weeklyChange * 100) / 100,
      why: 'השינוי הצפוי בשבוע לפי ההפרש בין היעד להוצאה היומית. זו הערכה: בפועל יש תנודות של מים.',
      sources: ['hall2011'],
    },
    floorApplied,
    goalPlan: plan
      ? {
          targetKg: p.targetWeightKg!,
          targetDate: p.targetDate,
          etaISO: floorApplied ? null : plan.etaISO,
          weeks: floorApplied ? null : plan.weeks,
          feasible: plan.requestedFeasible,
          insight: plan.insight,
        }
      : null,
    createdAt: (opts.now ?? new Date()).toISOString(),
  };
}
