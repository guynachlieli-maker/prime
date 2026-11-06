import type { Allergen, Nutrients } from '../engine/types';
import core from './generated/core-foods.json';

/**
 * Food data from the Israeli national nutrition database (Ministry of Health, data.gov.il
 * "nutrition-database"). Values are per 100 g, exactly as published. Units come from the
 * ministry's unit-weight table. Built by scripts/build-foods.py.
 *
 * - FOODS: curated core foods used by recipes, the menu engine and photo recognition.
 * - The full table (~4,500 foods, incl. Israeli brands) is loaded on demand for search: loadFullDb().
 */
export interface Food {
  id: string;
  code: number;
  name: string;
  officialName: string;
  /** everyday names used in search, speech and free text */
  aliases: string[];
  per100g: Nutrients;
  micro?: { sugar?: number | null; satFat?: number | null; sodium?: number | null; calcium?: number | null; iron?: number | null; b12?: number | null; vitC?: number | null };
  units: { label: string; grams: number }[];
  allergens: Allergen[];
  vegan: boolean;
  vegetarian: boolean;
  category: 'protein' | 'grain' | 'dairy' | 'veg' | 'fruit' | 'fat' | 'dish' | 'snack' | 'drink' | 'legume' | 'other';
  role: 'protein' | 'carb' | 'fat' | 'veg' | 'other';
  source: 'moh' | 'label' | 'openfoodfacts';
  /** true = value from an official table; label/Open Food Facts values must be checked by the user */
  verified: boolean;
}

type CoreRow = (typeof core.foods)[number];

const ALIASES: Record<string, string[]> = {
  egg: ['ביצה', 'ביצים'],
  egg_hard: ['ביצה קשה', 'ביצים קשות'],
  omelette: ['חביתה', 'ביצה מקושקשת'],
  chicken_breast: ['חזה עוף', 'עוף'],
  chicken_breast_grill: ['עוף בגריל', 'שישליק עוף'],
  chicken_thigh: ['פרגית', 'פרגיות', 'ירך עוף'],
  turkey_breast: ['חזה הודו', 'הודו'],
  turkey_pastrami: ['פסטרמה'],
  shawarma_turkey: ['שווארמה'],
  beef_ground: ['בשר טחון', 'בולונז'],
  beef_steak: ['סטייק', 'אנטריקוט'],
  salmon: ['סלמון'],
  tuna_water: ['טונה'],
  cottage5: ['קוטג', 'קוטג׳'],
  white_cheese5: ['גבינה לבנה', 'גבינה'],
  yellow_cheese: ['גבינה צהובה', 'צהובה'],
  yogurt3: ['יוגורט'],
  yogurt_pro: ['יוגורט חלבון', 'פרו'],
  milk3: ['חלב'],
  bread_whole: ['לחם מלא', 'לחם', 'פרוסה'],
  bread_white: ['לחם לבן'],
  pita: ['פיתה', 'פיתות'],
  tortilla_whole: ['טורטיה', 'לאפה'],
  rice_white: ['אורז'],
  rice_brown: ['אורז מלא'],
  pasta: ['פסטה', 'ספגטי', 'מקרוני'],
  oats: ['שיבולת שועל', 'קוואקר', 'דייסה'],
  potato: ['תפוח אדמה', 'תפוחי אדמה', 'פירה'],
  sweet_potato: ['בטטה'],
  hummus: ['חומוס'],
  tahini_salad: ['טחינה'],
  falafel: ['פלאפל'],
  shakshuka: ['שקשוקה'],
  majadra: ['מג׳דרה', 'מגדרה'],
  schnitzel: ['שניצל'],
  burekas_cheese: ['בורקס'],
  israeli_salad: ['סלט', 'סלט ירקות', 'סלט קצוץ'],
  cucumber: ['מלפפון', 'מלפפונים'],
  tomato: ['עגבנייה', 'עגבניה', 'עגבניות'],
  olive_oil: ['שמן', 'שמן זית'],
  banana: ['בננה', 'בננות'],
  apple: ['תפוח', 'תפוחים'],
  orange: ['תפוז', 'תפוזים'],
  dates: ['תמר', 'תמרים'],
  almonds: ['שקדים'],
  walnuts: ['אגוזים', 'אגוזי מלך'],
  protein_powder: ['אבקת חלבון', 'שייק חלבון', 'וואי'],
  coffee_cappuccino: ['קפה', 'הפוך', 'קפוצ׳ינו'],
  dark_chocolate: ['שוקולד'],
  bamba: ['במבה'],
  avocado: ['אבוקדו'],
};

