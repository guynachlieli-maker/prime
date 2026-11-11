import { describe, expect, it } from 'vitest';
import { computeTargets } from '../engine/targets';
import { planPace } from '../engine/pace';
import { eligibleRecipes, planDay, slotsFor } from '../engine/menu';
import { EMPTY_SCREENING, type Allergen, type Goal, type Profile } from '../engine/types';
import { generatePlan, phasePlan, type TrainingGoal, type TrainingPrefs } from '../training/plan';
import { CORE_BY_ID } from '../training/exercises';
import { mealsDone } from './derived';
import { migrate, type MealLog } from './store';
import { phaseMismatch } from '../training/state';
import { parseNum } from '../ui/kit';
import { simulateJourney } from '../engine/forecast';
import { journeyMarks } from '../ui/BodyJourney';

const base: Profile = {
  name: '', sex: 'male', age: 30, heightCm: 178, weightKg: 80, bodyFatPct: 22, bodyFatSource: 'estimate', activity: 'moderate', trainingDaysPerWeek: 3,
  strengthTraining: true, sleepHours: 7, goal: 'fat_loss', pace: 'balanced', diet: 'omnivore', kosher: false, allergies: [], dislikes: [], mealsPerDay: 4,
  maxPrepMinutes: 30, screening: { ...EMPTY_SCREENING },
};
const GOALS: Goal[] = ['fat_loss', 'muscle_gain', 'bulk', 'recomp', 'performance', 'health'];

describe('targets: every profile gets sane numbers', () => {
  it('no NaN, calories never under the floor, macros add up', () => {
    let n = 0;
    for (const sex of ['male', 'female'] as const)
      for (const goal of GOALS)
        for (const weightKg of [45, 60, 80, 110, 150])
          for (const heightCm of [150, 170, 195])
            for (const age of [18, 35, 70])
              for (const target of [undefined, weightKg - 12, weightKg + 6]) {
                const p: Profile = { ...base, sex, goal, weightKg, heightCm, age, bodyFatPct: sex === 'male' ? 20 : 30, targetWeightKg: target };
                const t = computeTargets(p);
                for (const v of [t.kcal.value, t.proteinG.value, t.fatG.value, t.carbsG.value, t.bmr.value, t.tdee.value, t.weeklyChangeKg.value]) expect(Number.isFinite(v)).toBe(true);
                expect(t.kcal.value).toBeGreaterThanOrEqual(sex === 'male' ? 1500 : 1200);
                expect(t.proteinG.value).toBeGreaterThan(30);
                expect(t.carbsG.value).toBeGreaterThanOrEqual(50);
                // never faster than 1% of bodyweight a week
                expect(Math.abs(Math.min(0, t.weeklyChangeKg.value))).toBeLessThanOrEqual(weightKg * 0.0101);
                // a reported target-weight plan always moves the weight in its direction
                if (t.goalPlan) expect(Math.sign(t.weeklyChangeKg.value)).toBe(Math.sign(t.goalPlan.targetKg - weightKg));
                n++;
              }
    expect(n).toBeGreaterThan(1500);
  });

  it('a screening result that forbids a deficit never reports a weight-loss plan', () => {
    const p: Profile = { ...base, sex: 'female', targetWeightKg: 65, screening: { ...EMPTY_SCREENING, pregnantOrBreastfeeding: true } };
    const t = computeTargets(p);
    expect(t.weeklyChangeKg.value).toBe(0);
    expect(t.goalPlan).toBeNull();
  });

  it('underweight: gaining is allowed, losing is not, and a target below the healthy range is lifted', () => {
    const thin: Profile = { ...base, weightKg: 58 }; // BMI 18.3 at 178 cm
    const gain = computeTargets({ ...thin, goal: 'muscle_gain', targetWeightKg: 64 });
    expect(gain.weeklyChangeKg.value).toBeGreaterThan(0);
    expect(gain.kcal.value).toBeGreaterThan(gain.tdee.value);
    expect(gain.goalPlan?.targetKg).toBe(64);
    const lose = computeTargets({ ...thin, goal: 'fat_loss' });
    expect(lose.kcal.value).toBeGreaterThanOrEqual(lose.tdee.value - 10);
    const low = computeTargets({ ...base, weightKg: 62, targetWeightKg: 50 });
    expect(low.goalPlan?.targetKg).toBe(58.6); // BMI 18.5 at 178 cm
  });

  it('the goal date is a local calendar date', () => {
    const now = new Date(2026, 10, 10, 0, 30); // half past midnight, local
    const plan = planPace({ ...base, targetWeightKg: 79 }, now)!;
    const eta = new Date(now.getTime() + (1 / Math.abs(plan.weeklyKg)) * 7 * 864e5);
    expect(plan.etaISO).toBe(`${eta.getFullYear()}-${String(eta.getMonth() + 1).padStart(2, '0')}-${String(eta.getDate()).padStart(2, '0')}`);
  });
});

