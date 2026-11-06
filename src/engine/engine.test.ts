import { describe, expect, it } from 'vitest';
import { computeTargets, mifflinStJeor } from './targets';
import { evaluateSafety, detectBehavior, SAFETY_CONFIG } from './safety';
import { estimateTdee, weightTrend } from './adaptive';
import { forecastBody, navyBodyFat, weeksToTarget } from './forecast';
import { planDay, alternativesFor, eligibleRecipes, shoppingList } from './menu';
import { EMPTY_SCREENING, type Profile } from './types';
import { searchFoods, FOODS } from '../data/foods';
import { RECIPES } from '../data/recipes';
import { SOURCES } from './sources';

const omer: Profile = {
  name: 'עומר',
  sex: 'male',
  age: 32,
  heightCm: 180,
  weightKg: 85,
  bodyFatSource: 'unknown',
  activity: 'moderate',
  trainingDaysPerWeek: 4,
  strengthTraining: true,
  sleepHours: 7,
  goal: 'fat_loss',
  pace: 'balanced',
  diet: 'omnivore',
  kosher: false,
  allergies: [],
  dislikes: [],
  mealsPerDay: 4,
  maxPrepMinutes: 40,
  screening: { ...EMPTY_SCREENING },
};

describe('BMR / targets', () => {
  it('Mifflin-St Jeor matches the published equation', () => {
    expect(mifflinStJeor('male', 85, 180, 32)).toBe(10 * 85 + 6.25 * 180 - 5 * 32 + 5);
    expect(mifflinStJeor('female', 60, 165, 27)).toBe(10 * 60 + 6.25 * 165 - 5 * 27 - 161);
  });

  it('fat loss: ~0.5%/week deficit, protein 2.0 g/kg, macros add up', () => {
    const t = computeTargets(omer);
    expect(t.bmr.value).toBe(1820);
    expect(t.tdee.value).toBe(Math.round(1820 * 1.55));
    expect(t.weeklyChangeKg.value).toBeCloseTo(-0.43, 1);
    expect(t.proteinG.value).toBe(170);
    const kcalFromMacros = t.proteinG.value * 4 + t.fatG.value * 9 + t.carbsG.value * 4;
    expect(Math.abs(kcalFromMacros - t.kcal.value)).toBeLessThan(15);
    for (const k of ['bmr', 'tdee', 'kcal', 'proteinG', 'fatG', 'carbsG', 'fiberG', 'waterMl'] as const) {
      expect(t[k].sources.length).toBeGreaterThan(0);
      for (const s of t[k].sources) expect(SOURCES[s]).toBeDefined();
    }
  });

  it('never goes below the safety floor', () => {
    const small: Profile = { ...omer, sex: 'female', weightKg: 52, heightCm: 158, age: 50, activity: 'sedentary', pace: 'fast' };
    const t = computeTargets(small);
    expect(t.kcal.value).toBeGreaterThanOrEqual(Math.max(t.bmr.value, SAFETY_CONFIG.absoluteKcalFloor.female) - 10);
    expect(t.floorApplied).toBe(true);
  });

  it('weekly loss is capped at 1% bodyweight', () => {
    const t = computeTargets({ ...omer, pace: 'fast', weightKg: 140 });
    expect(Math.abs(t.weeklyChangeKg.value)).toBeLessThanOrEqual(1.4 + 0.01);
  });

  it('Katch-McArdle is used with a DEXA body fat', () => {
    const t = computeTargets({ ...omer, bodyFatPct: 18, bodyFatSource: 'dexa' });
    expect(t.bmr.value).toBe(Math.round(370 + 21.6 * 85 * 0.82));
    expect(t.bmr.sources).toContain('katch');
  });

  it('kidney disease caps protein at 0.8 g/kg', () => {
    const t = computeTargets({ ...omer, screening: { ...EMPTY_SCREENING, kidneyDisease: true } });
    expect(t.proteinG.value).toBe(68);
  });
});

