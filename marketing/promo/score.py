"""Original score + sound design for the PRIME promo, synthesized from scratch (no samples, no licences).
Writes music.wav (stereo) and sfx.wav (stereo), both the length of the timeline.
usage: python score.py <workdir>
"""
import json, sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

W = sys.argv[1]
TL = json.load(open(f'{W}/timeline.json'))
L = {l['id']: l for l in TL['lines']}
SR = 48000
DUR = TL['total'] + 0.5
N = int(DUR * SR)
rng = np.random.default_rng(7)

def t_arr(n): return np.arange(n) / SR
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], 'band', fs=SR, output='sos'), x)
def env(n, a, d, curve=4.0):
    e = np.ones(n); ai = int(a * SR)
    if ai > 0: e[:ai] = np.linspace(0, 1, ai)
    tail = np.arange(n - ai) / SR
    e[ai:] = np.exp(-curve * tail / max(d, 1e-3))
    return e
def place(buf, x, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= len(buf): return
    x = x[: len(buf) - i]
    l, r = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
    if x.ndim == 1:
        buf[i:i + len(x), 0] += x * gain * l * 1.414
        buf[i:i + len(x), 1] += x * gain * r * 1.414
    else:
        buf[i:i + len(x)] += x * gain
def saw(f, n, detune=0.0):
    ph = np.cumsum(np.full(n, f * (1 + detune)) / SR)
    return 2 * (ph % 1) - 1
def note(m): return 440 * 2 ** ((m - 69) / 12)

# simple stereo reverb: exponentially decaying noise impulse
def reverb(x, secs=2.2, mix=0.25):
    n = int(secs * SR)
    ir_l = rng.standard_normal(n) * np.exp(-6 * np.arange(n) / n)
    ir_r = rng.standard_normal(n) * np.exp(-6 * np.arange(n) / n)
    ir_l, ir_r = lp(ir_l, 6000), lp(ir_r, 6000)
    mono = x.mean(axis=1) if x.ndim == 2 else x
    wl = fftconvolve(mono, ir_l)[: len(mono)]; wr = fftconvolve(mono, ir_r)[: len(mono)]
    wet = np.stack([wl, wr], 1); wet /= (np.abs(wet).max() + 1e-9)
    dry = x if x.ndim == 2 else np.stack([x, x], 1)
    return dry * (1 - mix) + wet * mix * np.abs(dry).max()

music = np.zeros((N, 2)); sfx = np.zeros((N, 2))
BPM = 100; B = 60 / BPM
brand_hit = L['brand']['words'][0]['t'] + 0.02
groove_start = brand_hit
cta_hit = L['cta']['start'] + 0.05
groove_end = cta_hit - 0.55
end = TL['total']

# ---------- 1. intro drone (0 -> brand hit) ----------
n = int((brand_hit + 0.2) * SR)
tt = t_arr(n)
drone = 0.5 * np.sin(2 * np.pi * note(33) * tt) + 0.25 * lp(saw(note(45), n) + saw(note(45), n, 0.004), 500)
drone *= np.minimum(1, tt / 1.2) * (0.55 + 0.45 * np.minimum(1, tt / brand_hit))
# tension pulse (heartbeat) on beats
for k in range(int(brand_hit / B)):
    tb = k * B
    if tb > brand_hit - 0.8: break
    m = int(0.35 * SR)
    p = np.sin(2 * np.pi * 52 * t_arr(m)) * env(m, 0.005, 0.18)
    place(music, p, tb, 0.55)
    place(music, p * 0.6, tb + 0.22, 0.55)
place(music, drone, 0, 0.5)
# riser into the brand reveal
rs, re = brand_hit - 2.4, brand_hit - 0.12
m = int((re - rs) * SR); tr = t_arr(m) / (re - rs)
noise = rng.standard_normal(m)
riser = np.zeros(m)
for i, seg in enumerate(np.array_split(np.arange(m), 24)):  # stepped band sweep
    f = 300 * (12 ** (i / 23))
    riser[seg] = bp(noise[seg], f, min(f * 2.2, 20000))
riser *= tr ** 2.2
tone = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (tr * 2)) / SR) * tr ** 3 * 0.35
place(music, riser + tone, rs, 0.55)

# ---------- impacts ----------
def impact(gain=1.0, length=3.5):
    m = int(length * SR); ti = t_arr(m)
    sub = np.sin(2 * np.pi * (34 + 60 * np.exp(-ti * 18)) * ti) * env(m, 0.002, 1.6, 3.2)
    crack = hp(rng.standard_normal(m), 900) * env(m, 0.001, 0.25, 5)
    body = lp(rng.standard_normal(m), 250) * env(m, 0.002, 0.6, 4) * 2.5
    x = sub * 1.0 + crack * 0.35 + body * 0.25
    return reverb(x, 3.0, 0.3) * gain
