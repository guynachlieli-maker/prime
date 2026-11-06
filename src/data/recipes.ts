import { FOOD_BY_ID } from './foods';
import type { Allergen } from '../engine/types';

export type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface RecipeItem {
  foodId: string;
  grams: number; // base grams for one adult serving
}

export interface Recipe {
  id: string;
  name: string;
  slots: Slot[];
  prepMinutes: number;
  items: RecipeItem[];
  steps: string[];
  /** spec: only dietitian-approved recipes ship. null = pending approval */
  approvedBy: string | null;
}

/**
 * 100 Israeli recipes built from foods in the Ministry of Health table.
 * Status: drafts for the team dietitian. Nutrient values are computed from the official
 * per-100 g values; portions are adjusted per user by the menu engine.
 */
const R = (id: string, name: string, slots: Slot[], prepMinutes: number, items: string, steps: string[]): Recipe => ({
  id,
  name,
  slots,
  prepMinutes,
  items: items
    .trim()
    .split(/\s+/)
    .map((p) => {
      const [foodId, g] = p.split(':');
      return { foodId, grams: Number(g) };
    }),
  steps,
  approvedBy: null,
});

const B: Slot[] = ['breakfast'];
const BS: Slot[] = ['breakfast', 'snack'];
const L: Slot[] = ['lunch'];
const LD: Slot[] = ['lunch', 'dinner'];
const D: Slot[] = ['dinner'];
const BD: Slot[] = ['breakfast', 'dinner'];
const S: Slot[] = ['snack'];

