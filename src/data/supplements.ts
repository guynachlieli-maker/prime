import { FOOD_BY_ID, registerFood, type Food } from './foods';
import type { Nutrients } from '../engine/types';

/**
 * Common supplements. Ones with calories (protein powder, gainer, bars, collagen) are counted in
 * the daily menu, so the plan leaves room for them. Notes are general information, not dosing advice.
 */
export interface Supplement {
  id: string;
  name: string;
  group: 'protein' | 'performance' | 'vitamins' | 'other';
  /** Food used to log it, when it has calories. */
  foodId?: string;
  serving?: { label: string; grams: number };
  time: string; // usual time of day, HH:MM, for the reminder
  when: string; // short Hebrew hint
  note: string; // short, general safety/usage note
  vegan?: boolean;
}

const food = (id: string, name: string, per100g: Nutrients, allergens: Food['allergens'], vegan: boolean): string => {
  if (!FOOD_BY_ID[id])
    registerFood({ id, code: 0, name, officialName: name, aliases: [], per100g, units: [{ label: 'גרם', grams: 1 }], allergens, vegan, vegetarian: true, category: 'protein', role: 'protein', source: 'label', verified: false });
  return id;
};

export const SUPPLEMENTS: Supplement[] = [
  { id: 'whey', name: 'אבקת חלבון (מי גבינה)', group: 'protein', foodId: 'protein_powder', serving: { label: 'סקופ', grams: 30 }, time: '16:30', when: 'אחרי אימון או כביניים', note: 'נספרת בתפריט כחלבון. מי שלא מעכל חלב יכול לבחור אבקת חלבון צמחית.' },
  { id: 'plant_protein', name: 'אבקת חלבון צמחית', group: 'protein', foodId: food('supp_plant_protein', 'אבקת חלבון צמחית (אפונה/אורז)', { kcal: 380, protein: 75, fat: 6, carbs: 6, fiber: 3 }, ['soy'], true), serving: { label: 'סקופ', grams: 30 }, time: '16:30', when: 'אחרי אימון או כביניים', note: 'נספרת בתפריט כחלבון. הערכים משתנים בין מותגים, כדאי לבדוק מול התווית.', vegan: true },
  { id: 'gainer', name: 'גיינר', group: 'protein', foodId: food('supp_gainer', 'גיינר (אבקה)', { kcal: 380, protein: 20, fat: 3, carbs: 68, fiber: 1 }, ['dairy'], false), serving: { label: 'מנה', grams: 75 }, time: '16:30', when: 'בין ארוחות', note: 'הרבה קלוריות במנה אחת. נספר בתפריט, ומתאים בעיקר למי שמעלה במסה.' },
  { id: 'protein_bar', name: 'חטיף חלבון', group: 'protein', foodId: food('supp_protein_bar', 'חטיף חלבון', { kcal: 360, protein: 33, fat: 11, carbs: 34, fiber: 8 }, ['dairy', 'nuts'], false), serving: { label: 'חטיף', grams: 60 }, time: '16:30', when: 'כביניים', note: 'נספר בתפריט. חלק מהחטיפים מכילים הרבה סוכר או רב־כהלים, כדאי לבדוק בתווית.' },
  { id: 'collagen', name: 'קולגן', group: 'protein', foodId: food('supp_collagen', 'קולגן (אבקה)', { kcal: 360, protein: 90, fat: 0, carbs: 0, fiber: 0 }, [], false), serving: { label: 'מנה', grams: 10 }, time: '08:00', when: 'עם ארוחת הבוקר', note: 'נספר בקלוריות. חלבון הקולגן לא שלם, ולכן לא נחשב בחישוב יעד החלבון לבניית שריר.' },
  { id: 'creatine', name: 'קריאטין', group: 'performance', time: '09:00', when: 'כל יום באותה שעה, גם בימי מנוחה', note: 'התוסף הנחקר ביותר לכוח ולמסת שריר. נהוג 3-5 גרם ביום, עם מספיק שתייה. במחלת כליות, רק בהתייעצות עם רופא.' },
  { id: 'caffeine', name: 'קפאין / פרה־וורקאאוט', group: 'performance', time: '12:00', when: 'לפני אימון, לא בשעות הערב', note: 'עד 400 מ"ג קפאין ביום למבוגר בריא, כולל קפה. אחרי הצהריים הוא עלול לפגוע בשינה.' },
  { id: 'electrolytes', name: 'אלקטרוליטים', group: 'performance', time: '10:00', when: 'באימון ארוך או בחום', note: 'שימושי באימון של יותר משעה או בהזעה חזקה. ביום רגיל האוכל מספק מלחים.' },
  { id: 'beta_alanine', name: 'בטא־אלנין', group: 'performance', time: '09:00', when: 'כל יום', note: 'יכול לגרום לעקצוץ בעור. זה לא מסוכן.' },
  { id: 'vitamin_d', name: 'ויטמין D', group: 'vitamins', time: '13:00', when: 'עם ארוחה שיש בה שומן', note: 'נפוץ בישראל בגלל מעט חשיפה לשמש. מינון לפי בדיקת דם או לפי המלצת רופא.' },
  { id: 'omega3', name: 'אומגה 3', group: 'vitamins', time: '13:00', when: 'עם ארוחה', note: 'מי שאוכל דג שמן פעמיים בשבוע מקבל אומגה 3 מהאוכל. בנטילת מדללי דם, להתייעץ עם רופא.' },
  { id: 'magnesium', name: 'מגנזיום', group: 'vitamins', time: '21:30', when: 'בערב', note: 'מינון גבוה עלול לגרום לשלשול. במחלת כליות, רק בהתייעצות.' },
  { id: 'b12', name: 'ויטמין B12', group: 'vitamins', time: '09:00', when: 'בבוקר', note: 'חובה לטבעונים, וחשוב גם לצמחונים.', vegan: true },
  { id: 'iron', name: 'ברזל', group: 'vitamins', time: '10:00', when: 'בנפרד מקפה, תה ומוצרי חלב', note: 'רק אם בדיקת דם הראתה חוסר. עודף ברזל מזיק. ויטמין C משפר ספיגה.' },
  { id: 'multivitamin', name: 'מולטי־ויטמין', group: 'vitamins', time: '08:30', when: 'עם ארוחת הבוקר', note: 'לא מחליף תזונה מגוונת, אבל יכול להשלים פערים.' },
  { id: 'zinc', name: 'אבץ', group: 'vitamins', time: '13:00', when: 'עם ארוחה', note: 'שימוש ארוך במינון גבוה עלול לגרום לחוסר בנחושת.' },
  { id: 'calcium', name: 'סידן', group: 'vitamins', time: '20:00', when: 'בנפרד מברזל', note: 'בעיקר למי שלא אוכל מוצרי חלב.' },
  { id: 'folic', name: 'חומצה פולית', group: 'vitamins', time: '09:00', when: 'בבוקר', note: 'מומלצת לנשים שמתכננות הריון.' },
  { id: 'probiotics', name: 'פרוביוטיקה', group: 'other', time: '08:00', when: 'בבוקר', note: 'ההשפעה תלויה בזן. אפשר לקבל חיידקים טובים גם מיוגורט וקפיר.' },
  { id: 'fiber', name: 'סיבים (פסיליום)', group: 'other', time: '20:00', when: 'עם הרבה מים', note: 'עוזר לשובע ולעיכול. לשתות מספיק, ולהפריד שעתיים מתרופות.' },
];

export const SUPP_BY_ID = Object.fromEntries(SUPPLEMENTS.map((s) => [s.id, s])) as Record<string, Supplement>;

export const SUPP_GROUPS: { id: Supplement['group']; label: string }[] = [
  { id: 'protein', label: 'חלבון ואנרגיה' },
  { id: 'performance', label: 'ביצועים' },
  { id: 'vitamins', label: 'ויטמינים ומינרלים' },
  { id: 'other', label: 'אחר' },
];

/** Daily nutrients from the user's caloric supplements (one serving a day each). */
export function supplementNutrients(ids: string[] | undefined): Nutrients {
  const z: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
  for (const id of ids ?? []) {
    const s = SUPP_BY_ID[id];
    const f = s?.foodId ? FOOD_BY_ID[s.foodId] : undefined;
    if (!s?.serving || !f) continue;
    const k = s.serving.grams / 100;
    const countsProtein = id !== 'collagen';
    z.kcal += f.per100g.kcal * k;
    z.protein += countsProtein ? f.per100g.protein * k : 0;
    z.fat += f.per100g.fat * k;
    z.carbs += f.per100g.carbs * k;
    z.fiber += f.per100g.fiber * k;
  }
  return z;
}
