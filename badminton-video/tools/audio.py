#!/usr/bin/env python3
"""Synthesise the music bed + SFX stems from build/timeline.json and mix with the narration."""
import json, os
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, resample_poly
from scipy.ndimage import uniform_filter1d

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, "build")
SR = 48000
tl = json.load(open(os.path.join(B, "timeline.json")))
N = int((tl["total"] + 1.0) * SR)
rng = np.random.default_rng(7)
M, SCN = tl["marks"], tl["scenes"]


def tt(n): return np.arange(n) / SR
def env_ad(n, a=.003, d=.2):
    t = tt(n); return np.minimum(t / max(a, 1e-4), 1) * np.exp(-t / d)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def add(buf, x, t0, gain=1.0):
    a = int(t0 * SR)
    if a >= len(buf) or a < 0: return
    b = min(len(buf), a + len(x)); buf[a:b] += x[:b - a] * gain
def noise(n): return rng.standard_normal(n)

# ------------------------------------------------------------------ SFX
def whoosh(dur=.6, gain=.8):
    n = int(dur * SR); t = tt(n); x = noise(n)
    f = np.linspace(400, 5000, n) * (1 + .0 * t)
    # swept band-pass via block filtering
    out = np.zeros(n); blocks = 24; bl = n // blocks
    for i in range(blocks):
        c = 350 * (14 ** (i / blocks)); s = max(0, i * bl); e = n if i == blocks - 1 else s + bl
        out[s:e] = bp(x[s:e], c * .7, min(c * 1.5, 20000), 2)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.6
    return out * env * gain * 1.6
def crack(gain=1.0):
    n = int(.35 * SR); t = tt(n); x = hp(noise(n), 1800) * np.exp(-t / .018) * 1.0
    body = np.sin(2 * np.pi * (180 * np.exp(-t * 30) + 60) * t) * np.exp(-t / .06) * .8
    return (x + body) * gain * .9
def thud(gain=1.0):
    n = int(.7 * SR); t = tt(n)
    f = 38 + 70 * np.exp(-t * 22); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t / .22) + lp(noise(n), 400) * np.exp(-t / .04) * .6) * gain * 1.1
def bass(gain=1.0):
    n = int(1.6 * SR); t = tt(n)
    f = 34 + 90 * np.exp(-t * 14); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t / .55) * 1.2 + lp(noise(n), 250) * np.exp(-t / .08) * .5) * gain
def tick(gain=.5):
    n = int(.05 * SR); t = tt(n)
    return np.sin(2 * np.pi * 2400 * t) * np.exp(-t / .006) * gain * .55
def blip(f=600, gain=.6):
    n = int(.22 * SR); t = tt(n)
    return (np.sin(2 * np.pi * f * t) + .4 * np.sin(2 * np.pi * f * 2 * t)) * env_ad(n, .004, .07) * gain * .35
def sting(gain=.7):
    n = int(.8 * SR); t = tt(n)
    x = (np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 660 * t)) * env_ad(n, .005, .25) * .3
    return (x + whoosh(.5, .3)[:n] if False else x) * gain
def engine(dur):
    n = int(dur * SR); t = tt(n)
    f = 180 + 900 * (t / dur) ** 1.4; ph = 2 * np.pi * np.cumsum(f) / SR
    x = (2 * ((ph / (2 * np.pi)) % 1) - 1) * .5 + np.sin(ph * 2) * .3
    x = lp(x, 3500) * np.minimum(t / .25, 1) * np.minimum((dur - t) / .15, 1)
    return x * .22

# ------------------------------------------------------------------ build SFX stem
sfx = np.zeros(N)
for e in tl["events"]:
    ty, t0, g = e["type"], e["t"], e.get("gain", 1.0)
    if ty == "whoosh": add(sfx, whoosh(e.get("dur", .6), g), max(0, t0 - e.get("dur", .6) * .35))
    elif ty == "crack": add(sfx, crack(g), t0)
    elif ty == "thud": add(sfx, thud(g * .8), t0)
    elif ty == "bass": add(sfx, bass(g), t0)
    elif ty == "tick": add(sfx, tick(g), t0)
    elif ty == "blip": add(sfx, blip(e.get("f", 600), g), t0)
    elif ty == "sting": add(sfx, sting(g), t0)
    elif ty == "engine": add(sfx, engine(e["dur"]), t0)

# ------------------------------------------------------------------ music bed
BPM = 120.0; beat = 60 / BPM
t = tt(N)
def pts_env(points):
    xs, ys = zip(*points); return np.interp(t, xs, ys)
