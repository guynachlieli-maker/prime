import { planDay, describeAmount, SLOT_LABEL } from '../src/engine/menu';
import { RECIPES } from '../src/data/recipes';
import { FOOD_BY_ID } from '../src/data/foods';
it('sample', () => {
  for (const [kcal, p, meals] of [[1600, 120, 4], [2400, 170, 4], [3200, 200, 5]] as const) {
    const plan = planDay({ date: '2026-11-07', profile: { diet: 'omnivore', allergies: [], kosher: true, maxPrepMinutes: 40, dislikes: [], mealsPerDay: meals }, target: { kcal, protein: p, fat: Math.round(kcal * 0.27 / 9), carbs: Math.round((kcal - p * 4 - kcal * 0.27) / 4) } });
    console.log(`\n=== ${kcal} kcal / ${p}g protein -> ${Math.round(plan.totals.kcal)} / ${Math.round(plan.totals.protein)}`);
    for (const m of plan.meals) {
      const r = RECIPES.find((x) => x.id === m.recipeId)!;
      console.log(`${SLOT_LABEL[m.slot]}: ${r.name} (${Math.round(m.nutrients.kcal)}) :: ` + m.items.map((i) => `${FOOD_BY_ID[i.foodId].name} ${describeAmount(i.foodId, i.grams)}`).join(' | '));
    }
  }
});
