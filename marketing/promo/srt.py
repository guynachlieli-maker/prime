"""Subtitle file from the voice timeline, in the same chunks the video shows.
usage: python3 srt.py <workdir>  ->  <workdir>/prime-promo.he.srt"""
import json, re, sys, os
W = sys.argv[1]
tl = json.load(open(os.path.join(W, 'timeline.json'), encoding='utf8'))
def ts(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f'{h:02}:{m:02}:{s:02},{ms:03}'
cues = []
for l in tl['lines']:
    toks = l['text'].split()
    words = [{**w, 'w': toks[i] if i < len(toks) else w['w']} for i, w in enumerate(l['words'])]
    cur = []
    for i, w in enumerate(words):
        cur.append(w)
        if re.search(r'[.,!?]$', w['w']) or len(cur) >= 4 or i == len(words) - 1:
            end = words[i + 1]['t'] if i + 1 < len(words) else l['end']
            cues.append((cur[0]['t'], end, ' '.join(x['w'] for x in cur)))
            cur = []
open(os.path.join(W, 'prime-promo.he.srt'), 'w', encoding='utf8').write(''.join(f'{i + 1}\n{ts(a)} --> {ts(b)}\n{t}\n\n' for i, (a, b, t) in enumerate(cues)))
print(len(cues), 'cues')