export const RECIPES: Recipe[] = [
  // ---------- breakfast ----------
  R('shakshuka_bread', 'שקשוקה עם לחם מלא וסלט', ['breakfast', 'lunch'], 20, 'shakshuka:250 egg:50 bread_whole:64 israeli_salad:150', ['מחממים רוטב עגבניות ופלפלים', 'שוברים פנימה ביצים ומכסים עד שהחלבון מתייצב', 'מגישים עם לחם וסלט']),
  R('green_shakshuka', 'שקשוקה ירוקה עם פטה', B, 20, 'egg:100 spinach:100 zucchini:100 feta:30 olive_oil:5 bread_whole:32', ['מאדים תרד וקישוא בשמן זית', 'שוברים ביצים ומפזרים פטה', 'מגישים עם פרוסת לחם']),
  R('omelette_cottage', 'חביתה, קוטג׳ וסלט', B, 10, 'omelette:100 cottage5:100 bread_whole:64 israeli_salad:150', ['מכינים חביתה משתי ביצים', 'מגישים עם קוטג׳, לחם וסלט']),
  R('israeli_breakfast', 'ארוחת בוקר ישראלית', B, 10, 'egg_hard:100 white_cheese5:60 bread_whole:64 israeli_salad_oil:150 olives:15', ['מגישים ביצים קשות, גבינה, זיתים, לחם וסלט קצוץ']),
  R('oats_yogurt', 'דייסת שיבולת עם יוגורט ופירות יער', BS, 7, 'oats:50 yogurt_pro:150 blueberries:80 almonds:15', ['מבשלים שיבולת במים 2 דקות', 'מוסיפים יוגורט, אוכמניות ושקדים']),
  R('oats_milk_banana', 'דייסת קוואקר בחלב ובננה', B, 7, 'oats:50 milk1:240 banana:72 walnuts:10', ['מבשלים שיבולת בחלב', 'מוסיפים בננה פרוסה ואגוזים']),
  R('oats_vegan', 'דייסת שיבולת בסויה, תמר ופשתן', B, 7, 'oats:50 soy_milk:240 dates:24 flax:10', ['מבשלים שיבולת במשקה סויה', 'מוסיפים תמר קצוץ ופשתן']),
  R('yogurt_granola', 'יוגורט עם גרנולה ובננה', BS, 3, 'yogurt_pro:150 granola:35 banana:72', ['מערבבים הכול בקערה']),
  R('white_cheese_toast', 'טוסט גבינה לבנה וירקות', BS, 5, 'bread_whole:64 white_cheese5:80 cucumber:82 tomato:90', ['מורחים גבינה על הלחם', 'מגישים עם ירקות חתוכים']),
  R('avocado_egg_toast', 'טוסט אבוקדו וביצה', B, 10, 'bread_whole:64 avocado:50 egg:50 tomato:90', ['מועכים אבוקדו על הלחם', 'מניחים ביצה עלומה או קשה פרוסה']),
  R('tofu_scramble', 'טופו מקושקש עם ירקות', B, 15, 'tofu:150 pepper_red:100 onion_green:30 olive_oil:5 bread_whole:64', ['מפוררים טופו ומקפיצים עם ירקות ושמן זית', 'מגישים עם לחם']),
  R('protein_pancakes', 'פנקייק חלבון עם תותים', B, 20, 'oats:40 egg:100 cottage5:100 strawberry:120 honey:7', ['טוחנים שיבולת, ביצים וקוטג׳', 'מטגנים במחבת ללא שמן', 'מגישים עם תותים וטיפת דבש']),
  R('bagel_cream_cheese', 'בייגל גבינת שמנת וירקות', B, 5, 'bagel:85 cream_cheese5:40 cucumber:82 tomato:90', ['פורסים בייגל, מורחים גבינה ומוסיפים ירקות']),
  R('jachnun_light', 'ג׳חנון עם ביצה ורסק עגבניות', B, 10, 'jachnun:116 egg_hard:50 tomato:120 schug:6', ['מחממים ג׳חנון', 'מגישים עם ביצה, עגבנייה מגוררת וסחוג']),
  R('malawach_plate', 'מלאווח עם ביצה וסלט', B, 10, 'malawach:96 egg_hard:50 israeli_salad:150', ['מטגנים מלאווח ללא שמן נוסף', 'מגישים עם ביצה וסלט']),
  R('labane_toast', 'טוסט לבן, זעתר וירקות', B, 5, 'bread_whole:64 leben:100 olive_oil:5 cucumber:82', ['מורחים, מזלפים שמן זית ומפזרים זעתר']),
  R('burekas_breakfast', 'בורקס גבינה עם ביצה ומלפפון', B, 5, 'burekas_cheese:100 egg_hard:50 cucumber:82', ['מחממים בורקס', 'מגישים עם ביצה קשה ומלפפון']),
  R('cottage_fruit', 'קוטג׳ עם פירות ושקדים', BS, 3, 'cottage5:150 apple:120 almonds:15', ['חותכים פרי ומערבבים עם קוטג׳ ושקדים']),
  R('smoothie_bowl', 'קערת שייק בננה ופירות יער', B, 5, 'yogurt0:200 banana:72 blueberries:80 granola:20', ['טוחנים יוגורט, בננה ופירות', 'מפזרים גרנולה']),
  R('tortilla_egg_wrap', 'טורטיה מלאה עם חביתה וירקות', B, 10, 'tortilla_whole:70 omelette:100 pepper_red:60 lettuce:30', ['מכינים חביתה', 'מגלגלים בטורטיה עם ירקות']),
  R('rye_tuna_toast', 'פריכיות שיפון עם טונה וירקות', ['breakfast', 'snack'], 5, 'crispbread_rye:24 tuna_water:80 cucumber:82 lemon_juice:10', ['מערבבים טונה עם לימון', 'מניחים על פריכיות עם מלפפון']),
  R('mozzarella_tomato_toast', 'טוסט מוצרלה ועגבנייה', B, 8, 'bread_whole:64 mozzarella:40 tomato:120', ['מניחים מוצרלה ועגבנייה על הלחם ומשחימים בתנור']),
  R('buckwheat_porridge', 'דייסת כוסמת ביוגורט ופרי', B, 15, 'buckwheat:170 yogurt3:150 pear:113', ['מבשלים כוסמת', 'מגישים עם יוגורט ואגס']),
  R('peanut_banana_toast', 'טוסט חמאת בוטנים ובננה', BS, 3, 'bread_whole:64 peanut_butter:16 banana:72', ['מורחים חמאת בוטנים ומניחים פרוסות בננה']),
  R('dairy_plate', 'צלחת חלבית: בולגרית, יוגורט וירקות', BD, 5, 'bulgarian5:60 yogurt3:150 bread_rye:60 israeli_salad:150', ['מגישים גבינה, יוגורט, לחם שיפון וסלט']),
  // ---------- lunch / dinner: meat & poultry ----------
  R('chicken_rice_salad', 'חזה עוף, אורז וסלט', LD, 25, 'chicken_breast:150 rice_white:160 israeli_salad_oil:150', ['צולים חזה עוף בתיבול', 'מגישים עם אורז וסלט']),
  R('chicken_sweetpotato', 'פרגיות עם בטטה וברוקולי', LD, 35, 'chicken_thigh:150 sweet_potato:200 broccoli:150', ['אופים פרגיות ובטטה בתנור 30 דקות ב-200 מעלות', 'מאדים ברוקולי']),
  R('chicken_quinoa_bowl', 'קערת עוף וקינואה', LD, 25, 'chicken_breast_grill:150 quinoa:185 cucumber:82 tomato:90 tahini_salad:20', ['צולים חזה עוף ברצועות', 'מגישים על קינואה עם ירקות וטחינה']),
  R('chicken_couscous', 'עוף בתנור עם קוסקוס וירקות', LD, 45, 'chicken_breast:150 couscous:160 carrot:80 zucchini:100', ['אופים עוף וירקות', 'מגישים עם קוסקוס']),
  R('chicken_ptitim', 'חזה עוף עם פתיתים ושעועית ירוקה', LD, 30, 'chicken_breast:150 ptitim:150 green_beans:100', ['צולים עוף', 'מבשלים פתיתים', 'מגישים עם שעועית ירוקה']),
  R('chicken_pita', 'פיתה עוף בגריל וסלט', L, 20, 'chicken_breast_grill:120 pita:100 israeli_salad:100 tahini_salad:20', ['ממלאים פיתה בעוף, סלט וטחינה']),
  R('chicken_schnitzel_baked', 'שניצל אפוי עם פירה וסלט', LD, 35, 'schnitzel_baked:130 potato:200 israeli_salad_oil:150', ['אופים שניצל', 'מועכים תפוחי אדמה מבושלים', 'מגישים עם סלט']),
  R('chicken_patties_rice', 'קציצות עוף ברוטב עם אורז מלא', LD, 40, 'chicken_patties:150 rice_brown:150 tomato:100 green_beans:80', ['מבשלים קציצות ברוטב עגבניות', 'מגישים עם אורז מלא']),
  R('chicken_buckwheat', 'עוף עם כוסמת ופטריות', LD, 30, 'chicken_thigh:140 buckwheat:170 mushrooms:100', ['צולים פרגיות', 'מקפיצים כוסמת עם פטריות']),
  R('turkey_mashed', 'חזה הודו עם תפוחי אדמה וסלק', LD, 35, 'turkey_breast:150 potato_baked:180 beet:80 lettuce:50', ['מבשלים חזה הודו', 'מגישים עם תפוחי אדמה אפויים וסלט סלק']),
  R('turkey_bolognese', 'פסטה בולונז הודו', LD, 30, 'turkey_ground:120 pasta:200 tomato:150', ['מטגנים הודו טחון עם עגבניות', 'מערבבים עם פסטה']),
  R('shawarma_plate', 'צלחת שווארמה הודו', LD, 20, 'shawarma_turkey:150 pita:50 israeli_salad:150 tahini_salad:20 amba:11', ['מחממים שווארמה', 'מגישים עם חצי פיתה, סלט, טחינה ועמבה']),
  R('kebab_bulgur', 'קבב עם בורגול וסלט', LD, 35, 'kebab_beef:140 bulgur_dry:60 israeli_salad:150', ['צולים קבב', 'מבשלים בורגול', 'מגישים עם סלט']),
  R('beef_rice', 'בקר טחון עם אורז ואפונה', LD, 30, 'beef_ground:110 rice_white:160 peas:80 tomato:80', ['מבשלים בשר עם אפונה ועגבניות', 'מגישים על אורז']),
  R('steak_potato', 'סטייק עם תפוחי אדמה וסלט ירוק', D, 25, 'beef_steak:180 potato_baked:180 lettuce:80 olive_oil:5', ['צולים סטייק', 'מגישים עם תפוחי אדמה וסלט']),
  R('beef_pasta', 'פסטה בולונז', LD, 30, 'beef_ground:100 pasta:200 tomato:150', ['מטגנים בשר טחון עם עגבניות', 'מערבבים עם פסטה']),
  R('chicken_liver_rice', 'כבד עוף עם אורז ובצל', LD, 25, 'chicken_liver:120 rice_white:160 israeli_salad:150 olive_oil:5', ['מטגנים כבדים עם בצל', 'מגישים עם אורז וסלט']),
  R('moussaka_plate', 'מוסקה עוף עם סלט', LD, 60, 'moussaka_chicken:300 israeli_salad:150', ['אופים מוסקה', 'מגישים עם סלט']),
  R('chamin_shabbat', 'חמין של שבת עם סלט', L, 30, 'chamin:300 israeli_salad:150', ['מגישים חמין חם עם סלט']),
  R('chicken_soup_meal', 'מרק עוף עם עוף וקוסקוס', D, 60, 'chicken_soup:350 chicken_breast:100 couscous:120 carrot:60', ['מבשלים מרק עוף עם ירקות', 'מגישים עם עוף וקוסקוס']),
  R('kubbeh_soup_meal', 'מרק קובה', LD, 60, 'kubbeh_soup:150 chicken_soup:300 pumpkin:100', ['מבשלים מרק עם דלעת', 'מוסיפים קובה ומבשלים 20 דקות']),
  R('chicken_stirfry', 'מוקפץ עוף וירקות עם אורז', LD, 25, 'chicken_breast:140 rice_white:150 broccoli:100 pepper_red:80 olive_oil:5', ['מקפיצים עוף וירקות', 'מגישים על אורז']),
  R('turkey_sandwich', 'כריך פסטרמה הודו וירקות', ['lunch', 'snack'], 5, 'bread_whole:64 turkey_pastrami:60 tomato:60 lettuce:20', ['ממלאים כריך בפסטרמה וירקות']),
  R('chicken_tortilla', 'טורטיה עוף וירקות', L, 15, 'tortilla_whole:70 chicken_breast_grill:120 lettuce:30 pepper_red:60 tahini_salad:15', ['מגלגלים עוף וירקות בטורטיה עם טחינה']),
  // ---------- fish ----------
  R('salmon_quinoa', 'סלמון עם קינואה וברוקולי', LD, 25, 'salmon:150 quinoa:185 broccoli:150', ['אופים סלמון 15 דקות ב-200 מעלות', 'מגישים עם קינואה וברוקולי']),
  R('salmon_sweetpotato', 'סלמון עם בטטה וסלט ירוק', LD, 30, 'salmon:150 sweet_potato:200 lettuce:80 lemon_juice:10', ['אופים סלמון ובטטה', 'מגישים עם סלט ולימון']),
  R('tilapia_rice', 'אמנון עם אורז וירקות', LD, 25, 'tilapia:180 rice_white:150 zucchini:120 lemon_juice:10', ['אופים פילה אמנון', 'מגישים עם אורז וקישואים']),
  R('denis_potato', 'דניס בתנור עם תפוחי אדמה', D, 35, 'denis:200 potato:200 israeli_salad_oil:150', ['אופים דניס עם לימון', 'מגישים עם תפוחי אדמה וסלט']),
  R('cod_couscous', 'בקלה ברוטב עגבניות עם קוסקוס', LD, 30, 'cod:180 couscous:160 tomato:150 olive_oil:5', ['מבשלים בקלה ברוטב עגבניות', 'מגישים עם קוסקוס']),
  R('tuna_salad_pita', 'סלט טונה בפיתה', L, 10, 'tuna_water:112 pita:60 israeli_salad_oil:150', ['מערבבים טונה עם ירקות ושמן', 'ממלאים בפיתה']),
  R('tuna_pasta', 'פסטה טונה ועגבניות', LD, 20, 'tuna_water:112 pasta_whole:200 tomato:150 olive_oil:5', ['מבשלים פסטה', 'מערבבים עם טונה ורוטב עגבניות']),
  R('tuna_rice_bowl', 'קערת טונה, אורז ואדממה', L, 15, 'tuna_water:112 rice_brown:150 edamame:80 cucumber:82', ['מסדרים בקערה אורז, טונה, אדממה ומלפפון']),
  R('salmon_bagel', 'בייגל סלמון וגבינת שמנת', ['breakfast', 'lunch'], 5, 'bagel:85 salmon:80 cream_cheese5:30 cucumber:60', ['ממלאים בייגל בסלמון, גבינה ומלפפון']),
  // ---------- vegetarian / vegan mains ----------
  R('hummus_plate', 'צלחת חומוס עם ביצה', L, 10, 'hummus:150 egg_hard:50 pita:60 israeli_salad:150', ['מגישים חומוס עם ביצה קשה, פיתה וסלט']),
  R('hummus_chickpeas', 'חומוס מסבחה עם גרגירים', L, 10, 'hummus:120 chickpeas:80 pita:60 israeli_salad:120', ['מגישים חומוס עם גרגירים חמים, פיתה וסלט']),
  R('falafel_pita', 'פלאפל בפיתה עם סלט', L, 15, 'falafel:100 pita:100 israeli_salad:120 tahini_salad:20', ['ממלאים פיתה בפלאפל אפוי, סלט וטחינה']),
  R('falafel_plate', 'צלחת פלאפל, חומוס וסלט', LD, 15, 'falafel:100 hummus:60 tabouleh:120 israeli_salad:120', ['מגישים פלאפל עם חומוס, טבולה וסלט']),
  R('sabich_plate', 'צלחת סביח', L, 20, 'eggplant_roasted:150 egg_hard:50 pita:60 tahini_salad:25 israeli_salad:120 amba:11', ['קולים חציל', 'מגישים עם ביצה, טחינה, עמבה, סלט וחצי פיתה']),
  R('majadra_yogurt', 'מג׳דרה עם יוגורט וסלט', LD, 40, 'majadra:250 yogurt3:150 israeli_salad:150', ['מבשלים עדשים ואורז עם בצל', 'מגישים עם יוגורט וסלט']),
  R('majadra_bulgur_salad', 'מג׳דרה בורגול וסלט כרוב', LD, 40, 'majadra_bulgur:250 cabbage_salad:120', ['מבשלים בורגול ועדשים', 'מגישים עם סלט כרוב']),
  R('lentil_bowl', 'קערת עדשים, בטטה וטחינה', LD, 30, 'lentils:200 sweet_potato:150 tahini_salad:25 israeli_salad:120', ['אופים בטטה', 'מגישים עם עדשים, סלט וטחינה']),
  R('lentil_soup_bread', 'מרק עדשים עם לחם', LD, 45, 'lentil_soup:400 bread_whole:64 lemon_juice:10', ['מבשלים מרק עדשים', 'מגישים עם לימון ולחם']),
  R('bean_soup_bread', 'מרק שעועית לבנה עם לחם', LD, 60, 'white_bean_soup:400 bread_whole:64', ['מבשלים מרק שעועית', 'מגישים עם לחם']),
  R('tofu_rice', 'טופו מוקפץ עם אורז מלא', LD, 20, 'tofu:150 rice_brown:160 broccoli:150 olive_oil:5', ['מקפיצים טופו וירקות', 'מגישים על אורז מלא']),
  R('tofu_quinoa', 'קערת טופו, קינואה ואבוקדו', LD, 20, 'tofu:130 quinoa:150 avocado:50 cucumber:82', ['צולים קוביות טופו', 'מגישים על קינואה עם אבוקדו ומלפפון']),
  R('chickpea_salad', 'סלט גרגירי חומוס וקינואה', L, 15, 'chickpeas:150 quinoa:120 israeli_salad_oil:150', ['מערבבים הכול עם לימון']),
  R('red_bean_rice', 'שעועית אדומה עם אורז', LD, 30, 'red_beans:180 rice_white:150 pepper_red:80 olive_oil:5', ['מבשלים שעועית עם פלפל', 'מגישים על אורז']),
  R('stuffed_vine_plate', 'עלי גפן ממולאים עם יוגורט', LD, 15, 'stuffed_vine:200 yogurt3:150 israeli_salad:120', ['מחממים עלי גפן', 'מגישים עם יוגורט וסלט']),
  R('eggplant_egg_pita', 'פיתה חציל וביצה', LD, 20, 'pita:60 eggplant_roasted:150 egg_hard:50 tahini_salad:20', ['קולים חציל', 'ממלאים פיתה עם חציל, ביצה וטחינה']),
  R('zucchini_pie_salad', 'פשטידת קישואים עם סלט', LD, 50, 'zucchini_pie:200 israeli_salad_oil:150', ['אופים פשטידה', 'מגישים עם סלט']),
  R('greek_salad_meal', 'סלט יווני עם לחם וביצה', LD, 10, 'greek_salad:250 egg_hard:50 bread_whole:64', ['מגישים סלט יווני עם ביצה ולחם']),
  R('pizza_salad', 'פיצה וסלט ירוק', D, 20, 'pizza:150 lettuce:80 tomato:90', ['מחממים פיצה', 'מגישים עם סלט']),
  R('pasta_ricotta', 'פסטה ריקוטה ותרד', LD, 20, 'pasta:200 ricotta:80 spinach:100', ['מבשלים פסטה', 'מערבבים עם ריקוטה ותרד']),
  R('cottage_dinner', 'ארוחת ערב חלבית', ['dinner', 'breakfast'], 5, 'cottage5:150 bread_whole:64 avocado:40 israeli_salad:150', ['מגישים קוטג׳, לחם, אבוקדו וסלט']),
  R('omelette_dinner', 'חביתת ירק עם סלט ולחם', D, 15, 'omelette:120 spinach:50 bread_rye:60 israeli_salad:150', ['מכינים חביתה עם תרד', 'מגישים עם לחם וסלט']),
  R('edamame_bowl', 'קערת אדממה ואורז', LD, 15, 'edamame:150 rice_brown:150 cabbage:100 tahini_salad:15', ['מבשלים אדממה', 'מגישים על אורז עם כרוב וטחינה']),
  R('veg_grill_feta', 'ירקות בגריל עם פטה וקינואה', LD, 30, 'veg_grilled:250 feta:50 quinoa:150', ['צולים ירקות', 'מגישים עם פטה וקינואה']),
  R('tortilla_hummus', 'טורטיה חומוס וירקות', L, 10, 'tortilla_whole:70 hummus:60 lettuce:30 cucumber:82 tomato:90', ['מורחים חומוס ומגלגלים עם ירקות']),
  R('yellow_cheese_toast', 'טוסט גבינה צהובה וירקות', D, 10, 'bread_whole:64 yellow_cheese_light:40 tomato:90 cucumber:82', ['מכינים טוסט', 'מגישים עם ירקות']),
  // protein-dense vegetarian / vegan mains
  R('cottage_salad_bowl', 'קערת קוטג׳, ביצה וסלט', LD, 10, 'cottage5:200 egg_hard:50 bread_whole:64 israeli_salad:150', ['מגישים קוטג׳ עם ביצה קשה, לחם וסלט']),
  R('tofu_edamame_stirfry', 'מוקפץ טופו ואדממה עם אורז מלא', LD, 20, 'tofu:180 edamame:100 rice_brown:150 pepper_red:80', ['מקפיצים טופו, אדממה ופלפל', 'מגישים על אורז מלא']),
  R('lentil_feta_salad', 'סלט עדשים ופטה', LD, 15, 'lentils:200 feta:60 israeli_salad_oil:150', ['מערבבים עדשים מבושלות עם סלט ופטה']),
  R('eggs_beans_plate', 'ביצים ושעועית ברוטב עגבניות', LD, 20, 'egg:100 white_beans:150 tomato:150 bread_whole:32', ['מבשלים שעועית ברוטב עגבניות', 'שוברים ביצים ומבשלים עד שמתייצבות']),
  R('yogurt_protein_bowl', 'קערת יוגורט חלבון ובננה', BS, 3, 'yogurt_pro:200 protein_powder:20 banana:72', ['מערבבים יוגורט עם אבקת חלבון', 'מוסיפים בננה']),
  R('tofu_hummus_pita', 'פיתה טופו וחומוס', L, 15, 'tofu:150 pita:60 hummus:40 israeli_salad:120', ['צולים טופו', 'ממלאים פיתה עם חומוס, טופו וסלט']),
  // ---------- snacks ----------
  R('fruit_nuts', 'תפוח ואגוזים', S, 1, 'apple:150 walnuts:20', ['פרי וחופן קטן של אגוזים']),
  R('rice_cakes_cottage', 'פריכיות עם קוטג׳', S, 2, 'rice_cakes:23 cottage5:100', ['מורחים קוטג׳ על פריכיות']),
  R('dates_almonds', 'תמרים ושקדים לפני אימון', S, 1, 'dates:48 almonds:15', ['שני תמרים וכמה שקדים, כשעה לפני אימון']),
  R('yogurt_berries', 'יוגורט עם אוכמניות', S, 2, 'yogurt_pro:150 blueberries:80', ['מערבבים']),
  R('protein_shake', 'שייק חלבון בננה', ['snack', 'breakfast'], 3, 'protein_powder:30 milk1:240 banana:72', ['טוחנים הכול בבלנדר']),
  R('protein_shake_vegan', 'שייק סויה, בננה וחמאת בוטנים', S, 3, 'soy_milk:300 banana:72 peanut_butter:16', ['טוחנים הכול בבלנדר']),
  R('veggies_hummus', 'ירקות חתוכים עם חומוס', S, 5, 'carrot:80 cucumber:82 kohlrabi:100 hummus:50', ['חותכים ירקות לאצבעות', 'טובלים בחומוס']),
  R('cottage_cucumber', 'קוטג׳ עם מלפפון', S, 2, 'cottage5:150 cucumber:82', ['מגישים קוטג׳ עם מלפפון']),
  R('egg_cucumber', 'ביצה קשה ומלפפון', S, 1, 'egg_hard:100 cucumber:82', ['שתי ביצים קשות ומלפפון']),
  R('banana_pb', 'בננה עם חמאת בוטנים', S, 1, 'banana:104 peanut_butter:16', ['בננה וכף חמאת בוטנים']),
  R('fruit_salad', 'סלט פירות', S, 5, 'melon:150 grapes:80 kiwi:76', ['חותכים ומערבבים']),
  R('watermelon_feta', 'אבטיח ופטה', S, 3, 'watermelon:300 feta:40', ['קוביות אבטיח עם פטה']),
  R('edamame_snack', 'אדממה מאודה', S, 5, 'edamame:120', ['מאדים אדממה ומפזרים מלח גס']),
  R('pistachio_orange', 'תפוז ופיסטוקים', S, 1, 'orange:186 pistachio:20', ['תפוז וחופן קטן של פיסטוקים']),
  R('dark_chocolate_almonds', 'שוקולד מריר ושקדים', S, 1, 'dark_chocolate:15 almonds:15', ['שתי קוביות שוקולד וכמה שקדים']),
  R('crispbread_cheese', 'פריכיות שיפון עם גבינה לבנה', S, 2, 'crispbread_rye:24 white_cheese5:60 tomato:60', ['מורחים גבינה ומניחים עגבנייה']),
  R('turkey_rollups', 'גלילי פסטרמה וירקות', S, 3, 'turkey_pastrami:60 cucumber:82 pepper_red:60', ['מגלגלים פסטרמה סביב רצועות ירקות']),
  R('yogurt_honey_walnuts', 'יוגורט, דבש ואגוזים', S, 2, 'yogurt3:150 honey:7 walnuts:10', ['מערבבים']),
  R('tuna_crackers', 'טונה על פריכיות אורז', S, 3, 'tuna_water:80 rice_cakes:23 lemon_juice:5', ['מניחים טונה על פריכיות']),
  R('bamba_milk', 'במבה וכוס חלב', S, 1, 'bamba:25 milk1:240', ['שקית במבה קטנה וכוס חלב']),
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
/** Kosher rule used here: no meat and dairy in the same recipe (fish and eggs are parve). */
export function recipeIsKosherCompatible(r: Recipe) {
  const meat = r.items.some((i) => FOOD_BY_ID[i.foodId]?.vegetarian === false && !FOOD_BY_ID[i.foodId]?.allergens.includes('fish'));
  const dairy = r.items.some((i) => FOOD_BY_ID[i.foodId]?.allergens.includes('dairy'));
  return !(meat && dairy);
}