describe('menu: one meal per slot for every combination of preferences', () => {
  it('never drops a meal, never serves an allergen', () => {
    const allergySets: Allergen[][] = [[], ['gluten'], ['dairy'], ['egg', 'nuts'], ['gluten', 'dairy', 'egg'], ['fish', 'soy', 'sesame', 'peanuts']];
    let n = 0;
    for (const diet of ['omnivore', 'vegetarian', 'vegan'] as const)
      for (const kosher of [false, true])
        for (const allergies of allergySets)
          for (const mealsPerDay of [3, 4, 5])
            for (const maxPrepMinutes of [5, 15, 30]) {
              const profile = { ...base, diet, kosher, allergies, mealsPerDay, maxPrepMinutes };
              const slots = slotsFor(mealsPerDay);
              const plan = planDay({ date: '2026-11-10', profile, target: { kcal: 2200, protein: 150, fat: 70, carbs: 240 }, workout: { pre: 1, post: 2 } });
              const tag = `${diet} kosher=${kosher} [${allergies}] meals=${mealsPerDay} prep=${maxPrepMinutes}`;
              // every meal of the day is there, in order, even when the preferences leave little choice
              expect(plan.meals.map((m) => m.slot), tag).toEqual(slots);
              expect(plan.meals.map((m) => m.slotIndex), tag).toEqual(slots.map((_, i) => i));
              // diet, kosher and allergies are hard limits (preparation time may give way)
              const allowed = new Set(eligibleRecipes({ ...profile, maxPrepMinutes: Infinity }).map((r) => r.id));
              for (const m of plan.meals) expect(allowed.has(m.recipeId), tag + ' ' + m.recipeId).toBe(true);
              n++;
            }
    expect(n).toBe(324);
  });
});

describe('training: every combination builds a usable week', () => {
  it('3+ exercises a day, known exercises, sessions fit the time', () => {
    const goals: TrainingGoal[] = ['cut', 'muscle', 'bulk', 'strength', 'recomp', 'endurance', 'health'];
    for (const goal of goals)
      for (const days of [2, 3, 4, 5, 6])
        for (const minutes of [30, 60, 90])
          for (const equipment of ['gym', 'home_db', 'bands', 'bodyweight'] as const)
            for (const level of ['beginner', 'advanced'] as const)
              for (const limits of [[], ['knee', 'back', 'shoulder']] as TrainingPrefs['limits'][]) {
                const plan = generatePlan({ goal, days, minutes, cardio: 'balanced', cardioTypes: ['run'], equipment, level, limits, time: '18:00' });
                expect(plan.days.length).toBe(days);
                expect(new Set(plan.days.map((d) => d.weekday)).size).toBe(days);
                for (const d of plan.days) {
                  expect(d.exercises.length, `${goal} ${days} ${minutes} ${equipment} ${level} ${limits}`).toBeGreaterThanOrEqual(3);
                  for (const e of d.exercises) expect(CORE_BY_ID[e.exId]).toBeTruthy();
                  expect(d.estMinutes).toBeLessThanOrEqual(Math.max(minutes, 30) + 8);
                }
                for (const c of plan.cardioDays) expect(plan.days.some((d) => d.weekday === c.weekday)).toBe(false);
              }
  });

  it('recomposition keeps a recomposition diet; phases only use known goals', () => {
    expect(phasePlan({ goal: 'recomp', sex: 'male', bodyFatPct: 20, level: 'beginner' })[0].nutritionGoal).toBe('recomp');
    for (const goal of ['cut', 'muscle', 'bulk', 'strength', 'recomp', 'endurance', 'health'] as TrainingGoal[])
      for (const bf of [10, 18, 28, 40])
        for (const ph of phasePlan({ goal, sex: 'female', bodyFatPct: bf, level: 'intermediate' })) expect(GOALS).toContain(ph.nutritionGoal);
  });

  it('a later phase asks to update the diet; a general-fitness plan never does', () => {
    const prefs: TrainingPrefs = { goal: 'bulk', days: 4, minutes: 60, cardio: 'little', cardioTypes: ['walk'], equipment: 'gym', level: 'advanced', limits: [], time: '18:00' };
    const phases = phasePlan({ goal: 'bulk', sex: 'male', bodyFatPct: 14, level: 'advanced' }); // bulk 12 weeks, then a short cut
    const plan = generatePlan(prefs);
    const mk = (goal: Goal, start: string, planGoal: TrainingGoal = 'bulk') => migrate({ version: 1, profile: { ...base, goal }, training: { plan: { ...plan, prefs: { ...prefs, goal: planGoal } }, phases, phaseStart: start, sessions: [] } });
    const now = new Date(2026, 10, 10);
    expect(phaseMismatch(mk('bulk', '2026-11-01'), now)).toBeNull();
    expect(phaseMismatch(mk('bulk', '2026-08-10'), now)?.goal).toBe('fat_loss'); // week 14: the short cut after a 12-week bulk
    expect(phaseMismatch(mk('health', '2026-08-10', 'health'), now)).toBeNull();
  });
});