place(sfx, impact(1.0), brand_hit - 0.01)
place(sfx, impact(0.95), cta_hit - 0.01)
# reverse swell before the CTA hit
m = int(1.2 * SR); sw = hp(rng.standard_normal(m), 2500) * (np.linspace(0, 1, m) ** 3)
place(sfx, sw, cta_hit - 1.2, 0.25)

# ---------- 2. groove (brand -> before CTA) ----------
chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # Am F C G
roots = [33, 29, 36, 31]
beat_t = groove_start
k = 0
while beat_t < groove_end:
    bar_beat = k % 4
    chord_i = (k // 8) % 4
    # kick: 1 and 3, plus pickup
    if bar_beat in (0, 2) or (bar_beat == 3 and k % 8 == 7):
        m = int(0.5 * SR); tk = t_arr(m)
        kick = np.sin(2 * np.pi * (48 + 110 * np.exp(-tk * 28)) * tk) * env(m, 0.001, 0.32, 4)
        kick += hp(rng.standard_normal(m), 3000) * env(m, 0.0005, 0.012, 6) * 0.25
        place(music, kick, beat_t if bar_beat != 3 else beat_t + B / 2, 0.9)
    # clap/snare on 2 and 4
    if bar_beat in (1, 3) and k > 3:
        m = int(0.4 * SR)
        sn = bp(rng.standard_normal(m), 900, 6000) * env(m, 0.001, 0.12, 5)
        place(music, reverb(sn, 0.9, 0.35)[:, 0], beat_t, 0.32)
    # hats: 8ths
    for h in (0, 0.5):
        m = int(0.08 * SR)
        hat = hp(rng.standard_normal(m), 8000) * env(m, 0.0005, 0.03, 6)
        place(music, hat, beat_t + h * B, 0.12 if h == 0 else 0.2, pan=0.35 if h else -0.35)
    # sub bass: root on 8ths with sidechain-like envelope
    for h in (0, 0.5):
        m = int(B / 2 * SR); tb = t_arr(m)
        f = note(roots[chord_i])
        bass = (np.sin(2 * np.pi * f * tb) + 0.3 * np.sin(2 * np.pi * 2 * f * tb)) * np.minimum(1, tb / 0.06) * env(m, 0.0, 0.5, 1.5)
        place(music, lp(bass, 400), beat_t + h * B, 0.42)
    # gold pluck arpeggio (16ths) - quiet, adds motion
    for q in range(4):
        m = int(0.3 * SR); tp = t_arr(m)
        nn = chords[chord_i][(k * 4 + q) % 3] + 12
        pl = np.sin(2 * np.pi * note(nn) * tp) * env(m, 0.002, 0.14, 5) + 0.3 * np.sin(2 * np.pi * note(nn) * 2 * tp) * env(m, 0.001, 0.06, 5)
        place(music, pl, beat_t + q * B / 4, 0.07, pan=0.4 * np.sin(k + q))
    beat_t += B; k += 1
# pads across the groove (one chord per 2 bars)
pad_buf = np.zeros((N, 2))
seg_len = 8 * B
c = 0; tseg = groove_start
while tseg < groove_end:
    n = int(min(seg_len, groove_end - tseg + 0.8) * SR); tp = t_arr(n)
    x = np.zeros(n)
    for mnote in chords[c % 4]:
        x += saw(note(mnote - 12), n, 0.003) + saw(note(mnote - 12), n, -0.004)
    x = lp(x, 1400) * np.minimum(1, tp / 0.6) * np.minimum(1, (n / SR - tp) / 0.6)
    place(pad_buf, x, tseg, 0.05)
    tseg += seg_len; c += 1
music += reverb(pad_buf, 2.5, 0.4)

# ---------- 3. outro (CTA) ----------
n = int((end - cta_hit + 0.4) * SR); to = t_arr(n)
outro = np.zeros(n)
for mnote in [45, 52, 57, 60, 64]:
    outro += np.sin(2 * np.pi * note(mnote) * to) * (0.5 if mnote < 50 else 0.18)
outro = lp(outro + 0.2 * lp(saw(note(45), n), 600), 2500) * env(n, 0.05, end - cta_hit, 1.2)
place(music, reverb(outro, 3.0, 0.45), cta_hit, 0.38)
# final low boom on the end card
place(sfx, impact(0.5, 2.5), L['cta']['words'][-1]['t'] + 0.35)

# ---------- 4. transitions & UI sounds ----------
def whoosh(length=0.45, up=True):
    m = int(length * SR); tw = t_arr(m) / length
    x = np.zeros(m); nz = rng.standard_normal(m)
    for i, seg in enumerate(np.array_split(np.arange(m), 16)):
        f = 500 * (8 ** ((i / 15) if up else 1 - i / 15))
        x[seg] = bp(nz[seg], f, min(f * 3, 18000))
    return x * np.sin(np.pi * tw) ** 1.5
scene_starts = [L[i]['start'] - 0.15 for i in ['one', 'camera', 'menu', 'train', 'body', 'trust']]
for i, ts in enumerate(scene_starts):
    place(sfx, whoosh(0.5, i % 2 == 0), ts - 0.2, 0.5, pan=-0.5 if i % 2 else 0.5)
place(sfx, whoosh(0.6, False), L['why']['start'] - 0.25, 0.35)
# hook: card drops (thuds) + red X stamps
for i in range(3):
    m = int(0.25 * SR); tk = t_arr(m)
    th = np.sin(2 * np.pi * (90 + 60 * np.exp(-tk * 30)) * tk) * env(m, 0.001, 0.12, 4)
    place(sfx, th, 0.05 + i * 0.12 + 0.3, 0.5, pan=(i - 1) * 0.5)
    m = int(0.18 * SR); st = bp(rng.standard_normal(m), 1200, 5000) * env(m, 0.001, 0.05, 6)
    place(sfx, st, 0.75 + i * 0.13 + 0.05, 0.35, pan=(i - 1) * 0.4)
# "נכשלות" slam
m = int(0.6 * SR); tk = t_arr(m)
slam = np.sin(2 * np.pi * (60 + 80 * np.exp(-tk * 20)) * tk) * env(m, 0.001, 0.3, 4) + hp(rng.standard_normal(m), 2000) * env(m, 0.001, 0.04, 6) * 0.3
place(sfx, slam, 0.95, 0.6)
# camera shutter + scan beep
shutter = L['camera']['start'] + 0.7
m = int(0.12 * SR)
click = hp(rng.standard_normal(m), 2500) * env(m, 0.0005, 0.02, 6)
place(sfx, click, shutter, 0.5); place(sfx, click * 0.8, shutter + 0.06, 0.4)
m = int(0.6 * SR); tb = t_arr(m)
scan = np.sin(2 * np.pi * (900 + 600 * tb) * tb) * env(m, 0.01, 0.5, 2) * 0.4
place(sfx, scan, shutter + 0.2, 0.18)
def pop(f=880):
    m = int(0.18 * SR); tp = t_arr(m)
    return np.sin(2 * np.pi * f * tp * (1 + 0.5 * np.exp(-tp * 40))) * env(m, 0.002, 0.08, 5)
for tpop, f in [(L['camera']['start'] + 2.2, 740), (L['camera']['start'] + 3.2, 988), (L['menu']['start'] + 0.4, 740), (L['menu']['start'] + 2.2, 880), (L['menu']['start'] + 2.8, 1046),
                (L['train']['start'] + 2.4, 880), (L['train']['start'] + 4.3, 988), (L['body']['start'] + 2.5, 1174)]:
    place(sfx, pop(f), tpop, 0.22)
# counter ticks
for start, length in [(L['camera']['start'] + 2.2, 1.4), (L['train']['start'] + 2.4, 1.1)]:
    for j in range(int(length / 0.05)):
        m = int(0.02 * SR); tk = hp(rng.standard_normal(m), 5000) * env(m, 0.0002, 0.006, 6)
        place(sfx, tk, start + j * 0.05, 0.08 * (1 - j * 0.05 / length))
# trust: three word hits + seal pops
for w in L['trust']['words'][:5]:
    if w['w'].strip('.,') in ('חיטוב', 'מסה', 'ריקומפוזיציה'):
        m = int(0.4 * SR); tk = t_arr(m)
        hit = np.sin(2 * np.pi * (70 + 50 * np.exp(-tk * 25)) * tk) * env(m, 0.001, 0.2, 4)
        place(sfx, hit, w['t'] - 0.03, 0.45)
# body: soft "shimmer" on each step
for dt in (1.0, 2.1):
    m = int(0.7 * SR); ts_ = t_arr(m)
    sh = sum(np.sin(2 * np.pi * f * ts_) for f in (1318, 1760, 2093)) * env(m, 0.01, 0.5, 3) / 3
    place(sfx, sh, L['body']['start'] + dt, 0.12)

for name, buf in (('music', music), ('sfx', sfx)):
    buf = buf / (np.abs(buf).max() + 1e-9) * 0.9
    wavfile.write(f'{W}/{name}.wav', SR, (buf * 32767).astype(np.int16))
print('ok', DUR)
