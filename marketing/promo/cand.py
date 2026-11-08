import asyncio, os, sys, whisper, edge_tts
W = sys.argv[1]
C = {
 'aero': ['לבית או לאירובי.', 'לבית או לְאֵירוֹבִּי.', 'לבית או לאֵירובי.', 'לבית או לָאֵירוֹבִּי.', 'לבית, או לאימוני אירובי.', 'לבית או לאירובִּיק.'],
 'coach': ['Prime. המאמן שתמיד איתך.', 'Prime. הַמְּאַמֵּן שתמיד איתך.', 'Prime. המְאַמן שתמיד איתך.', 'Prime. ה מאמן שתמיד איתך.', 'Prime. המאמן, שתמיד איתך.', 'Prime. הַמְאַמֵּן שתמיד איתך.'],
}
async def synth(t, f):
    c = edge_tts.Communicate(t, 'he-IL-AvriNeural', rate='+9%', proxy=os.environ.get('HTTPS_PROXY'))
    await c.save(f)
m = whisper.load_model('turbo')
for k, opts in C.items():
    for i, t in enumerate(opts):
        f = f'{W}/cand_{k}_{i}.mp3'
        asyncio.run(synth(t, f))
        r = m.transcribe(f, language='he', fp16=False, temperature=0)
        print(k, i, '|', t, '=>', r['text'].strip())
