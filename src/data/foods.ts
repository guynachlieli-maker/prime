import type { Allergen, Nutrients } from '../engine/types';

/**
 * DEVELOPMENT FOOD TABLE.
 * Values per 100 g are approximations of generic reference values (USDA FoodData Central style)
 * typed in for development. Per the spec, every row must be replaced with the verified value
 * from the Israeli Ministry of Health database (Tzameret) or USDA FDC, and approved by the
 * team dietitian, before launch. `verified: false` is shown to the user as "ערך לבדיקה".
 */
export interface Food {
  id: string;
  name: string;
  aliases: string[];
  per100g: Nutrients;
  units: { label: string; grams: number }[];
  allergens: Allergen[];
  vegan: boolean;
  vegetarian: boolean;
  category: 'protein' | 'grain' | 'dairy' | 'veg' | 'fruit' | 'fat' | 'dish' | 'snack' | 'drink' | 'legume';
  source: 'dev-approx';
  verified: boolean;
}

type Row = [
  id: string,
  name: string,
  aliases: string,
  kcal: number,
  protein: number,
  fat: number,
  carbs: number,
  fiber: number,
  units: string,
  allergens: string,
  diet: 'vg' | 'v' | 'o',
  category: Food['category'],
];

// units: "label:grams|label:grams"
const ROWS: Row[] = [
  ['egg', 'ביצה', 'ביצים,ביצה קשה,חביתה', 143, 12.6, 9.5, 0.7, 0, 'ביצה אחת:55', 'egg', 'v', 'protein'],
  ['chicken_breast', 'חזה עוף צלוי', 'חזה עוף,עוף', 165, 31, 3.6, 0, 0, 'מנה:150|נתח:120', '', 'o', 'protein'],
  ['chicken_thigh', 'פרגית צלויה', 'פרגיות,ירך עוף', 209, 26, 10.9, 0, 0, 'מנה:150', '', 'o', 'protein'],
  ['turkey_breast', 'חזה הודו', 'הודו,פסטרמה הודו', 135, 29, 1.5, 0, 0, 'מנה:150|פרוסה:20', '', 'o', 'protein'],
  ['beef_lean', 'בקר טחון רזה מבושל', 'בשר טחון,בקר', 217, 26, 12, 0, 0, 'מנה:150', '', 'o', 'protein'],
  ['salmon', 'סלמון אפוי', 'סלמון,דג', 206, 22, 12.4, 0, 0, 'נתח:150', 'fish', 'o', 'protein'],
  ['tuna_water', 'טונה במים', 'טונה,קופסת טונה', 116, 25.5, 0.8, 0, 0, 'קופסה מסוננת:112', 'fish', 'o', 'protein'],
  ['tofu', 'טופו', 'טופו קשה', 144, 15.6, 8.7, 2.8, 2.3, 'מנה:120', 'soy', 'vg', 'protein'],
  ['cottage5', 'קוטג׳ 5%', 'קוטג,גבינת קוטג׳', 98, 11, 5, 3, 0, 'כף:30|גביע:250', 'dairy', 'v', 'dairy'],
  ['white_cheese5', 'גבינה לבנה 5%', 'גבינה לבנה', 95, 9, 5, 4, 0, 'כף:30|גביע:250', 'dairy', 'v', 'dairy'],
  ['yogurt_greek', 'יוגורט יווני 2%', 'יוגורט,יווני', 73, 10, 2, 3.9, 0, 'גביע:200', 'dairy', 'v', 'dairy'],
  ['yellow_cheese', 'גבינה צהובה 28%', 'גבינה צהובה,צהובה', 350, 26, 28, 0.5, 0, 'פרוסה:20', 'dairy', 'v', 'dairy'],
  ['milk3', 'חלב 3%', 'חלב', 60, 3.3, 3, 4.7, 0, 'כוס:240', 'dairy', 'v', 'drink'],
  ['labaneh', 'לבנה', 'לאבנה', 160, 6, 13, 4, 0, 'כף:30', 'dairy', 'v', 'dairy'],
  ['bread_whole', 'לחם מחיטה מלאה', 'לחם,לחם מלא', 247, 13, 3.4, 41, 7, 'פרוסה:30', 'gluten', 'vg', 'grain'],
  ['pita', 'פיתה', 'פיתות', 275, 9, 1.2, 55.7, 2.2, 'פיתה שלמה:70|חצי פיתה:35', 'gluten', 'vg', 'grain'],
  ['rice_white', 'אורז לבן מבושל', 'אורז', 130, 2.7, 0.3, 28, 0.4, 'כוס:160|כף:15', '', 'vg', 'grain'],
  ['rice_brown', 'אורז מלא מבושל', 'אורז מלא', 123, 2.7, 1, 25.6, 1.6, 'כוס:160', '', 'vg', 'grain'],
  ['pasta', 'פסטה מבושלת', 'פסטה,ספגטי', 158, 5.8, 0.9, 31, 1.8, 'כוס:140', 'gluten', 'vg', 'grain'],
  ['oats', 'שיבולת שועל', 'קוואקר,דייסה,שיבולת', 379, 13, 6.5, 67.7, 10, 'כף:10|חצי כוס:40', 'gluten', 'vg', 'grain'],
  ['quinoa', 'קינואה מבושלת', 'קינואה', 120, 4.4, 1.9, 21.3, 2.8, 'כוס:185', '', 'vg', 'grain'],
  ['couscous', 'קוסקוס מבושל', 'קוסקוס', 112, 3.8, 0.2, 23.2, 1.4, 'כוס:157', 'gluten', 'vg', 'grain'],
  ['bulgur', 'בורגול מבושל', 'בורגול', 83, 3.1, 0.2, 18.6, 4.5, 'כוס:180', 'gluten', 'vg', 'grain'],
  ['potato', 'תפוח אדמה אפוי', 'תפו"א,תפוח אדמה', 93, 2.5, 0.1, 21, 2.2, 'בינוני:170', '', 'vg', 'veg'],
  ['sweet_potato', 'בטטה אפויה', 'בטטה', 90, 2, 0.2, 20.7, 3.3, 'בינונית:150', '', 'vg', 'veg'],
  ['hummus', 'חומוס (ממרח)', 'חומוס,ממרח חומוס', 166, 7.9, 9.6, 14.3, 6, 'כף:20|צלחת:150', 'sesame', 'vg', 'dish'],
  ['tahini', 'טחינה גולמית', 'טחינה', 595, 17, 53.8, 21, 9.3, 'כף:15', 'sesame', 'vg', 'fat'],
  ['falafel', 'פלאפל', 'כדור פלאפל', 333, 13.3, 17.8, 31.8, 4.9, 'כדור:17', '', 'vg', 'dish'],
  ['shakshuka', 'שקשוקה', 'שקשוקה', 110, 6.5, 7.5, 4.5, 1.2, 'מנה:300', 'egg', 'v', 'dish'],
  ['schnitzel', 'שניצל עוף מטוגן', 'שניצל', 250, 20, 13, 13, 0.7, 'שניצל:130', 'gluten,egg', 'o', 'dish'],
  ['burekas_cheese', 'בורקס גבינה', 'בורקס', 340, 8, 21, 30, 1, 'יחידה:90', 'gluten,dairy,egg', 'v', 'dish'],
  ['sabich', 'סביח בפיתה', 'סביח', 220, 7, 11, 23, 3, 'מנה:350', 'gluten,egg,sesame', 'v', 'dish'],
  ['majadra', 'מג׳דרה', 'מגדרה,מג׳דרה', 150, 5.5, 4, 23, 4, 'כוס:200', '', 'vg', 'dish'],
  ['lentils', 'עדשים מבושלות', 'עדשים', 116, 9, 0.4, 20, 7.9, 'כוס:200', '', 'vg', 'legume'],
  ['chickpeas', 'חומוס גרגירים מבושל', 'גרגירי חומוס', 164, 8.9, 2.6, 27.4, 7.6, 'כוס:165', '', 'vg', 'legume'],
  ['beans_white', 'שעועית לבנה מבושלת', 'שעועית', 139, 9.7, 0.4, 25, 6.3, 'כוס:180', '', 'vg', 'legume'],
  ['israeli_salad', 'סלט ירקות קצוץ', 'סלט ישראלי,סלט', 25, 1, 0.2, 5, 1.5, 'קערית:150', '', 'vg', 'veg'],
  ['cucumber', 'מלפפון', 'מלפפונים', 15, 0.7, 0.1, 3.6, 0.5, 'יחידה:120', '', 'vg', 'veg'],
  ['tomato', 'עגבנייה', 'עגבניות', 18, 0.9, 0.2, 3.9, 1.2, 'יחידה:120', '', 'vg', 'veg'],
  ['broccoli', 'ברוקולי מאודה', 'ברוקולי', 35, 2.4, 0.4, 7.2, 3.3, 'כוס:150', '', 'vg', 'veg'],
  ['avocado', 'אבוקדו', 'אבוקדו', 160, 2, 14.7, 8.5, 6.7, 'חצי:75', '', 'vg', 'fat'],
  ['olive_oil', 'שמן זית', 'שמן', 884, 0, 100, 0, 0, 'כפית:5|כף:13', '', 'vg', 'fat'],
  ['almonds', 'שקדים', 'שקדים טבעיים', 579, 21, 50, 21.6, 12.5, 'חופן:28', 'nuts', 'vg', 'fat'],
  ['walnuts', 'אגוזי מלך', 'אגוזים', 654, 15, 65, 13.7, 6.7, 'חופן:28', 'nuts', 'vg', 'fat'],
  ['peanut_butter', 'חמאת בוטנים', 'חמאת בוטנים', 588, 25, 50, 20, 6, 'כף:16', 'peanuts', 'vg', 'fat'],
  ['banana', 'בננה', 'בננות', 89, 1.1, 0.3, 22.8, 2.6, 'בינונית:118', '', 'vg', 'fruit'],
  ['apple', 'תפוח', 'תפוח עץ', 52, 0.3, 0.2, 13.8, 2.4, 'בינוני:180', '', 'vg', 'fruit'],
  ['orange', 'תפוז', 'תפוזים', 47, 0.9, 0.1, 11.8, 2.4, 'בינוני:130', '', 'vg', 'fruit'],
  ['dates', 'תמרים מג׳הול', 'תמר,תמרים', 277, 1.8, 0.2, 75, 6.7, 'יחידה:24', '', 'vg', 'fruit'],
  ['berries', 'פירות יער', 'תות,אוכמניות', 50, 0.8, 0.3, 12, 2.5, 'כוס:150', '', 'vg', 'fruit'],
  ['protein_powder', 'אבקת חלבון מי גבינה', 'אבקת חלבון,שייק חלבון,וואי', 380, 78, 6, 7, 0, 'סקופ:30', 'dairy', 'v', 'protein'],
  ['granola', 'גרנולה', 'גרנולה', 471, 10, 20, 64, 7, 'חצי כוס:50', 'gluten,nuts', 'vg', 'grain'],
  ['coffee_milk', 'קפה הפוך', 'הפוך,קפוצ׳ינו', 45, 2.5, 2.3, 3.7, 0, 'כוס:240', 'dairy', 'v', 'drink'],
  ['dark_chocolate', 'שוקולד מריר 70%', 'שוקולד', 598, 7.8, 42.6, 45.9, 10.9, 'קוביה:10', 'dairy', 'v', 'snack'],
  ['bamba', 'במבה', 'במבה', 534, 15, 32, 46, 4, 'שקית קטנה:25', 'peanuts', 'vg', 'snack'],
  ['rice_cakes', 'פריכיות אורז', 'פריכית', 387, 8, 2.8, 81.5, 4.2, 'פריכית:9', '', 'vg', 'snack'],
  ['eggplant_roasted', 'חציל קלוי', 'חציל', 35, 0.8, 0.2, 8.7, 2.5, 'חצי חציל:150', '', 'vg', 'veg'],
  ['shawarma', 'שווארמה הודו', 'שווארמה', 230, 24, 13, 3, 0.5, 'מנה:150', '', 'o', 'dish'],
  ['jachnun', 'ג׳חנון', 'ג׳חנון,גחנון', 380, 7, 20, 44, 1.5, 'יחידה:150', 'gluten', 'vg', 'dish'],
  ['kubbeh_soup', 'מרק קובה', 'קובה', 85, 5, 2.5, 10, 1, 'קערה:350', 'gluten', 'o', 'dish'],
  ['chicken_soup', 'מרק עוף עם ירקות', 'מרק עוף', 45, 4, 1.5, 3.5, 0.7, 'קערה:350', '', 'o', 'dish'],
  ['tabouleh', 'טבולה', 'טאבולה', 120, 2.5, 7, 13, 3, 'כוס:160', 'gluten', 'vg', 'veg'],
];

