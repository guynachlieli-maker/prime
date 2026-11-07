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
