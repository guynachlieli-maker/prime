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
  it('hits ±5% kcal and ±10% protein across 297 profiles (diet × meals × 1400-3600 kcal × days)', () => {
    let ok = 0;
    let n = 0;
    for (const diet of ['omnivore', 'vegetarian', 'vegan'] as const)
      for (const meals of [3, 4, 5])
        for (let kcal = 1400; kcal <= 3600; kcal += 200)
          for (let d = 1; d <= 3; d++) {
            const protein = Math.round((kcal * (diet === 'vegan' ? 0.2 : 0.27)) / 4);
            const fat = Math.round((kcal * 0.27) / 9);
            const carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
            const p = planDay({ date: `2026-11-0${d}`, profile: { ...omer, diet, mealsPerDay: meals, maxPrepMinutes: 60 }, target: { kcal, protein, fat, carbs } });
            n++;
            if (p.withinTolerance) ok++;
          }
    expect(ok / n).toBeGreaterThanOrEqual(0.95);
  });
  it('a typical day is within tolerance', () => {
    const plan = planDay({ date: '2026-11-05', profile: omer, target });
    expect(plan.withinTolerance).toBe(true);
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
    for (const m of plan.meals) for (const it of m.items) expect(it.grams).toBeGreaterThan(0);
    expect(shoppingList([plan]).length).toBeGreaterThan(3);
  });
});

describe('data', () => {
  it('Hebrew search finds common foods', () => {
    expect(searchFoods('חומוס')[0].id).toBe('hummus');
    expect(['schnitzel', 'schnitzel_baked']).toContain(searchFoods('שניצל')[0].id);
  });
  it('every recipe item references a known food', () => {
    const ids = new Set(FOODS.map((f) => f.id));
    for (const r of RECIPES) for (const i of r.items) expect(ids.has(i.foodId)).toBe(true);
  });
  it('foods carry official Ministry of Health values', () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(150);
    for (const f of FOODS) {
      expect(f.source).toBe('moh');
      expect(f.code).toBeGreaterThan(0);
      expect(f.per100g.kcal).toBeGreaterThanOrEqual(0);
      expect(f.per100g.protein + f.per100g.fat + f.per100g.carbs).toBeLessThanOrEqual(101);
    }
    // spot-check a few published values (per 100 g)
    const byId = Object.fromEntries(FOODS.map((f) => [f.id, f]));
    expect(byId.egg.per100g.kcal).toBe(143);
    expect(byId.cottage5.per100g.protein).toBe(11);
    expect(byId.rice_white.per100g.kcal).toBe(130);
  });
  it('has 100+ recipes, each with a known food and a slot', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(100);
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
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
    expect(r.find((x) => x.food.id === 'egg')!.grams).toBeCloseTo(99, 0);
    expect(r.find((x) => x.food.id === 'pita')!.grams).toBe(50);
    expect(r.find((x) => x.food.id === 'bread_whole')!.grams).toBe(32);
  });
  it('reads explicit grams', () => {
    const r = parseFoodText('150 גרם חזה עוף');
    expect(r[0].food.id).toBe('chicken_breast');
    expect(r[0].grams).toBe(150);
  });
});

