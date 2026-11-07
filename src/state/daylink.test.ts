import { describe, expect, it } from 'vitest';
import { planDay } from '../engine/menu';
import { periodize } from './daylink';

describe('nutrition x training', () => {
  const profile = { diet: 'omnivore' as const, kosher: false, allergies: [], dislikes: [], mealsPerDay: 4, maxPrepMinutes: 30 };
  const target = { kcal: 2400, protein: 170, fat: 70, carbs: 270 };
  it('post-workout meal carries more protein, pre-workout meal less fat, day totals unchanged', () => {
    let postP = 0, otherP = 0, preFatShare = 0, n = 0, ok = 0;
    for (let d = 1; d <= 20; d++) {
      const date = `2026-12-${String(d).padStart(2, '0')}`;
      const p = planDay({ date, profile, target, workout: { pre: 2, post: 3 }, seed: 'x' });
      const base = planDay({ date, profile, target, seed: 'x' });
      postP += p.meals[3].nutrients.protein;
      otherP += base.meals[3].nutrients.protein;
      preFatShare += p.meals[2].nutrients.fat / p.totals.fat;
      expect(p.meals[2].role).toBe('pre');
      expect(p.meals[3].role).toBe('post');
      n++;
      if (p.withinTolerance) ok++;
    }
    expect(postP / n).toBeGreaterThan(otherP / n);
    expect(preFatShare / n).toBeLessThan(0.2);
    expect(ok / n).toBeGreaterThanOrEqual(0.9);
  });
  it('training days get more carbohydrate, rest days less, same calories', () => {
    const lift = periodize(target, { kind: 'lift', mealTimes: [] }, 80);
    const rest = periodize(target, { kind: 'rest', mealTimes: [] }, 80);
    expect(lift.carbs).toBeGreaterThan(target.carbs);
    expect(rest.carbs).toBeLessThan(target.carbs);
    const kcal = (t: typeof target) => t.protein * 4 + t.carbs * 4 + t.fat * 9;
    expect(Math.abs(kcal(lift) - kcal(target))).toBeLessThan(15);
    expect(Math.abs(kcal(rest) - kcal(target))).toBeLessThan(15);
    expect(lift.fat).toBeGreaterThanOrEqual(0.6 * 80);
  });
});
