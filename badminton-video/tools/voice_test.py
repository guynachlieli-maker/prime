import sys, soundfile as sf
from kokoro_onnx import Kokoro
M='/tmp/claude-0/-workspace-prime/7eddd1a2-e319-5d12-8dff-9f7b08c20120/scratchpad/models/'
k=Kokoro(M+'kokoro.onnx',M+'voices.bin')
print(sorted(k.get_voices()))
txt="A shuttlecock weighs about five grams. It's light, which helps it launch this fast."
w=len(txt.split())
for v in ['am_michael','am_adam','bm_george','am_onyx','bm_daniel']:
    try:
        s,sr=k.create(txt,voice=v,speed=1.0,lang='en-us' if v[0]=='a' else 'en-gb')
        print(v, round(len(s)/sr,2),'s', round(w/(len(s)/sr)*60),'wpm')
        sf.write(f'/tmp/vt_{v}.wav',s,sr)
    except Exception as e: print(v,'ERR',e)