import { parseAppleHealthXml, parseHealthCsv, parseHeartRate, parseWeight } from './devices';
describe('device import', () => {
  const today = new Date().toISOString().slice(0, 10);
  it('parses Apple Health records without double counting iPhone + Watch', () => {
    const xml = `<HealthData>
<Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" creationDate="${today} 10:00:00 +0200" startDate="${today} 09:00:00 +0200" endDate="${today} 10:00:00 +0200" value="4000"/>
<Record type="HKQuantityTypeIdentifierStepCount" sourceName="Apple Watch" unit="count" startDate="${today} 09:00:00 +0200" endDate="${today} 10:00:00 +0200" value="4200"/>
<Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Apple Watch" unit="count/min" startDate="${today} 07:00:00 +0200" endDate="${today} 07:00:00 +0200" value="54"/>
<Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Health" unit="kg" startDate="${today} 07:05:00 +0200" endDate="${today} 07:05:00 +0200" value="81.4"/>
<Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="${today} 00:30:00 +0200" endDate="${today} 07:00:00 +0200" value="HKCategoryValueSleepAnalysisAsleepCore"/>
</HealthData>`;
    // split mid-record to exercise chunk boundaries
    const d = parseAppleHealthXml([xml.slice(0, 300), xml.slice(300)]);
    expect(d).toHaveLength(1);
    expect(d[0].steps).toBe(4200);
    expect(d[0].restingHr).toBe(54);
    expect(d[0].weightKg).toBe(81.4);
    expect(d[0].sleepHours).toBe(6.5);
  });
  it('parses a Whoop-style CSV by column names', () => {
    const csv = 'Cycle start time,Recovery score %,Resting heart rate (bpm),Heart rate variability (ms),Asleep duration (min)\n2026-11-01 23:10:00,64,52,71,412\n2026-11-02 23:30:00,80,50,85,455';
    const d = parseHealthCsv(csv, 'Whoop');
    expect(d.map((x) => [x.date, x.restingHr, x.hrv, x.sleepHours])).toEqual([
      ['2026-11-01', 52, 71, 6.9],
      ['2026-11-02', 50, 85, 7.6],
    ]);
  });
  it('parses Bluetooth heart-rate and weight packets', () => {
    expect(parseHeartRate(new DataView(new Uint8Array([0x00, 72]).buffer))).toBe(72);
    expect(parseHeartRate(new DataView(new Uint8Array([0x01, 0x2c, 0x01]).buffer))).toBe(300);
    // 80.0 kg = 16000 * 0.005
    expect(parseWeight(new DataView(new Uint8Array([0x00, 0x80, 0x3e]).buffer))).toBeCloseTo(80, 3);
  });
});

import { EMPTY_LEARNING, preferences, photoFactor, recordPhotoCorrection, recordRecipe, recordMealTime, usualTime } from './learning';
describe('learning', () => {
  it('learns preferences from eats and swaps', () => {
    let l = EMPTY_LEARNING;
    for (let i = 0; i < 4; i++) l = recordRecipe(l, 'a', 'eaten');
    for (let i = 0; i < 3; i++) l = recordRecipe(l, 'b', 'swappedOut');
    const p = preferences(l);
    expect(p.a).toBeGreaterThan(0.5);
    expect(p.b).toBeLessThan(-0.5);
  });
  it('calibrates photo estimates only after 3 corrections, within ±25%', () => {
    let l = EMPTY_LEARNING;
    l = recordPhotoCorrection(l, 500, 650);
    l = recordPhotoCorrection(l, 400, 520);
    expect(photoFactor(l)).toBe(1);
    l = recordPhotoCorrection(l, 600, 780);
    expect(photoFactor(l)).toBeCloseTo(1.25, 2);
    for (let i = 0; i < 20; i++) l = recordPhotoCorrection(l, 500, 1000);
    expect(photoFactor(l)).toBe(1.25);
  });
  it('learns usual meal times', () => {
    let l = EMPTY_LEARNING;
    for (const t of ['13:05', '13:20', '12:50']) l = recordMealTime(l, 'lunch', t);
    expect(usualTime(l, 'lunch')).toBe('13:05');
  });
  it('preferences change which recipe is chosen, within targets', () => {
    const base = { date: '2026-11-05', profile: omer, target: { kcal: 2300, protein: 170, fat: 64, carbs: 258 } };
    const p1 = planDay(base);
    const first = p1.meals[0].recipeId;
    const p2 = planDay({ ...base, preferences: { [first]: -1 } });
    expect(p2.meals[0].recipeId).not.toBe(first);
    expect(p2.withinTolerance).toBe(true);
  });
});

describe('search', () => {
  it('returns only matching foods', () => {
    const r = searchFoods('במבה');
    expect(r.length).toBeGreaterThan(0);
    for (const f of r) expect([f.name, ...f.aliases, f.officialName].join(' ')).toContain('במבה');
  });
});

import { foodFromOff, isValidEan } from './barcode';
import nutella from './fixtures/off-nutella.json';
import bamba from './fixtures/off-bamba.json';
describe('barcode', () => {
  it('validates EAN check digits', () => {
    expect(isValidEan('7290000066318')).toBe(true);
    expect(isValidEan('3017620422003')).toBe(true);
    expect(isValidEan('7290000066319')).toBe(false);
  });
  it('reads real Open Food Facts records: an Israeli product and an imported one', () => {
    const b = foodFromOff('7290000066318', bamba.product)!;
    expect(b.name).toContain('במבה');
    expect(b.per100g.kcal).toBe(535);
    expect(b.allergens).toContain('peanuts');
    const n = foodFromOff('3017620422003', nutella.product)!;
    expect(n.name).toContain('Nutella');
    expect(n.per100g.kcal).toBe(539);
    expect(n.verified).toBe(false);
  });
});

