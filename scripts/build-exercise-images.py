"""Packs the free-exercise-db photos (public domain) into the app, so they work offline and inside
embedded viewers that block external images.
usage: python3 -I scripts/build-exercise-images.py <dir with downloaded jpgs named Folder_0.jpg> public/exercises.json public/ex-img
Writes public/ex-img/pack-N.json ({path: dataURL}) and public/ex-img/index.json ({exerciseId: packN}).
"""
import base64, io, json, os, sys
from PIL import Image

src, ex_json, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
ex = json.load(open(ex_json))['exercises']
PACK = 110  # exercises per pack (~1-2 MB)
index, packs = {}, []
for i in range(0, len(ex), PACK):
    packs.append(ex[i:i + PACK])
total = 0
for n, group in enumerate(packs):
    data = {}
    for x in group:
        index[x[0]] = n
        for p in x[12]:
            f = os.path.join(src, p.replace('/', '_'))
            if not os.path.exists(f):
                continue
            im = Image.open(f).convert('RGB')
            w = 420
            im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, 'WEBP', quality=62, method=6)
            data[p] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
    s = json.dumps(data, separators=(',', ':'))
    total += len(s)
    open(os.path.join(out, f'pack-{n}.json'), 'w').write(s)
json.dump(index, open(os.path.join(out, 'index.json'), 'w'), separators=(',', ':'))
print(len(packs), 'packs', round(total / 1e6, 1), 'MB')
