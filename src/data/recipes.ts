import { FOOD_BY_ID } from './foods';
import type { Allergen } from '../engine/types';

export type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Recipe {
  id: string;
  name: string;
  slots: Slot[];
  prepMinutes: number;
  items: { foodId: string; grams: number }[];
  steps: string[];
  approvedBy: string | null; // spec: only dietitian-approved recipes ship. null = pending.
}

const R = (
  id: string,
  name: string,
  slots: Slot[],
  prepMinutes: number,
  items: [string, number][],
  steps: string[],
): Recipe => ({ id, name, slots, prepMinutes, items: items.map(([foodId, grams]) => ({ foodId, grams })), steps, approvedBy: null });

export const RECIPES: Recipe[] = [
  R('shakshuka_bread', 'שקשוקה עם לחם מלא', ['breakfast', 'lunch'], 20, [['shakshuka', 300], ['bread_whole', 60], ['israeli_salad', 150]], ['מחממים רוטב עגבניות במחבת', 'שוברים פנימה ביצים ומכסים עד שהחלבון מתייצב', 'מגישים עם לחם וסלט']),
  R('omelette_cottage', 'חביתה, קוטג׳ וסלט', ['breakfast'], 10, [['egg', 110], ['cottage5', 100], ['bread_whole', 60], ['israeli_salad', 150]], ['מכינים חביתה משתי ביצים', 'מגישים עם קוטג׳, לחם וסלט']),
  R('oats_yogurt', 'דייסת שיבולת עם יוגורט ופירות יער', ['breakfast', 'snack'], 7, [['oats', 50], ['yogurt_greek', 200], ['berries', 100], ['almonds', 15]], ['מבשלים שיבולת במים או במיקרו 2 דקות', 'מוסיפים יוגורט, פירות ושקדים']),
  R('yogurt_granola', 'יוגורט יווני עם גרנולה ובננה', ['breakfast', 'snack'], 3, [['yogurt_greek', 200], ['granola', 40], ['banana', 100]], ['מערבבים הכול בקערה']),
  R('white_cheese_toast', 'טוסט גבינה לבנה וירקות', ['breakfast', 'snack'], 5, [['bread_whole', 60], ['white_cheese5', 80], ['cucumber', 120], ['tomato', 120]], ['מורחים גבינה על הלחם', 'מגישים עם ירקות חתוכים']),
  R('protein_shake', 'שייק חלבון בננה', ['snack', 'breakfast'], 3, [['protein_powder', 30], ['milk3', 240], ['banana', 118], ['peanut_butter', 16]], ['טוחנים הכול בבלנדר']),
  R('chicken_rice_salad', 'חזה עוף, אורז וסלט', ['lunch', 'dinner'], 25, [['chicken_breast', 150], ['rice_white', 160], ['israeli_salad', 150], ['olive_oil', 7]], ['צולים חזה עוף בתיבול', 'מגישים עם אורז וסלט עם שמן זית']),
  R('chicken_sweetpotato', 'פרגיות עם בטטה וברוקולי', ['lunch', 'dinner'], 35, [['chicken_thigh', 150], ['sweet_potato', 200], ['broccoli', 150]], ['אופים פרגיות ובטטה בתנור 30 דקות ב-200 מעלות', 'מאדים ברוקולי ומגישים']),
  R('salmon_quinoa', 'סלמון עם קינואה וירקות', ['lunch', 'dinner'], 25, [['salmon', 150], ['quinoa', 185], ['broccoli', 150]], ['אופים סלמון 15 דקות ב-200 מעלות', 'מגישים עם קינואה וברוקולי']),
  R('beef_pasta', 'פסטה בולונז', ['lunch', 'dinner'], 30, [['beef_lean', 120], ['pasta', 200], ['tomato', 150]], ['מטגנים בשר טחון עם בצל ועגבניות', 'מערבבים עם פסטה מבושלת']),
  R('tuna_salad_pita', 'סלט טונה בפיתה', ['lunch'], 10, [['tuna_water', 112], ['pita', 70], ['israeli_salad', 150], ['olive_oil', 5]], ['מערבבים טונה עם ירקות ושמן', 'ממלאים בפיתה']),
  R('hummus_plate', 'צלחת חומוס עם ביצה', ['lunch'], 10, [['hummus', 150], ['egg', 55], ['pita', 70], ['israeli_salad', 150]], ['מגישים חומוס עם ביצה קשה, פיתה וסלט']),
  R('majadra_yogurt', 'מג׳דרה עם יוגורט וסלט', ['lunch', 'dinner'], 40, [['majadra', 250], ['yogurt_greek', 150], ['israeli_salad', 150]], ['מבשלים עדשים ואורז עם בצל מטוגן', 'מגישים עם יוגורט וסלט']),
  R('tofu_rice', 'טופו מוקפץ עם אורז מלא', ['lunch', 'dinner'], 20, [['tofu', 150], ['rice_brown', 160], ['broccoli', 150], ['olive_oil', 7]], ['מקפיצים טופו וירקות', 'מגישים על אורז מלא']),
  R('lentil_bowl', 'קערת עדשים, בטטה וטחינה', ['lunch', 'dinner'], 30, [['lentils', 200], ['sweet_potato', 150], ['tahini', 15], ['israeli_salad', 150]], ['אופים בטטה', 'מגישים עם עדשים, סלט וטחינה']),
  R('chickpea_salad', 'סלט גרגירי חומוס וקינואה', ['lunch'], 15, [['chickpeas', 150], ['quinoa', 120], ['israeli_salad', 150], ['olive_oil', 7]], ['מערבבים הכול עם לימון ושמן זית']),
  R('turkey_sandwich', 'כריך הודו וירקות', ['lunch', 'snack'], 5, [['bread_whole', 60], ['turkey_breast', 80], ['tomato', 60], ['cucumber', 60]], ['ממלאים כריך בהודו וירקות']),
  R('eggplant_egg_pita', 'פיתה חציל וביצה', ['lunch', 'dinner'], 20, [['pita', 70], ['eggplant_roasted', 150], ['egg', 55], ['tahini', 10]], ['קולים חציל', 'ממלאים פיתה עם חציל, ביצה וטחינה']),
  R('chicken_soup_meal', 'מרק עוף עם קוסקוס', ['dinner'], 60, [['chicken_soup', 350], ['chicken_breast', 100], ['couscous', 120]], ['מבשלים מרק עוף עם ירקות', 'מגישים עם עוף וקוסקוס']),
  R('cottage_dinner', 'ארוחת ערב חלבית', ['dinner', 'breakfast'], 5, [['cottage5', 150], ['bread_whole', 60], ['avocado', 50], ['israeli_salad', 150]], ['מגישים קוטג׳, לחם, אבוקדו וסלט']),
  R('fruit_nuts', 'פרי ואגוזים', ['snack'], 1, [['apple', 180], ['walnuts', 20]], ['פרי וחופן קטן של אגוזים']),
  R('rice_cakes_cottage', 'פריכיות עם קוטג׳', ['snack'], 2, [['rice_cakes', 27], ['cottage5', 100]], ['מורחים קוטג׳ על פריכיות']),
  R('dates_almonds', 'תמרים ושקדים לפני אימון', ['snack'], 1, [['dates', 48], ['almonds', 15]], ['שני תמרים וכמה שקדים, כשעה לפני אימון']),
  R('yogurt_berries', 'יוגורט עם פירות יער', ['snack'], 2, [['yogurt_greek', 200], ['berries', 100]], ['מערבבים']),
];

export function recipeAllergens(r: Recipe): Allergen[] {
  return [...new Set(r.items.flatMap((i) => FOOD_BY_ID[i.foodId]?.allergens ?? []))];
}
export function recipeIsVegan(r: Recipe) {
  return r.items.every((i) => FOOD_BY_ID[i.foodId]?.vegan);
}
export function recipeIsVegetarian(r: Recipe) {
  return r.items.every((i) => FOOD_BY_ID[i.foodId]?.vegetarian);
}
/** Kosher rule used here: no meat and dairy in the same recipe (fish/eggs are parve). */
export function recipeIsKosherCompatible(r: Recipe) {
  const meat = r.items.some((i) => FOOD_BY_ID[i.foodId]?.vegetarian === false && !FOOD_BY_ID[i.foodId]?.allergens.includes('fish'));
  const dairy = r.items.some((i) => FOOD_BY_ID[i.foodId]?.allergens.includes('dairy'));
  return !(meat && dairy);
}
