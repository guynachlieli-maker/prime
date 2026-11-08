import json, sys, whisper
W = sys.argv[1]
m = whisper.load_model('turbo')
tl = json.load(open(f'{W}/timeline.json'))
for l in tl['lines']:
    r = m.transcribe(l['file'], language='he', fp16=False, temperature=0)
    print(f"{l['id']:7s} | script: {l['text']}\n        | heard : {r['text'].strip()}")
