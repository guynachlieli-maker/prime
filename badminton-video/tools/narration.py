#!/usr/bin/env python3
"""Generate the narration track (Kokoro TTS) and lay out the master timeline.

Single source of truth for timing: writes build/timeline.json, which the
renderer (scene.js) and the audio synth (audio.py) both read.
"""
import json, os, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = os.environ.get(
    "KOKORO_MODELS",
    "/tmp/claude-0/-workspace-prime/7eddd1a2-e319-5d12-8dff-9f7b08c20120/scratchpad/models/",
)
OUT = os.path.join(ROOT, "build")
os.makedirs(OUT, exist_ok=True)
SR = 24000
VOICE = "am_michael"       # male, mid-range, warm
BASE = 1.10                # ~165-170 wpm after pauses
SLOW = BASE * 0.72         # "slow down by a third" lines

# (id, text, speed multiplier, pause before (s))
# Numbers are spelled out for the TTS; on-screen text uses the numerals.
SCENES = [
    ("cold", 5.0, [
        ("c1", "This is the fastest hit ever recorded in badminton.", 1.0, 0.0),
        ("c2", "Five sixty-five kilometers per hour.", 1.0, 0.0),   # pause handled specially
    ]),
    ("f1", 5.6, [
        ("f1a", "That's faster than a Formula 1 car.", 1.0, 0.0),
        ("f1b", "Three hundred seventy-two point six kilometers per hour.", 1.0, 0.4),
    ]),
    ("shuttle", 9.0, [
        ("s1", "A shuttlecock weighs about five grams.", 1.0, 0.0),
        ("s2", "It's light, which helps it launch this fast.", 1.0, 0.1),
    ]),
    ("smash", 9.0, [
        ("m1", "A smash starts with the whole body, not just the arm.", 1.0, 0.5),
    ]),
    ("records", 12.0, [
        ("r1", "In 2013, a Malaysian player hit four ninety-three.", 1.0, 0.0),
        ("r2", "In 2023, an Indian player hit five sixty-five.", 1.0, 0.25),
        ("r3", "The women's record is four thirty-eight, set by a Malaysian player.", 1.0, 0.25),
    ]),
    ("honest", 13.0, [
        ("h1", "Honest caveat: the five sixty-five came from a controlled test, not a match.", 0.72, 0.5),
        ("h2", "In a real match, the record is four twenty-six.", 0.72, 0.5),
    ]),
    ("tennis", 12.5, [
        ("t1", "Tennis's fastest recorded serve is two sixty-three point four kilometers per hour.", 1.0, 0.5),
        ("t2", "It was recorded at a Challenger event, not a top-tier tour match.", 1.0, 0.25),
    ]),
    ("why", 9.5, [
        ("w1", "A shuttle loses speed fast.", 1.0, 0.3),
        ("w2", "A tennis ball doesn't lose it the same way.", 1.0, 0.2),
        ("w3", "That's why the numbers aren't directly comparable.", 1.0, 0.2),
    ]),
    ("close", 5.6, [
        ("z1", "So which sport is faster?", 0.76, 0.5),
        ("z2", "Tell me in the comments.", 0.76, 0.25),
    ]),
]
END_CARD = 3.0
GAP = 0.12
FPS = 30


def trim(x, thr=0.01, keep=int(0.03 * SR)):
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - keep)
    b = min(len(x), idx[-1] + keep)
    return x[a:b]


CAPS = {
    "c1": "This is the fastest hit ever recorded in badminton.",
    "c2": "565 km/h.",
    "f1a": "That's faster than a Formula 1 car.",
    "f1b": "372.6 km/h.",
    "s1": "A shuttlecock weighs about 5 grams.",
    "s2": "It's light, which helps it launch this fast.",
    "m1": "A smash starts with the whole body, not just the arm.",
    "r1": "In 2013, a Malaysian player hit 493 km/h.",
    "r2": "In 2023, an Indian player hit 565.",
    "r3": "The women's record is 438, set by a Malaysian player.",
    "h1": "Honest caveat: the 565 came from a controlled test, not a match.",
    "h2": "In a real match, the record is 426.",
    "t1": "Tennis's fastest recorded serve is 263.4 km/h.",
    "t2": "It was recorded at a Challenger event, not a top-tier tour match.",
    "w1": "A shuttle loses speed fast.",
    "w2": "A tennis ball doesn't lose it the same way.",
    "w3": "That's why the numbers aren't directly comparable.",
    "z1": "So which sport is faster?",
    "z2": "Tell me in the comments.",
}
# fraction of the clip (by characters) at which the key number is spoken
NUM_WORD = {"r1": "four ninety", "r2": "five sixty", "r3": "four thirty", "h2": "four twenty", "t1": "two sixty",
            "h1": "five sixty", "f1b": "three hundred", "c2": "five sixty", "s1": "five grams"}