describe('logging', () => {
  const plan = planDay({ date: '2026-11-10', profile: { ...base, mealsPerDay: 5 }, target: { kcal: 2400, protein: 160, fat: 75, carbs: 260 } });
  const log = (over: Partial<MealLog>): MealLog => ({ id: Math.random().toString(36), date: '2026-11-10', time: '10:00', slot: 'snack', items: [{ foodId: 'protein_powder', name: 'אבקת חלבון', grams: 30 }], method: 'search', nutrients: { kcal: 120, protein: 24, fat: 1, carbs: 3, fiber: 0 }, ...over });

  it('a supplement never marks a meal as eaten', () => {
    expect(mealsDone(plan, [log({ method: 'supplement' })]).some(Boolean)).toBe(false);
  });
  it('one logged snack marks one of the two snacks', () => {
    const d = mealsDone(plan, [log({})]);
    expect(d.filter(Boolean).length).toBe(1);
    expect(plan.meals[d.indexOf(true)].slot).toBe('snack');
  });
  it('the planned dish marks its own meal, on its own day only', () => {
    const lunch = plan.meals.findIndex((m) => m.slot === 'lunch');
    const l = log({ slot: 'lunch', method: 'plan', items: [{ foodId: plan.meals[lunch].recipeId, name: '', grams: 0 }] });
    expect(mealsDone(plan, [l])).toEqual(plan.meals.map((_, i) => i === lunch));
    expect(mealsDone(plan, [{ ...l, date: '2026-11-09' }]).some(Boolean)).toBe(false);
  });
  it('old saved data: supplement logs are recognised, missing fields are filled', () => {
    const old = migrate({ version: 1, profile: { ...base, mealsPerDay: 9, maxPrepMinutes: 0 }, logs: [log({ id: 'a1', method: 'plan' })], suppTaken: { '2026-11-10': { whey: 'a1', creatine: '' } } } as never);
    expect(old.logs[0].method).toBe('supplement');
    expect(old.profile!.mealsPerDay).toBe(5);
    expect(old.profile!.maxPrepMinutes).toBe(30);
    expect(old.weighIns).toEqual([]);
    expect(old.modules.nutrition).toBe(true);
    expect(old.settings.theme).toBe('system');
  });
});

describe('typed numbers', () => {
  it('accepts a decimal comma and a trailing separator', () => {
    expect(parseNum('62,5')).toBe(62.5);
    expect(parseNum('62.')).toBe(62);
    expect(parseNum(' 80 ')).toBe(80);
    expect(Number.isNaN(parseNum(''))).toBe(true);
    expect(Number.isNaN(parseNum('abc'))).toBe(true);
  });
});

describe('body journey: three buttons for any goal', () => {
  it('two checkpoints and the goal, each lighter (or heavier) than the one before', () => {
    for (const [w, target] of [[80, 70], [80, 77], [120, 85], [62, 59], [70, 76], [58, 64]] as const) {
      const p: Profile = { ...base, weightKg: w, targetWeightKg: target, bodyFatPct: w > 100 ? 35 : 22 };
      const t = computeTargets(p);
      const path = simulateJourney({ sex: p.sex, age: p.age, heightCm: p.heightCm, weightKg: w, bodyFatPct: p.bodyFatPct!, tdee: t.tdee.value, strengthTraining: true, weeklyKg: t.weeklyChangeKg.value, targetKg: t.goalPlan?.targetKg, maxWeeks: 104 });
      const marks = journeyMarks(path, t.goalPlan?.weeks ?? undefined);
      expect(marks.length, `${w}->${target}`).toBe(3);
      expect(marks[2].label).toBe('ביעד');
      const kg = marks.map((m) => path[m.w].weightKg);
      const dir = Math.sign(target - w);
      expect(Math.sign(kg[0] - w)).toBe(dir);
      expect(Math.sign(kg[1] - kg[0])).toBe(dir);
      expect(Math.sign(kg[2] - kg[1])).toBe(dir);
    }
  });
});

describe('day plan for a saved state', () => {
  it('plans today without errors and reuses the result', async () => {
    const { planFor } = await import('./derived');
    const s = migrate({ version: 1, profile: { ...base }, startedAt: '2026-11-01T08:00:00Z' });
    s.targets = computeTargets(s.profile!);
    const a = planFor(s, '2026-11-10')!;
    expect(a.meals.length).toBe(4);
    expect(planFor(s, '2026-11-10')).toBe(a);
  });
});
