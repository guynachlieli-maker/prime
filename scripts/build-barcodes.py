"""
Builds public/il-barcodes.json: every barcoded product sold by the Israeli chains whose
price-transparency files were collected (law: חוק קידום התחרות בענף המזון, 2014).
Fields: barcode, name, manufacturer, country, quantity, unit. No nutrition values (the files have none).
Usage: python3 -I scripts/build-barcodes.py <dir with PriceFull*.gz files> [more dirs...]
"""
import gzip, io, json, os, re, sys, zipfile
import xml.etree.ElementTree as ET
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def ean_ok(code):
    if not re.fullmatch(r'\d{8}|\d{12,14}', code):
        return False
    d = [int(c) for c in code]
    chk = d.pop()
    s = sum(x * (3 if i % 2 == 0 else 1) for i, x in enumerate(reversed(d)))
    return (10 - s % 10) % 10 == chk

def read(path):
    raw = open(path, 'rb').read()
    if raw[:2] == b'\x1f\x8b':
        raw = gzip.decompress(raw)
    elif raw[:2] == b'PK':
        z = zipfile.ZipFile(io.BytesIO(raw))
        raw = z.read(z.namelist()[0])
    return raw

def text(el, *tags):
    for t in tags:
        x = el.find(t)
        if x is None:
            for c in el:
                if c.tag.lower() == t.lower():
                    x = c
                    break
        if x is not None and x.text and x.text.strip():
            return re.sub(r'\s+', ' ', x.text.strip())
    return ''

products, chains_seen = {}, {}
for d in sys.argv[1:]:
    for f in sorted(os.listdir(d)):
        if 'PriceFull' not in f:
            continue
        chain = f.split('__')[0]
        try:
            root = ET.fromstring(read(os.path.join(d, f)))
        except Exception as e:
            print('skip', f, e)
            continue
        n = 0
        for item in root.iter():
            if item.tag.lower() != 'item':
                continue
            code = text(item, 'ItemCode').lstrip('0')
            if len(code) in (7, 11, 12):  # leading zeros stripped from EAN-8 / EAN-13 / UPC
                code = code.zfill(8 if len(code) == 7 else 13)
            if text(item, 'ItemType') == '0' or not ean_ok(code) or code.startswith('2'):
                continue  # internal codes and in-store (weighed) items
            name = text(item, 'ItemName', 'ItemNm', 'ManufacturerItemDescription')
            if not name:
                continue
            rec = products.get(code)
            country = text(item, 'ManufactureCountry')[:20]
            if country in ('לא ידוע', 'לא ידועה', 'unknown', 'Unknown', '0'):
                country = ''
            qty = text(item, 'Quantity')
            try:
                qty = ('%g' % float(qty)) if qty else ''
            except ValueError:
                qty = ''
            row = [code, name[:70], text(item, 'ManufacturerName')[:40], country, qty, text(item, 'UnitQty', 'UnitOfMeasure')[:10]]
            if not rec or len(row[1]) > len(rec[1]):
                products[code] = row
            n += 1
        chains_seen[chain] = chains_seen.get(chain, 0) + n
out = {'source': 'קובצי שקיפות מחירים של רשתות השיווק (חוק קידום התחרות בענף המזון)', 'chains': sorted(chains_seen), 'products': sorted(products.values())}
json.dump(out, open(os.path.join(ROOT, 'public/il-barcodes.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('chains', chains_seen)
print('unique barcodes', len(products))
