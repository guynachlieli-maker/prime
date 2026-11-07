import { describe, expect, it } from 'vitest';
import { journeyMarks } from './BodyJourney';
import { simulateJourney } from '../engine/forecast';

describe('body journey checkpoints', () => {
  it('always two different checkpoints, each showing a real change, for short and long goals', () => {
    for (const [weeklyKg, targetKg] of [[-0.8, 80], [-0.7, 80], [-0.6, 76], [-0.5, 70], [-0.9, 60], [-1.0, 77], [0.25, 95]] as const) {
      const path = simulateJourney({ sex: 'male', age: 32, heightCm: 180, weightKg: 86, bodyFatPct: 23, tdee: 2800, strengthTraining: true, weeklyKg, targetKg, maxWeeks: 104 });
      const m = journeyMarks(path);
      const last = path.length - 1;
      expect(m).toHaveLength(3);
      expect(m.map((x) => x.label)).not.toContain('היום');
      expect(new Set(m.map((x) => x.label)).size).toBe(3);
      const kg = [path[0].weightKg, ...m.map((x) => path[x.w].weightKg)];
      const total = Math.abs(kg[3] - kg[0]);
      for (let i = 1; i < 4; i++) expect(Math.abs(kg[i] - kg[i - 1])).toBeGreaterThanOrEqual(total * 0.2);
      expect(m[2].w).toBe(last);
      expect(m[0].w).toBeGreaterThan(0);
      expect(m[0].w).toBeLessThan(m[1].w);
      expect(m[1].w).toBeLessThan(last);
    }
  });
});

describe('body figure widths', () => {
  it('each checkpoint is visibly slimmer than the previous one, for every goal size', async () => {
    const { figureWidths } = await import('./HoloFigure');
    for (const [kg0, bf, target, sex] of [[80, 24, 70, 'male'], [80, 24, 77, 'male'], [100, 32, 75, 'male'], [70, 33, 60, 'female'], [86, 23, 76, 'male']] as const) {
      const path = simulateJourney({ sex, age: 30, heightCm: 178, weightKg: kg0, bodyFatPct: bf, tdee: 2700, strengthTraining: true, weeklyKg: -0.6, targetKg: target, maxWeeks: 104 });
      const marks = journeyMarks(path);
      const base = { sex, heightCm: 178 } as const;
      const today = { ...base, weightKg: kg0, bodyFatPct: bf };
      const end = { ...base, weightKg: path[path.length - 1].weightKg, bodyFatPct: path[path.length - 1].bodyFatPct };
      const w = [figureWidths(today), ...marks.map((m) => figureWidths({ ...base, weightKg: path[m.w].weightKg, bodyFatPct: path[m.w].bodyFatPct }, today, 2.2, end))];
      const waist = w.map((x) => x.belly + x.waist + x.hip);
      const total = waist[0] - waist[3];
      for (let i = 1; i < 4; i++) expect(waist[i - 1] - waist[i]).toBeGreaterThan(total * 0.2);
    }
  });
});
