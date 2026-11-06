import { planDay } from '../src/engine/menu';
import { RECIPES } from '../src/data/recipes';
it('sweep', () => {
  console.log('RECIPES', RECIPES.length);
  const res: Record<string, number[]> = {};
  let bad: string[] = [];
  for (const diet of ['omnivore', 'vegetarian', 'vegan'] as const)
    for (const meals of [3, 4, 5])
      for (let kcal = 1400; kcal <= 3600; kcal += 200)
        for (let d = 1; d <= 4; d++) {
          const protein = Math.round(kcal * (diet === 'vegan' ? 0.2 : 0.27) / 4);
          const fat = Math.round(kcal * 0.27 / 9);
          const carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
          const t0 = Date.now();
          const p = planDay({ date: `2026-11-0${d}`, profile: { diet, allergies: [], kosher: false, maxPrepMinutes: 60, dislikes: [], mealsPerDay: meals }, target: { kcal, protein, fat, carbs } });
          const key = diet;
          (res[key] ??= []).push(Math.abs(p.deviation.kcalPct) <= 0.05 && Math.abs(p.deviation.proteinPct) <= 0.1 ? 1 : 0);
          (res['ms'] ??= []).push(Date.now() - t0);
          if (!(Math.abs(p.deviation.kcalPct) <= 0.05 && Math.abs(p.deviation.proteinPct) <= 0.1)) bad.push(`${diet} m${meals} ${kcal} k${(p.deviation.kcalPct*100).toFixed(1)} p${(p.deviation.proteinPct*100).toFixed(1)}`);
        }
  for (const [k, v] of Object.entries(res)) console.log('SWEEP', k, k === 'ms' ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) + 'ms avg, max ' + Math.max(...v) : (v.reduce((a, b) => a + b, 0) / v.length * 100).toFixed(1) + '%');
  console.log('BAD', bad.slice(0, 40).join('\n'));
});
