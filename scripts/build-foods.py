"""
Builds the app's food data from the Israeli national nutrition database
(Ministry of Health, data.gov.il dataset "nutrition-database", license: Other (Open)).

Usage: python3 -I scripts/build-foods.py <dir with foods.json units.json unitweights.json>
Outputs:
  src/data/generated/core-foods.json  curated foods used by recipes (official values per 100 g + MoH units)
  public/moh-foods.json               full table for search (loaded on demand)
"""
import json, os, sys

SRC = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
foods = {int(f['Code']): f for f in json.load(open(os.path.join(SRC, 'foods.json')))}
units = {str(u['smlmida']): u['shmmida'].replace('  ', ' ').strip() for u in json.load(open(os.path.join(SRC, 'units.json')))}
uw = {}
for r in json.load(open(os.path.join(SRC, 'unitweights.json'))):
    try:
        uw.setdefault(int(r['mmitzrach']), []).append((str(r['mida']), float(r['mishkal'])))
    except (TypeError, ValueError):
        pass

# id: (MoH code, display name, allergens, diet v=vegan/vg=vegetarian/o=other, category, role)
CORE = {
 # proteins
 'egg': (1561, 'ביצה', 'egg', 'vg', 'protein', 'protein'),
 'egg_hard': (1564, 'ביצה קשה', 'egg', 'vg', 'protein', 'protein'),
 'omelette': (1570, 'חביתה בשמן זית', 'egg', 'vg', 'protein', 'protein'),
 'chicken_breast': (811, 'חזה עוף אפוי', '', 'o', 'protein', 'protein'),
 'chicken_breast_grill': (802, 'חזה עוף בגריל', '', 'o', 'protein', 'protein'),
 'chicken_thigh': (8186, 'ירך עוף צלויה (פרגית)', '', 'o', 'protein', 'protein'),
 'chicken_patties': (9163, 'קציצות עוף אפויות', '', 'o', 'protein', 'protein'),
 'turkey_breast': (944, 'חזה הודו מבושל', '', 'o', 'protein', 'protein'),
 'turkey_ground': (1026, 'הודו טחון מבושל', '', 'o', 'protein', 'protein'),
 'turkey_pastrami': (1120, 'פסטרמה הודו 1.5%', '', 'o', 'protein', 'protein'),
 'shawarma_turkey': (998, 'שווארמה הודו', '', 'o', 'protein', 'protein'),
 'beef_ground': (1478, 'בקר טחון מבושל', '', 'o', 'protein', 'protein'),
 'beef_steak': (612, 'סטייק בקר', '', 'o', 'protein', 'protein'),
 'kebab_beef': (667, 'קבב בקר', '', 'o', 'protein', 'protein'),
 'chicken_liver': (1053, 'כבד עוף מאודה', '', 'o', 'protein', 'protein'),
 'salmon': (1298, 'סלמון אפוי', 'fish', 'o', 'protein', 'protein'),
 'tilapia': (1152, 'אמנון מבושל', 'fish', 'o', 'protein', 'protein'),
 'denis': (9691, 'דניס מבושל', 'fish', 'o', 'protein', 'protein'),
 'cod': (1206, 'בקלה מבושלת', 'fish', 'o', 'protein', 'protein'),
 'tuna_water': (1360, 'טונה במים', 'fish', 'o', 'protein', 'protein'),
 'tofu': (10141, 'טופו קשה', 'soy', 'v', 'protein', 'protein'),
 'edamame': (8221, 'אדממה מבושל', 'soy', 'v', 'legume', 'protein'),
 'protein_powder': (8712, 'אבקת חלבון מי גבינה', 'dairy', 'vg', 'protein', 'protein'),
 # dairy
 'cottage5': (494, "קוטג' 5%", 'dairy', 'vg', 'dairy', 'protein'),
 'white_cheese5': (532, 'גבינה לבנה 5%', 'dairy', 'vg', 'dairy', 'protein'),
 'bulgarian5': (435, 'גבינה בולגרית 5%', 'dairy', 'vg', 'dairy', 'protein'),
 'feta': (8598, 'פטה 5%', 'dairy', 'vg', 'dairy', 'protein'),
 'yellow_cheese': (490, 'גבינה צהובה 23%', 'dairy', 'vg', 'dairy', 'fat'),
 'yellow_cheese_light': (8609, 'גבינה צהובה 15%', 'dairy', 'vg', 'dairy', 'protein'),
 'mozzarella': (423, 'מוצרלה 22%', 'dairy', 'vg', 'dairy', 'fat'),
 'ricotta': (510, 'ריקוטה 9%', 'dairy', 'vg', 'dairy', 'protein'),
 'yogurt3': (62, 'יוגורט 3%', 'dairy', 'vg', 'dairy', 'protein'),
 'yogurt_pro': (9707, 'יוגורט עשיר בחלבון', 'dairy', 'vg', 'dairy', 'protein'),
 'yogurt0': (56, 'יוגורט 0%', 'dairy', 'vg', 'dairy', 'protein'),
 'leben': (84, 'לבן 4.5%', 'dairy', 'vg', 'dairy', 'protein'),
 'milk3': (15, 'חלב 3%', 'dairy', 'vg', 'drink', 'protein'),
 'milk1': (25, 'חלב 1%', 'dairy', 'vg', 'drink', 'protein'),
 'soy_milk': (1755, 'משקה סויה', 'soy', 'v', 'drink', 'protein'),
 'cream_cheese5': (8605, 'גבינת שמנת 5%', 'dairy', 'vg', 'dairy', 'fat'),
 'butter': (4388, 'חמאה', 'dairy', 'vg', 'fat', 'fat'),
 # grains & starches
 'bread_whole': (1995, 'לחם מחיטה מלאה', 'gluten', 'v', 'grain', 'carb'),
 'bread_rye': (2035, 'לחם שיפון', 'gluten', 'v', 'grain', 'carb'),
 'bread_light': (8880, 'לחם קל מלא', 'gluten', 'v', 'grain', 'carb'),
 'bread_white': (1919, 'לחם לבן', 'gluten', 'v', 'grain', 'carb'),
 'challah': (1965, 'חלה', 'gluten,egg', 'vg', 'grain', 'carb'),
 'pita': (1955, 'פיתה', 'gluten', 'v', 'grain', 'carb'),
 'tortilla_whole': (2052, 'טורטיה מחיטה מלאה', 'gluten', 'v', 'grain', 'carb'),
 'bagel': (1980, 'בייגל', 'gluten', 'v', 'grain', 'carb'),
 'rice_white': (2721, 'אורז לבן מבושל', '', 'v', 'grain', 'carb'),
 'rice_brown': (2727, 'אורז מלא מבושל', '', 'v', 'grain', 'carb'),
 'pasta': (8552, 'פסטה מבושלת', 'gluten', 'v', 'grain', 'carb'),
 'pasta_whole': (8553, 'ספגטי מלא מבושל', 'gluten', 'v', 'grain', 'carb'),
 'ptitim': (2625, 'פתיתים מבושלים', 'gluten', 'v', 'grain', 'carb'),
 'oats': (8199, 'שיבולת שועל', 'gluten', 'v', 'grain', 'carb'),
 'quinoa': (2773, 'קינואה מבושלת', '', 'v', 'grain', 'carb'),
 'couscous': (10127, 'קוסקוס מבושל', 'gluten', 'v', 'grain', 'carb'),
 'couscous_whole': (9783, 'קוסקוס מלא מבושל', 'gluten', 'v', 'grain', 'carb'),
 'bulgur_dry': (8812, 'בורגול (יבש)', 'gluten', 'v', 'grain', 'carb'),
 'buckwheat': (2668, 'כוסמת מבושלת', '', 'v', 'grain', 'carb'),
 'potato': (3464, 'תפוח אדמה מבושל', '', 'v', 'veg', 'carb'),
 'potato_baked': (9260, 'תפוחי אדמה אפויים בשמן זית', '', 'v', 'veg', 'carb'),
 'sweet_potato': (3660, 'בטטה מבושלת', '', 'v', 'veg', 'carb'),
 'corn': (3787, 'תירס', '', 'v', 'veg', 'carb'),
 'granola': (2849, 'גרנולה', 'gluten,nuts', 'v', 'grain', 'carb'),
 'rice_cakes': (2566, 'פריכיות אורז מלא', '', 'v', 'snack', 'carb'),
 'crispbread_rye': (2561, 'פריכיות שיפון', 'gluten', 'v', 'snack', 'carb'),
 # legumes
 'lentils': (1669, 'עדשים מבושלות', '', 'v', 'legume', 'protein'),
 'chickpeas': (1653, 'גרגירי חומוס מבושלים', '', 'v', 'legume', 'protein'),
 'white_beans': (8306, 'שעועית לבנה מבושלת', '', 'v', 'legume', 'protein'),
 'red_beans': (8305, 'שעועית אדומה מבושלת', '', 'v', 'legume', 'protein'),
 'peas': (3833, 'אפונה ירוקה', '', 'v', 'veg', 'carb'),
 # dishes & spreads
 'hummus': (1640, 'חומוס (ממרח)', 'sesame', 'v', 'dish', 'fat'),
 'tahini': (1898, 'טחינה גולמית', 'sesame', 'v', 'fat', 'fat'),
 'tahini_salad': (1886, 'טחינה מוכנה', 'sesame', 'v', 'fat', 'fat'),
 'falafel': (9596, 'פלאפל (אפוי/בלי שמן)', '', 'v', 'dish', 'carb'),
 'shakshuka': (1591, 'שקשוקה בשמן זית', 'egg', 'vg', 'dish', 'protein'),
 'majadra': (3082, "מג'דרה", '', 'v', 'dish', 'carb'),
 'majadra_bulgur': (3090, "מג'דרה בורגול", 'gluten', 'v', 'dish', 'carb'),
 'schnitzel_baked': (9755, 'שניצל עוף אפוי', 'gluten,egg', 'o', 'dish', 'protein'),
 'schnitzel': (818, 'שניצל עוף מטוגן', 'gluten,egg', 'o', 'dish', 'protein'),
 'burekas_cheese': (2988, 'בורקס גבינה', 'gluten,dairy,egg', 'vg', 'dish', 'carb'),
 'jachnun': (3030, "ג'חנון", 'gluten,dairy', 'vg', 'dish', 'carb'),
 'malawach': (3025, 'מלאווח', 'gluten', 'v', 'dish', 'carb'),
 'kubbeh_soup': (2946, 'קובה סולת עם עוף', 'gluten', 'o', 'dish', 'carb'),
 'chicken_soup': (1530, 'מרק עוף צח', '', 'o', 'dish', 'veg'),
 'lentil_soup': (1784, 'מרק עדשים', '', 'v', 'dish', 'protein'),
 'white_bean_soup': (4371, 'מרק שעועית לבנה', '', 'v', 'dish', 'protein'),
 'tabouleh': (3093, 'טבולה', 'gluten', 'v', 'veg', 'veg'),
 'israeli_salad': (9704, 'סלט ירקות ישראלי', '', 'v', 'veg', 'veg'),
 'israeli_salad_oil': (3895, 'סלט ירקות עם שמן זית', '', 'v', 'veg', 'veg'),
 'cabbage_salad': (3865, 'סלט כרוב בשמן זית', '', 'v', 'veg', 'veg'),
 'greek_salad': (9331, 'סלט יווני עם בולגרית 5%', 'dairy', 'vg', 'veg', 'veg'),
 'eggplant_roasted': (3982, 'חציל קלוי', '', 'v', 'veg', 'veg'),
 'eggplant_tahini': (4200, 'סלט חצילים בטחינה', 'sesame', 'v', 'veg', 'fat'),
 'stuffed_vine': (9312, 'עלי גפן ממולאים', '', 'v', 'dish', 'carb'),
 'moussaka_chicken': (4383, 'מוסקה עוף', '', 'o', 'dish', 'protein'),
 'chamin': (690, 'חמין בקר', 'egg,gluten', 'o', 'dish', 'carb'),
 'pizza': (2913, 'פיצה', 'gluten,dairy', 'vg', 'dish', 'carb'),
 'pancake': (2972, 'פנקייק ביתי', 'gluten,egg,dairy', 'vg', 'dish', 'carb'),
 'zucchini_pie': (4120, 'פשטידת קישואים', 'egg,dairy,gluten', 'vg', 'dish', 'protein'),
 'tuna_salad': (1489, 'סלט טונה עם ירקות', 'fish', 'o', 'dish', 'protein'),
 # vegetables
 'cucumber': (3793, 'מלפפון', '', 'v', 'veg', 'veg'),
 'tomato': (3663, 'עגבנייה', '', 'v', 'veg', 'veg'),
 'pepper_red': (3839, 'פלפל אדום', '', 'v', 'veg', 'veg'),
 'carrot': (9693, 'גזר אפוי', '', 'v', 'veg', 'veg'),
 'broccoli': (3612, 'ברוקולי', '', 'v', 'veg', 'veg'),
 'cauliflower': (3776, 'כרובית', '', 'v', 'veg', 'veg'),
 'zucchini': (9694, 'קישואים אפויים', '', 'v', 'veg', 'veg'),
 'mushrooms': (3812, 'פטריות', '', 'v', 'veg', 'veg'),
 'spinach': (3590, 'תרד', '', 'v', 'veg', 'veg'),
 'lettuce': (3809, 'חסה', '', 'v', 'veg', 'veg'),
 'cabbage': (3767, 'כרוב לבן', '', 'v', 'veg', 'veg'),
 'onion_green': (3819, 'בצל ירוק', '', 'v', 'veg', 'veg'),
 'green_beans': (3922, 'שעועית ירוקה בשום ושמן זית', '', 'v', 'veg', 'veg'),
 'beet': (3762, 'סלק', '', 'v', 'veg', 'veg'),
 'kohlrabi': (3801, 'קולרבי', '', 'v', 'veg', 'veg'),
 'pumpkin': (9508, 'דלעת', '', 'v', 'veg', 'veg'),
 'veg_grilled': (9384, 'ירקות בגריל', '', 'v', 'veg', 'veg'),
 # fats, nuts, seeds
 'olive_oil': (4443, 'שמן זית', '', 'v', 'fat', 'fat'),
 'avocado': (3223, 'אבוקדו', '', 'v', 'fat', 'fat'),
 'olives': (4282, 'זיתים שחורים', '', 'v', 'fat', 'fat'),
 'almonds': (1823, 'שקדים', 'nuts', 'v', 'fat', 'fat'),
 'walnuts': (1854, 'אגוזי מלך', 'nuts', 'v', 'fat', 'fat'),
 'cashew': (1828, 'קשיו', 'nuts', 'v', 'fat', 'fat'),
 'pistachio': (1848, 'פיסטוקים', 'nuts', 'v', 'fat', 'fat'),
 'peanuts': (8263, 'בוטנים', 'peanuts', 'v', 'fat', 'fat'),
 'peanut_butter': (1859, 'חמאת בוטנים טבעית', 'peanuts', 'v', 'fat', 'fat'),
 'flax': (1899, 'זרעי פשתן', '', 'v', 'fat', 'fat'),
 # fruit
 'banana': (3225, 'בננה', '', 'v', 'fruit', 'carb'),
 'apple': (3201, 'תפוח עץ', '', 'v', 'fruit', 'carb'),
 'orange': (3120, 'תפוז', '', 'v', 'fruit', 'carb'),
 'dates': (8213, "תמר מג'הול", '', 'v', 'fruit', 'carb'),
 'strawberry': (3339, 'תות שדה', '', 'v', 'fruit', 'carb'),
 'blueberries': (3327, 'אוכמניות', '', 'v', 'fruit', 'carb'),
 'watermelon': (3322, 'אבטיח', '', 'v', 'fruit', 'carb'),
 'melon': (3228, 'מלון', '', 'v', 'fruit', 'carb'),
 'grapes': (3250, 'ענבים', '', 'v', 'fruit', 'carb'),
 'mango': (3263, 'מנגו', '', 'v', 'fruit', 'carb'),
 'pear': (3283, 'אגס', '', 'v', 'fruit', 'carb'),
 'kiwi': (3255, 'קיווי', '', 'v', 'fruit', 'carb'),
 'pomegranate': (3308, 'רימון', '', 'v', 'fruit', 'carb'),
 'fig': (3247, 'תאנה', '', 'v', 'fruit', 'carb'),
 'raisins': (3199, 'צימוקים', '', 'v', 'fruit', 'carb'),
 # other
 'honey': (4544, 'דבש', '', 'vg', 'other', 'carb'),
 'silan': (4547, 'סילאן', '', 'v', 'other', 'carb'),
 'dark_chocolate': (8810, 'שוקולד מריר 70%', 'dairy', 'vg', 'snack', 'fat'),
 'bamba': (2581, 'במבה', 'peanuts', 'v', 'snack', 'fat'),
 'halva': (4711, 'חלבה', 'sesame', 'v', 'snack', 'fat'),
 'coffee_cappuccino': (4814, 'קפוצ׳ינו', 'dairy', 'vg', 'drink', 'other'),
 'lemon_juice': (3143, 'מיץ לימון', '', 'v', 'other', 'veg'),
 'tomato_sauce_ketchup': (3700, 'קטשופ', '', 'v', 'other', 'carb'),
 'amba': (3267, 'עמבה', '', 'v', 'other', 'veg'),
 'schug': (3711, 'סחוג', '', 'v', 'other', 'veg'),
}