def chunks(text, n=6):
    w = text.split()
    k = -(-len(w) // n)
    per = -(-len(w) // k)
    return [" ".join(w[i:i + per]) for i in range(0, len(w), per)]


def finalize(tl):
    L, Sx, m = tl["lines"], tl["scenes"], tl["marks"]
    ev = []

    def E(t, typ, **kw):
        ev.append(dict(t=round(t, 3), type=typ, **kw))

    def countup(t0, gain=.5):
        for i in range(7):
            E(t0 + i * .07, "tick", gain=gain)

    def numat(lid):
        src = L[lid]["text"].lower()
        i = src.find(NUM_WORD[lid]) if lid in NUM_WORD else -1
        frac = max(i, 0) / len(src)
        return L[lid]["start"] + (L[lid]["end"] - L[lid]["start"]) * frac

    for lid, info in L.items():
        info["cap"] = CAPS[lid]
        dur = info["end"] - info["start"]
        ch = chunks(CAPS[lid])
        tot = sum(len(c) for c in ch)
        a = info["start"]
        info["chunks"] = []
        for c in ch:
            d = dur * len(c) / tot
            info["chunks"].append({"text": c, "start": round(a, 3), "end": round(a + d, 3)})
            a += d

    # ---- cold open
    E(0.25, "whoosh", gain=.55, dur=.6)
    m["snap"] = L["c1"]["start"] + 1.55
    E(m["snap"], "thud", gain=.5); E(m["snap"], "shake", amp=.05)
    E(m["reveal565"], "bass"); E(m["reveal565"], "punch"); E(m["reveal565"], "shake", amp=.07)
    countup(m["reveal565"])
    m["launch565"] = L["c2"]["end"] - 0.9
    E(m["launch565"], "whoosh", gain=.8, dur=.7)
    # ---- F1
    s = Sx["f1"]
    m["shuttlePass"] = L["f1b"]["start"] - 0.5
    E(s["start"], "engine", dur=m["shuttlePass"] - s["start"] + .5)
    E(m["shuttlePass"], "whoosh", gain=.9, dur=.6); E(m["shuttlePass"], "punch"); E(m["shuttlePass"], "shake", amp=.05)
    m["revealF1"] = m["shuttlePass"] + 0.05
    countup(m["revealF1"])
    # ---- shuttle
    s = Sx["shuttle"]
    m["g5"] = L["s1"]["start"] + 0.75; countup(m["g5"]); E(m["g5"], "punch"); E(m["g5"], "thud", gain=.5)
    m["gFeather"] = L["s2"]["start"] + 0.2; E(m["gFeather"], "tick", gain=.8)
    m["gBase"] = L["s2"]["start"] + 1.7; E(m["gBase"], "tick", gain=.8)
    # ---- smash
    s = Sx["smash"]
    m["slowA"], m["contact"], m["slowB"] = s["start"] + 2.7, s["start"] + 3.9, s["start"] + 4.9
    E(s["start"], "thud", gain=.7); E(s["start"], "whoosh", gain=.5, dur=.5)
    E(m["slowA"], "whoosh", gain=.35, dur=1.0)
    E(m["contact"], "crack"); E(m["contact"], "shake", amp=.12); E(m["contact"] + .02, "whoosh", gain=.9, dur=.7)
    countup(m["contact"] + .1, .45)
    # ---- records
    s = Sx["records"]
    E(s["start"] - 0.4, "whoosh", gain=.6, dur=.8)
    m["rec"] = []
    for lid in ("r1", "r2", "r3"):
        n = numat(lid)
        e = max(L[lid]["start"], n - 1.3)
        m["rec"].append({"slide": e, "count": n - 0.5})
        E(e, "punch"); E(e, "whoosh", gain=.35, dur=.35); countup(n - 0.5)
    # ---- honest
    s = Sx["honest"]
    m["black"] = s["start"]
    m["stamp565"] = s["start"] + 0.25; E(m["stamp565"], "thud", gain=.8); E(m["stamp565"], "punch")
    m["tag"] = s["start"] + 0.75; E(m["tag"], "thud", gain=.7); E(m["tag"], "shake", amp=.05)
    m["split"] = L["h2"]["start"] - 0.3; E(m["split"], "whoosh", gain=.5, dur=.5)
    m["reveal426"] = numat("h2") - 0.5; E(m["reveal426"], "thud", gain=.7); E(m["reveal426"], "punch"); countup(m["reveal426"])
    # ---- tennis
    s = Sx["tennis"]
    E(s["start"], "sting"); E(s["start"], "whoosh", gain=.6, dur=.6)
    m["serve"] = L["t1"]["start"] + 1.5
    E(m["serve"], "crack"); E(m["serve"] + .01, "crack", gain=.8); E(m["serve"], "shake", amp=.08)
    E(m["serve"] + .02, "whoosh", gain=.9, dur=.6); E(m["serve"], "punch"); countup(m["serve"] + .05)
    # ---- why
    s = Sx["why"]
    m["launch"] = s["start"] + 0.5; E(m["launch"], "whoosh", gain=.5, dur=.7)
    m["lbl1"] = L["w1"]["start"] + 0.1; m["lbl2"] = L["w2"]["start"] + 0.2
    E(m["lbl1"], "blip", f=520); E(m["lbl2"], "blip", f=700); E(m["lbl1"], "punch"); E(m["lbl2"], "punch")
    # ---- close
    s = Sx["close"]
    m["comment"] = L["z1"]["start"]; E(m["comment"], "punch"); E(m["comment"], "blip", f=880)
    m["hit"] = s["end"] - 0.12; E(m["hit"], "bass"); E(m["hit"], "thud", gain=.9)
    e = Sx["endcard"]
    m["lastDrop"] = e["start"] + 0.2; E(m["lastDrop"], "whoosh", gain=.3, dur=.6)
    E(m["lastDrop"] + 0.62, "tick", gain=1.0)
    tl["events"] = sorted(ev, key=lambda x: x["t"])


def fmt(t):
    ms = int(round(t * 1000))
    h, r = divmod(ms, 3600000); mi, r = divmod(r, 60000); s, ms = divmod(r, 1000)
    return f"{h:02d}:{mi:02d}:{s:02d},{ms:03d}"


def write_srt(tl):
    rows = []
    for info in tl["lines"].values():
        rows += info["chunks"]
    rows.sort(key=lambda r: r["start"])
    with open(os.path.join(OUT, "captions.srt"), "w") as f:
        for i, r in enumerate(rows, 1):
            f.write(f"{i}\n{fmt(r['start'])} --> {fmt(r['end'])}\n{r['text'].upper()}\n\n")


def main():
    k = Kokoro(MODELS + "kokoro.onnx", MODELS + "voices.bin")
    clips = {}
    for _, _, lines in SCENES:
        for lid, text, mult, _p in lines:
            s, sr = k.create(text, voice=VOICE, speed=BASE * mult if mult >= 0.9 else BASE * mult,
                             lang="en-us")
            assert sr == SR
            s = trim(np.asarray(s, dtype=np.float32))
            # gentle fade in/out to avoid clicks
            f = int(0.008 * SR)
            s[:f] *= np.linspace(0, 1, f)
            s[-f:] *= np.linspace(1, 0, f)
            clips[lid] = s

    tl = {"fps": FPS, "scenes": {}, "lines": {}, "marks": {}, "order": []}
    cursor = 0.0
    for name, min_len, lines in SCENES:
        s0 = cursor
        cur = s0 + (0.35 if name == "cold" else 0.2)
        for i, (lid, text, mult, pause) in enumerate(lines):
            dur = len(clips[lid]) / SR
            if name == "cold" and lid == "c2":
                # music drops 0.5s, then the number counts up 0.5s, then narrator speaks
                prev_end = tl["lines"]["c1"]["end"]
                tl["marks"]["musicDrop"] = prev_end + 0.05
                tl["marks"]["reveal565"] = prev_end + 0.55
                cur = prev_end + 1.05
            else:
                cur += pause
            tl["lines"][lid] = {"text": text, "start": cur, "end": cur + dur, "scene": name}
            cur = cur + dur + GAP
        end = max(cur + 0.3, s0 + min_len)
        tl["scenes"][name] = {"start": s0, "end": end}
        tl["order"].append(name)
        cursor = end
    tl["scenes"]["endcard"] = {"start": cursor, "end": cursor + END_CARD}
    tl["order"].append("endcard")
    tl["total"] = cursor + END_CARD

    # narration track (24k mono), full length
    total_n = int(np.ceil(tl["total"] * SR)) + SR
    track = np.zeros(total_n, dtype=np.float32)
    for lid, info in tl["lines"].items():
        a = int(info["start"] * SR)
        c = clips[lid]
        track[a:a + len(c)] += c
    # loudness: normalise speech RMS to about -20 dBFS, peak limit
    voiced = track[np.abs(track) > 0.01]
    rms = np.sqrt(np.mean(voiced ** 2)) if len(voiced) else 1
    track *= 10 ** (-20 / 20) / rms
    track = np.tanh(track * 1.1) / np.tanh(1.1) * 0.95
    sf.write(os.path.join(OUT, "narration_24k.wav"), track[: int((tl["total"] + 0.5) * SR)], SR)

    finalize(tl)
    json.dump(tl, open(os.path.join(OUT, "timeline.json"), "w"), indent=1)
    write_srt(tl)
    words = sum(len(v["text"].split()) for v in tl["lines"].values())
    spoken = sum(v["end"] - v["start"] for v in tl["lines"].values())
    print(f"total {tl['total']:.2f}s | words {words} | spoken {spoken:.1f}s | {words / spoken * 60:.0f} wpm while speaking")
    for n in tl["order"]:
        s = tl["scenes"][n]
        print(f"  {n:8s} {s['start']:6.2f} -> {s['end']:6.2f}  ({s['end'] - s['start']:.2f}s)")


if __name__ == "__main__":
    main()
