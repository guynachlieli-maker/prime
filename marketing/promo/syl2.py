import asyncio, os, sys, subprocess
import numpy as np, edge_tts, whisper
from scipy.signal import butter, sosfilt, find_peaks
W = sys.argv[1]
V = {
 'me_gu_van': 'תפריט ישראלי מְגוּוָן, שמשתנה לפי האימון שלך.',
 'gimel_dagesh': 'תפריט ישראלי מגֻוָן, שמשתנה לפי האימון שלך.',
 'adj_context': 'תפריט ישראלי, עשיר ומגוון, שמשתנה לפי האימון שלך.',
 'very': 'תפריט ישראלי מגוון מאוד, שמשתנה לפי האימון שלך.',
}
async def synth(t):
    c = edge_tts.Communicate(t, 'he-IL-AvriNeural', rate='+9%', proxy=os.environ.get('HTTPS_PROXY'), boundary='WordBoundary')
    audio = bytearray(); words = []
    async for ch in c.stream():
        if ch['type'] == 'audio': audio += ch['data']
        elif ch['type'] == 'WordBoundary': words.append((ch['offset'] / 1e7, ch['duration'] / 1e7, ch['text']))
    return bytes(audio), words
m = whisper.load_model('turbo')
for k, t in V.items():
    a, words = asyncio.run(synth(t))
    f = f'{W}/syl2_{k}.mp3'; open(f, 'wb').write(a)
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True).stdout
    x = np.frombuffer(pcm, np.int16).astype(float)
    import re
    wi = next(i for i, w in enumerate(words) if 'מג' in re.sub('[\u0591-\u05C7]', '', w[2]))
    st, du, w = words[wi]
    seg = x[int(st * 16000): int((st + du) * 16000)]
    b = sosfilt(butter(4, [300, 1000], 'band', fs=16000, output='sos'), seg)
    env = np.sqrt(np.convolve(b ** 2, np.ones(160) / 160, 'same'))[::160]; env = np.convolve(env, np.ones(5) / 5, 'same')
    pk, _ = find_peaks(env, prominence=env.max() * 0.18, distance=7)
    r = m.transcribe(f, language='he', fp16=False, temperature=0)['text'].strip()
    print(f'{k:15s} syl={len(pk)} dur={du:.2f} | {r}')