describe('safety', () => {
  it('blocks under 18', () => {
    expect(evaluateSafety({ ...omer, age: 16 }).blocked).toBe(true);
  });
  it('positive SCOFF => no deficit, avatar hidden, maintenance kcal', () => {
    const p = { ...omer, screening: { ...EMPTY_SCREENING, scoffControl: true, scoffBelieveFat: true } };
    const s = evaluateSafety(p);
    expect(s.flags).toContain('no_deficit');
    expect(s.flags).toContain('hide_avatar');
    const t = computeTargets(p);
    expect(t.kcal.value).toBe(Math.round(t.tdee.value / 10) * 10);
  });
  it('low BMI => no deficit', () => {
    expect(evaluateSafety({ ...omer, weightKg: 55 }).flags).toContain('no_deficit');
  });
  it('PAR-Q yes => doctor clearance flag', () => {
    expect(evaluateSafety({ ...omer, screening: { ...EMPTY_SCREENING, parqChestPain: true } }).flags).toContain('needs_doctor_for_training');
  });
  it('detects 3 days under floor and repeated weigh-ins', () => {
    const a = detectBehavior({
      dailyKcal: [
        { date: '2026-11-01', kcal: 900 },
        { date: '2026-11-02', kcal: 950 },
        { date: '2026-11-03', kcal: 800 },
      ],
      floorKcal: 1500,
      weighInsToday: 4,
      weeklyLossPct: null,
    });
    expect(a.map((x) => x.kind).sort()).toEqual(['too_many_weighins', 'under_floor']);
  });
});

describe('adaptive TDEE', () => {
  it('recovers a true TDEE from synthetic data and caps the update', () => {
    const trueTdee = 2600;
    const intake = 2100;
    const weighIns = [];
    const logs = [];
    let w = 85;
    for (let d = 0; d < 21; d++) {
      const date = new Date(Date.UTC(2026, 9, 1 + d)).toISOString().slice(0, 10);
      w += (intake - trueTdee) / 7700;
      weighIns.push({ date, kg: w + Math.sin(d) * 0.3 });
      logs.push({ date, kcal: intake });
    }
    const e = estimateTdee({ intake: logs, weighIns, currentTdee: 2800 });
    expect(e.ready).toBe(true);
    // trend lag biases the estimate slightly; it should still be in the right neighbourhood
    expect(Math.abs((e.estimatedTdee ?? 0) - trueTdee)).toBeLessThan(250);
    expect(e.suggestedTdee!).toBeLessThan(2800);
    expect(e.suggestedTdee!).toBeGreaterThanOrEqual(2800 * 0.85 - 10);
  });
  it('is not ready with too little data', () => {
    expect(estimateTdee({ intake: [], weighIns: [{ date: '2026-11-01', kg: 80 }], currentTdee: 2500 }).ready).toBe(false);
  });
  it('trend smooths noise', () => {
    const t = weightTrend([
      { date: '2026-11-01', kg: 80 },
      { date: '2026-11-02', kg: 82 },
      { date: '2026-11-03', kg: 80 },
    ]);
    expect(t[1].trend).toBeGreaterThan(80);
    expect(t[1].trend).toBeLessThan(81);
  });
});

describe('forecast', () => {
  const base = { sex: 'male' as const, age: 32, heightCm: 180, weightKg: 85, bodyFatPct: 22, tdee: 2800, intakeKcal: 2300, strengthTraining: true, weeks: 12 };
  it('a deficit loses mostly fat, with a range', () => {
    const f = forecastBody(base);
    const last = f[f.length - 1];
    expect(last.weightKg).toBeLessThan(85);
    const fatLost = f[0].fatKg - last.fatKg;
    const leanLost = f[0].leanKg - last.leanKg;
    expect(fatLost).toBeGreaterThan(leanLost * 3);
    expect(last.weightLowKg).toBeLessThanOrEqual(last.weightKg);
    expect(last.weightHighKg).toBeGreaterThanOrEqual(last.weightKg);
  });
  it('maintenance stays flat', () => {
    const f = forecastBody({ ...base, intakeKcal: 2800 });
    expect(Math.abs(f[12].weightKg - 85)).toBeLessThan(0.3);
  });
  it('time-to-target is a range', () => {
    const r = weeksToTarget(base, 80);
    expect(r.earliest).not.toBeNull();
    expect(r.latest!).toBeGreaterThanOrEqual(r.earliest!);
  });
  it('Navy formula gives a plausible value', () => {
    const v = navyBodyFat({ sex: 'male', heightCm: 180, waistCm: 90, neckCm: 38 })!;
    expect(v).toBeGreaterThan(12);
    expect(v).toBeLessThan(25);
  });
});

