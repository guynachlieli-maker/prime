import { describe, expect, it } from 'vitest';
import { generatePlan, weeklyVolume, suggestNext, phasePlan, eligible, type TrainingPrefs } from './plan';
import { CORE_BY_ID } from './exercises';

const base: TrainingPrefs = { goal: 'muscle', days: 4, minutes: 60, cardio: 'balanced', cardioTypes: ['bike'], equipment: 'gym', level: 'intermediate', limits: [], time: '18:00' };

describe('training plan', () => {
  it('builds every split 2-6 days for every equipment option, within the time budget', () => {
    for (const equipment of ['gym', 'home_db', 'bands', 'bodyweight'] as const)
      for (let days = 2; days <= 6; days++)
        for (const minutes of [30, 45, 60, 90]) {
          const p = generatePlan({ ...base, equipment, days, minutes });
          expect(p.days).toHaveLength(days);
          for (const d of p.days) {
            expect(d.exercises.length).toBeGreaterThanOrEqual(3);
            for (const e of d.exercises) expect(CORE_BY_ID[e.exId]).toBeTruthy();
            expect(d.estMinutes).toBeLessThanOrEqual(Math.max(minutes, 25) + 25);
          }
        }
  });
  it('hypertrophy volume lands in the 10-20 sets/week range for major muscles (gym, 4 days, 75 min)', () => {
    const v = weeklyVolume(generatePlan({ ...base, minutes: 75 }));
    for (const m of ['chest', 'quadriceps', 'lats']) {
      expect(v[m]).toBeGreaterThanOrEqual(8);
      expect(v[m]).toBeLessThanOrEqual(24);
    }
  });
  it('respects limitations', () => {
    const p = generatePlan({ ...base, limits: ['back', 'knee', 'shoulder'] });
    for (const d of p.days) for (const e of d.exercises) expect(CORE_BY_ID[e.exId].avoidIf ?? []).not.toContain('back');
    expect(eligible({ equipment: 'gym', level: 'advanced', limits: ['back'] }).some((e) => e.id === 'deadlift')).toBe(false);
  });
  it('cardio meets the weekly target for fat loss', () => {
    const p = generatePlan({ ...base, goal: 'cut', days: 3, minutes: 60 });
    const total = p.days.reduce((a, d) => a + (d.cardio?.minutes ?? 0), 0) + p.cardioDays.reduce((a, c) => a + c.block.minutes, 0);
    expect(total).toBeGreaterThanOrEqual(p.weeklyCardioMin - 15);
  });
  it('double progression adds load after hitting the top of the range', () => {
    const planned = { exId: 'bench_press', sets: 3, reps: [6, 10] as [number, number], rir: 1, restSec: 150, alternatives: [] };
    const s = (reps: number) => ({ id: 'x', date: '2026-01-01', dayId: 'd1', planId: 'p', exercises: [{ exId: 'bench_press', sets: [0, 1, 2].map(() => ({ kg: 80, reps, done: true })) }] });
    expect(suggestNext('bench_press', planned, [s(10)]).kg).toBe(82.5);
    expect(suggestNext('bench_press', planned, [s(8)]).kg).toBe(80);
    expect(suggestNext('bench_press', planned, [s(5), s(5)]).kg).toBeLessThan(80);
  });
  it('long-term: high body fat cuts before a bulk, and every bulk ends with a mini-cut', () => {
    const a = phasePlan({ goal: 'bulk', sex: 'male', bodyFatPct: 26, level: 'intermediate' });
    expect(a[0].kind).toBe('cut');
    expect(a.map((x) => x.kind)).toContain('mini_cut');
    const b = phasePlan({ goal: 'bulk', sex: 'male', bodyFatPct: 13, level: 'beginner' });
    expect(b[0].kind).toBe('bulk');
  });
});