KEYS = ['food_energy', 'protein', 'total_fat', 'carbohydrates', 'total_dietary_fiber', 'total_sugars', 'saturated_fat', 'sodium', 'calcium', 'iron', 'vitamin_b12', 'vitamin_c']
def num(v):
    try:
        return round(float(v), 2)
    except (TypeError, ValueError):
        return None

def units_for(code):
    out, seen = [], set()
    for mida, g in uw.get(code, []):
        name = units.get(mida)
        if not name or g <= 1 or g > 1500 or name in seen or 'גרם' in name or 'קילו' in name or 'ליטר' in name:
            continue
        seen.add(name)
        out.append([name, round(g, 1)])
    return out[:5]

core = []
missing = []
for fid, (code, name, allergens, diet, cat, role) in CORE.items():
    f = foods.get(code)
    if not f:
        missing.append((fid, code)); continue
    v = {k: num(f.get(k)) for k in KEYS}
    core.append({
        'id': fid, 'code': code, 'name': name, 'officialName': f['shmmitzrach'].strip(), 'en': (f.get('english_name') or '').strip(),
        'kcal': v['food_energy'] or 0, 'protein': v['protein'] or 0, 'fat': v['total_fat'] or 0, 'carbs': v['carbohydrates'] or 0,
        'fiber': v['total_dietary_fiber'] or 0, 'sugar': v['total_sugars'], 'satFat': v['saturated_fat'], 'sodium': v['sodium'],
        'calcium': v['calcium'], 'iron': v['iron'], 'b12': v['vitamin_b12'], 'vitC': v['vitamin_c'],
        'allergens': [a for a in allergens.split(',') if a], 'diet': diet, 'category': cat, 'role': role,
        'units': units_for(code),
    })
if missing:
    print('MISSING', missing); sys.exit(1)
os.makedirs(os.path.join(ROOT, 'src/data/generated'), exist_ok=True)
json.dump({'source': 'מאגר התזונה הלאומי הישראלי, משרד הבריאות (data.gov.il, nutrition-database)', 'retrieved': '2026-11-06', 'foods': core},
          open(os.path.join(ROOT, 'src/data/generated/core-foods.json'), 'w'), ensure_ascii=False, indent=0)

# full table for search: [code, name, kcal, protein, fat, carbs, fiber, units]
full = []
for code, f in foods.items():
    if not f.get('shmmitzrach') or num(f.get('food_energy')) is None:
        continue
    name = f['shmmitzrach'].strip()
    if name.startswith('FFQ-'):
        continue
    full.append([code, name, num(f['food_energy']), num(f['protein']) or 0, num(f['total_fat']) or 0, num(f['carbohydrates']) or 0, num(f['total_dietary_fiber']) or 0, units_for(code)[:3]])
json.dump({'source': 'משרד הבריאות, מאגר התזונה הלאומי', 'foods': full}, open(os.path.join(ROOT, 'public/moh-foods.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('core', len(core), 'full', len(full))