export const FOOD_SOURCE = core.source;

function fromCore(r: CoreRow): Food {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    officialName: r.officialName,
    aliases: ALIASES[r.id] ?? [],
    per100g: { kcal: r.kcal, protein: r.protein, fat: r.fat, carbs: r.carbs, fiber: r.fiber },
    micro: { sugar: r.sugar, satFat: r.satFat, sodium: r.sodium, calcium: r.calcium, iron: r.iron, b12: r.b12, vitC: r.vitC },
    units: [{ label: 'גרם', grams: 1 }, ...r.units.map(([label, grams]) => ({ label: String(label), grams: Number(grams) }))],
    allergens: r.allergens as Allergen[],
    vegan: r.diet === 'v',
    vegetarian: r.diet !== 'o',
    category: r.category as Food['category'],
    role: r.role as Food['role'],
    source: 'moh',
    verified: true,
  };
}

export const FOODS: Food[] = core.foods.map(fromCore);

/** Mutable registry: core foods + any food loaded later (full table, barcode, label). */
export const FOOD_BY_ID: Record<string, Food> = Object.fromEntries(FOODS.map((f) => [f.id, f]));

export function registerFood(f: Food) {
  FOOD_BY_ID[f.id] = f;
}

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

const norm = (s: string) => s.replace(/[׳'"״`]/g, '').replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

function score(names: string[], n: string): number {
  let s = 0;
  const tokens = n.split(' ').filter(Boolean);
  for (const raw of names) {
    const nm = norm(raw);
    if (nm === n) s = Math.max(s, 100);
    else if (nm.startsWith(n)) s = Math.max(s, 70 - Math.min(20, nm.length / 4));
    else if (nm.includes(n)) s = Math.max(s, 40 - Math.min(15, nm.length / 6));
    else if (tokens.length > 1 && tokens.every((t) => nm.includes(t))) s = Math.max(s, 20);
  }
  return s;
}

export function searchFoods(q: string, limit = 12, pool: Food[] = FOODS): Food[] {
  const n = norm(q);
  if (!n) return pool.slice(0, limit);
  return pool
    .map((f) => {
      const base = score([f.name, ...f.aliases, f.officialName], n);
      return { f, s: base > 0 && pool === FOODS ? base + 5 : base };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.f);
}

/* ---------- Full Ministry of Health table (lazy) ---------- */

let fullDb: Food[] | null = null;
let loading: Promise<Food[]> | null = null;
const CORE_CODES = new Set(FOODS.map((f) => f.code));

export function loadFullDb(): Promise<Food[]> {
  if (fullDb) return Promise.resolve(fullDb);
  if (loading) return loading;
  loading = fetch('./moh-foods.json')
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<{ foods: [number, string, number, number, number, number, number, [string, number][]][] }>;
    })
    .then((d) => {
      fullDb = d.foods
        .filter(([code]) => !CORE_CODES.has(code))
        .map(([code, name, kcal, protein, fat, carbs, fiber, units]) => {
          const f: Food = {
            id: `moh:${code}`,
            code,
            name,
            officialName: name,
            aliases: [],
            per100g: { kcal, protein, fat, carbs, fiber },
            units: [{ label: 'גרם', grams: 1 }, ...units.map(([label, grams]) => ({ label, grams }))],
            allergens: [], // not in the ministry table: shown to the user as "אלרגנים לא ידועים"
            vegan: false,
            vegetarian: false,
            category: 'other',
            role: 'other',
            source: 'moh',
            verified: true,
          };
          return f;
        });
      fullDb.forEach(registerFood);
      return fullDb;
    })
    .catch((e) => {
      loading = null;
      throw e;
    });
  return loading;
}

/** Search core foods first, then the full table when it is loaded. */
export function searchAll(q: string, limit = 20): Food[] {
  const a = searchFoods(q, limit);
  if (!fullDb || !q.trim()) return a;
  const b = searchFoods(q, limit, fullDb);
  return [...a, ...b.filter((x) => !a.includes(x))].slice(0, limit);
}