describe('menu engine', () => {
  const target = { kcal: 2300, protein: 170, fat: 64, carbs: 258 };
  it('builds a day within ±5% kcal for a typical profile', () => {
    let ok = 0;
    for (let d = 1; d <= 14; d++) {
      const plan = planDay({ date: `2026-11-${String(d).padStart(2, '0')}`, profile: omer, target });
      if (Math.abs(plan.deviation.kcalPct) <= 0.05) ok++;
    }
    expect(ok).toBeGreaterThanOrEqual(12);
  });
  it('allergy is a hard exclusion', () => {
    const p = { ...omer, allergies: ['egg' as const, 'dairy' as const] };
    const recipes = eligibleRecipes(p);
    const plan = planDay({ date: '2026-11-05', profile: p, target });
    const ids = plan.meals.map((m) => m.recipeId);
    for (const id of ids) expect(recipes.map((r) => r.id)).toContain(id);
  });
  it('vegan profile only gets vegan recipes', () => {
    const p = { ...omer, diet: 'vegan' as const };
    const plan = planDay({ date: '2026-11-05', profile: p, target: { kcal: 2200, protein: 120, fat: 70, carbs: 270 } });
    expect(plan.meals.length).toBeGreaterThan(0);
    for (const m of plan.meals) expect(eligibleRecipes(p).some((r) => r.id === m.recipeId)).toBe(true);
  });
  it('offers 3 alternatives and a shopping list', () => {
    const plan = planDay({ date: '2026-11-05', profile: omer, target });
    expect(alternativesFor(plan, 0, { profile: omer, target }).length).toBe(3);
    expect(shoppingList([plan]).length).toBeGreaterThan(3);
  });
});

describe('data', () => {
  it('Hebrew search finds common foods', () => {
    expect(searchFoods('חומוס')[0].id).toBe('hummus');
    expect(searchFoods('שניצל')[0].id).toBe('schnitzel');
  });
  it('every recipe item references a known food', () => {
    const ids = new Set(FOODS.map((f) => f.id));
    for (const r of RECIPES) for (const i of r.items) expect(ids.has(i.foodId)).toBe(true);
  });
  it('food macros are internally consistent (Atwater within 20%; low-energy vegetables skipped because total carbs include fiber)', () => {
    for (const f of FOODS) {
      const n = f.per100g;
      const atwater = n.protein * 4 + n.carbs * 4 + n.fat * 9;
      if (n.kcal > 50) expect(Math.abs(atwater - n.kcal) / n.kcal).toBeLessThan(0.2);
    }
  });
});

import { parseFoodText } from './textparse';
describe('free-text parsing', () => {
  it('parses a typical Hebrew sentence with quantities and units', () => {
    const r = parseFoodText('אכלתי שתי ביצים, פרוסה לחם מלא וחצי פיתה עם חומוס');
    const ids = r.map((x) => x.food.id);
    expect(ids).toContain('egg');
    expect(ids).toContain('bread_whole');
    expect(ids).toContain('pita');
    expect(r.find((x) => x.food.id === 'egg')!.grams).toBe(110);
    expect(r.find((x) => x.food.id === 'pita')!.grams).toBe(35);
  });
  it('reads explicit grams', () => {
    const r = parseFoodText('150 גרם חזה עוף');
    expect(r[0].food.id).toBe('chicken_breast');
    expect(r[0].grams).toBe(150);
  });
});