export const FOODS: Food[] = ROWS.map((r) => {
  const [id, name, aliases, kcal, protein, fat, carbs, fiber, units, allergens, diet, category] = r;
  return {
    id,
    name,
    aliases: aliases.split(',').filter(Boolean),
    per100g: { kcal, protein, fat, carbs, fiber },
    units: [
      { label: 'גרם', grams: 1 },
      ...units.split('|').map((u) => {
        const [label, g] = u.split(':');
        return { label, grams: Number(g) };
      }),
    ],
    allergens: allergens.split(',').filter(Boolean) as Allergen[],
    vegan: diet === 'vg',
    vegetarian: diet !== 'o',
    category,
    source: 'dev-approx',
    verified: false,
  };
});

export const FOOD_BY_ID: Record<string, Food> = Object.fromEntries(FOODS.map((f) => [f.id, f]));

export function nutrientsFor(foodId: string, grams: number): Nutrients {
  const f = FOOD_BY_ID[foodId];
  if (!f) return { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
  const k = grams / 100;
  return {
    kcal: f.per100g.kcal * k,
    protein: f.per100g.protein * k,
    fat: f.per100g.fat * k,
    carbs: f.per100g.carbs * k,
    fiber: f.per100g.fiber * k,
  };
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  return list.reduce(
    (a, b) => ({ kcal: a.kcal + b.kcal, protein: a.protein + b.protein, fat: a.fat + b.fat, carbs: a.carbs + b.carbs, fiber: a.fiber + b.fiber }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 },
  );
}

const norm = (s: string) => s.replace(/[׳'"״]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

export function searchFoods(q: string, limit = 12): Food[] {
  const n = norm(q);
  if (!n) return FOODS.slice(0, limit);
  const scored = FOODS.map((f) => {
    const names = [f.name, ...f.aliases].map(norm);
    let score = 0;
    for (const nm of names) {
      if (nm === n) score = Math.max(score, 100);
      else if (nm.startsWith(n)) score = Math.max(score, 60);
      else if (nm.includes(n)) score = Math.max(score, 30);
      else if (n.split(' ').every((t) => nm.includes(t))) score = Math.max(score, 15);
    }
    return { f, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.f);
}
