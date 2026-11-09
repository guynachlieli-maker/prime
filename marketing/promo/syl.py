# Synthesizes variants of the "menu" line and counts syllables in the word "מגוון" (meguvan = 3, migvan = 2)
import asyncio, os, sys, io, subprocess, json
import numpy as np, edge_tts
from scipy.signal import butter, sosfilt, find_peaks
W = sys.argv[1]
V = {
 'plain_comma': 'תפריט ישראלי, מגוון, שמשתנה לפי האימון שלך.',
 'plain_nocomma': 'תפריט ישראלי מגוון, שמשתנה לפי האימון שלך.',
 'shuruk': 'תפריט ישראלי מגוּוָן, שמשתנה לפי האימון שלך.',
 'kubutz': 'תפריט ישראלי מְגֻוָּן, שמשתנה לפי האימון שלך.',
 'shuruk2': 'תפריט ישראלי מְגוּוָּן, שמשתנה לפי האימון שלך.',
 'phon': 'תפריט ישראלי מגוּבָן, שמשתנה לפי האימון שלך.',
}
async def synth(t):
    c = edge_tts.Communicate(t, 'he-IL-AvriNeural', rate='+9%', proxy=os.environ.get('HTTPS_PROXY'), boundary='WordBoundary')
    audio = bytearray(); words = []
    async for ch in c.stream():
        if ch['type'] == 'audio': audio += ch['data']
        elif ch['type'] == 'WordBoundary': words.append((ch['offset'] / 1e7, ch['duration'] / 1e7, ch['text']))
    return bytes(audio), words
for k, t in V.items():
    a, words = asyncio.run(synth(t))
    open(f'{W}/syl_{k}.mp3', 'wb').write(a)
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', f'{W}/syl_{k}.mp3', '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True).stdout
    x = np.frombuffer(pcm, np.int16).astype(float)
    st, du, w = words[2]
    seg = x[int(st * 16000): int((st + du) * 16000)]
    # vowel energy envelope: 300-1000 Hz band, 10 ms frames
    b = sosfilt(butter(4, [300, 1000], 'band', fs=16000, output='sos'), seg)
    env = np.sqrt(np.convolve(b ** 2, np.ones(160) / 160, 'same'))[::160]
    env = np.convolve(env, np.ones(5) / 5, 'same')
    pk, _ = find_peaks(env, prominence=env.max() * 0.18, distance=7)
    print(f'{k:14s} word={w} dur={du:.2f}s syllables={len(pk)}')