S = lambda n, k='start': SCN[n][k]
inten = pts_env([
    (0, .45), (S('cold', 'end') - .3, .6), (S('f1'), .55), (S('shuttle'), .5), (S('smash'), .6), (M['contact'], .85),
    (S('records'), .8), (S('honest') - .05, .9), (S('honest') + .4, .12), (S('tennis') - .3, .12), (S('tennis'), .85),
    (S('why'), .55), (S('why', 'end'), .6), (S('close'), .95), (S('close', 'end'), 1.0), (S('endcard'), .0), (S('endcard') + .5, .0)])
# 0.5 s total drop before the 565 reveal, returns with the bass hit
gate = np.ones(N)
gate[(t >= M['musicDrop']) & (t < M['reveal565'])] = 0
gate = uniform_filter1d(gate, int(.01 * SR))
# kick/pulse
pulse = np.zeros(N)
k = int(.35 * SR); tk = tt(k)
kick = np.sin(2 * np.pi * np.cumsum(48 + 70 * np.exp(-tk * 30)) / SR) * np.exp(-tk / .13)
for b in np.arange(0, tl["total"] + 1, beat): add(pulse, kick, b, 1.0)
# offbeat hats
hat = hp(noise(int(.06 * SR)), 7000) * np.exp(-tt(int(.06 * SR)) / .012) * .35
hats = np.zeros(N)
for b in np.arange(beat / 2, tl["total"] + 1, beat): add(hats, hat, b, 1.0)
for b in np.arange(beat / 4, tl["total"] + 1, beat): add(hats, hat, b, .4)
# arpeggio (A minor) - saw through a low-pass that opens with intensity
notes = [57, 60, 64, 67, 64, 60, 59, 62, 65, 69, 65, 62]
arp = np.zeros(N); st = beat / 2
for i, b in enumerate(np.arange(0, tl["total"] + 1, st)):
    f = 440 * 2 ** ((notes[i % len(notes)] - 69) / 12) / 2
    n = int(st * 1.6 * SR); tn = tt(n); ph = (f * tn) % 1
    x = (2 * ph - 1) * np.exp(-tn / .22)
    add(arp, lp(x, 1800, 2), b, .35)
arp = arp * np.clip((inten - .35) * 2, 0, 1)
# sub drone + pad
drone = np.sin(2 * np.pi * 55 * t) * .25 + np.sin(2 * np.pi * 82.4 * t) * .12
pad = (np.sin(2 * np.pi * 220 * t) + np.sin(2 * np.pi * 261.6 * t) * .8 + np.sin(2 * np.pi * 329.6 * t) * .6) * .05
mus = (pulse * .55 * np.clip(inten * 1.4, 0, 1) + hats * .5 * np.clip((inten - .5) * 2.5, 0, 1) + arp * .7 + drone * inten + pad * inten) * gate
# honesty beat: single pulse only -> already low intensity; why scene: gentle synth (no hats)
why = (t >= S('why')) & (t < S('why', 'end'))
mus[why] = (mus * 0.8 + 0)[why]
# closing hit
add(mus, bass(1.0) * .9, M['hit'], 1.0)
# end card fade out
mus *= np.clip((tl["total"] + .6 - t) / .8, 0, 1)
mus *= 10 ** (-24 / 20) / max(np.sqrt(np.mean(mus[:int(tl['total'] * SR)] ** 2)), 1e-6) * .9

# ------------------------------------------------------------------ narration to 48k
nar, sr = sf.read(os.path.join(B, "narration_24k.wav"))
nar = resample_poly(nar, SR // sr, 1)
narr = np.zeros(N); narr[:min(N, len(nar))] = nar[:N]
# sidechain duck: smoothed narration envelope
e = np.abs(narr); w = int(.12 * SR)
env = uniform_filter1d(e, w); env = np.clip(env / .06, 0, 1)
env = uniform_filter1d(env, int(.25 * SR))
mus *= 1 - .5 * env
sfx *= 10 ** (-9 / 20)

def save(name, x, stereo=False):
    x = x[:int((tl["total"] + .25) * SR)]
    sf.write(os.path.join(B, name), x, SR, subtype='PCM_16')
save("stem_narration.wav", narr)
save("stem_music.wav", mus)
save("stem_sfx.wav", sfx)
mix = narr * 1.0 + mus * 1.0 + sfx * 1.0
pk = np.max(np.abs(mix)); print("mix peak", round(float(pk), 3))
mix = mix / max(pk, 1e-6) * .89
save("mix.wav", mix)
print("audio ok", round(len(mix) / SR, 2), "s")