describe('target weight pace', () => {
  const base = { name: '', sex: 'male' as const, age: 35, heightCm: 178, weightKg: 92, bodyFatPct: 27, bodyFatSource: 'estimate' as const, activity: 'moderate' as const, trainingDaysPerWeek: 3, strengthTraining: true, sleepHours: 7, goal: 'fat_loss' as const, pace: 'balanced' as const, diet: 'omnivore' as const, kosher: false, allergies: [], dislikes: [], mealsPerDay: 4, maxPrepMinutes: 30, screening: { ...EMPTY_SCREENING } };
  const now = new Date('2026-01-01T12:00:00');
  it('without a date picks a safe default and an ETA', async () => {
    const { planPace } = await import('./pace');
    const p = planPace({ ...base, targetWeightKg: 82 }, now)!;
    expect(p.weeklyKg).toBeLessThan(0);
    expect(p.pctPerWeek).toBeLessThanOrEqual(1);
    expect(p.weeks).toBeGreaterThan(10);
    expect(p.requestedFeasible).toBeNull();
  });
  it('a feasible date sets the pace to reach it', async () => {
    const { planPace } = await import('./pace');
    const p = planPace({ ...base, targetWeightKg: 86, targetDate: '2026-06-01' }, now)!;
    expect(p.requestedFeasible).toBe(true);
    expect(p.etaISO! <= '2026-06-02').toBe(true);
  });
  it('an unsafe date is capped at the safe maximum and explained', async () => {
    const { planPace } = await import('./pace');
    const p = planPace({ ...base, targetWeightKg: 75, targetDate: '2026-02-15' }, now)!;
    expect(p.requestedFeasible).toBe(false);
    expect(p.pctPerWeek).toBeLessThanOrEqual(1.0001);
    expect(p.insight).toContain('הקצב הבטוח');
  });
  it('targets follow the plan and the journey reaches the target', async () => {
    const { simulateJourney } = await import('./forecast');
    const t = computeTargets({ ...base, targetWeightKg: 84 }, { now });
    expect(t.goalPlan?.targetKg).toBe(84);
    const j = simulateJourney({ sex: 'male', age: 35, heightCm: 178, weightKg: 92, bodyFatPct: 27, tdee: t.tdee.value, strengthTraining: true, weeklyKg: t.weeklyChangeKg.value, targetKg: 84 });
    expect(j[j.length - 1].reached).toBe(true);
    expect(j[j.length - 1].weightKg).toBeLessThanOrEqual(84.3);
    expect(j[j.length - 1].bodyFatPct).toBeLessThan(27);
  });
  it('a target below healthy BMI is lifted to BMI 18.5', async () => {
    const { planPace, minHealthyWeight } = await import('./pace');
    const p = planPace({ ...base, weightKg: 70, bodyFatPct: 18, targetWeightKg: 50 }, now)!;
    expect(Math.abs(p.weeklyKg) * p.weeks!).toBeLessThanOrEqual(70 - minHealthyWeight(178) + 1);
  });
});

describe('reminders', () => {
  it('defaults cover meals, weigh-in and motivation, and upcoming() respects days', async () => {
    const { defaultReminders, upcoming, toICS, motivation } = await import('./reminders');
    const list = defaultReminders(4);
    expect(list.filter((r) => r.kind === 'meal')).toHaveLength(4);
    const from = new Date(2026, 0, 4, 6, 0); // Sunday 06:00
    const next = upcoming(list, from, 864e5);
    expect(next[0].r.id).toBe('weigh'); // Sunday 07:30
    expect(next.map((x) => x.r.id)).toContain('meal-breakfast');
    const weigh = upcoming([list.find((r) => r.id === 'weigh')!], from, 7 * 864e5);
    expect(weigh.map((x) => x.at.getDay())).toEqual([0, 3]);
    const ics = toICS(list, from);
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=SU,WE');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).not.toContain('הודעת עידוד');
    const m = motivation({ kcalToday: 900, kcalTarget: 2000, proteinToday: 120, proteinTarget: 140, loggedDaysLast7: 3, trendChangeKg: null, goalLosing: true, kgToGoal: null, weeksToGoal: null, loggedToday: true });
    expect(m.body).toContain('פחות מהיעד');
  });
});
