"""
Builds public/il-products.json from Open Food Facts search pages (Israeli products).
Open Food Facts data: Open Database License (ODbL). Community-edited: values are shown to users
as "check against the label".
Usage: python3 -I scripts/build-products.py <dir with *.json search pages>
"""
import glob, json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
seen = {}
for path in sorted(glob.glob(os.path.join(sys.argv[1], '*.json'))):
    try:
        d = json.load(open(path))
    except Exception:
        continue
    for p in d.get('products', []):
        code = str(p.get('code') or '').strip()
        n = p.get('nutriments') or {}
        kcal = n.get('energy-kcal_100g')
        if kcal is None and n.get('energy_100g') is not None:
            kcal = float(n['energy_100g']) / 4.184
        name = (p.get('product_name_he') or p.get('product_name') or '').strip()
        if not code.isdigit() or not name or kcal is None:
            continue
        def g(k):
            try:
                v = float(n.get(k, 0) or 0)
                return round(v, 1) if v >= 0 else 0
            except (TypeError, ValueError):
                return 0
        try:
            kcal = round(float(kcal))
        except (TypeError, ValueError):
            continue
        if kcal < 0 or kcal > 950:
            continue
        brand = (p.get('brands') or '').split(',')[0].strip()
        serving = p.get('serving_quantity')
        try:
            serving = round(float(serving), 1) if serving else None
        except (TypeError, ValueError):
            serving = None
        allergens = ','.join(a.split(':')[-1] for a in (p.get('allergens_tags') or []))
        seen[code] = [code, name[:80], brand[:40], kcal, g('proteins_100g'), g('fat_100g'), g('carbohydrates_100g'), g('fiber_100g'), serving, allergens]
out = {'source': 'Open Food Facts (ODbL), Israeli products, community-edited: check against the label', 'products': list(seen.values())}
json.dump(out, open(os.path.join(ROOT, 'public/il-products.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('products', len(seen))
