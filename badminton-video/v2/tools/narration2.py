#!/usr/bin/env python3
"""v2 (50 s cut): narration + master timeline (marks, cuts, events, captions) -> v2/build/"""
import json, os, sys
import numpy as np, soundfile as sf
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "tools"))
from narration import trim, chunks, fmt, SR, MODELS, VOICE, BASE
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "build"); os.makedirs(OUT, exist_ok=True)
FPS = 30

# (scene, min length, [(id, spoken text, speed mult, pause before)])
SCENES = [
    ("hook", 4.2, [("k1", "Five sixty-five kilometers per hour.", 1.0, 0.0),
                   ("k2", "The fastest hit ever recorded.", 1.0, 0.12)]),
    ("caveat", 5.0, [("v1", "But that was a lab test.", 1.0, 0.25),
                     ("v2", "In a real match, the record is four twenty-six.", 1.0, 0.2)]),
    ("rank", 7.5, [("r1", "That still beats a Formula 1 car, at three seventy-two point six.", 1.0, 0.25),
                   ("r2", "And tennis's fastest recorded serve, at two sixty-three point four.", 1.0, 0.25)]),
    ("history", 11.0, [("y1", "Its ancestors go back two thousand years.", 1.0, 0.25),
                       ("y2", "British officers in India added a net in the eighteen sixties.", 1.0, 0.2),
                       ("y3", "A party at Badminton House named it, in eighteen seventy-three.", 1.0, 0.2),
                       ("y4", "The Olympics came in nineteen ninety-two.", 1.0, 0.2)]),
    ("shuttle", 5.0, [("s1", "Every shuttle is sixteen feathers in a cork base,", 1.0, 0.2),
                      ("s2", "weighing about five grams.", 1.0, 0.05)]),
    ("why", 4.6, [("w1", "A shuttle slows down fast, so these speeds aren't directly comparable.", 1.0, 0.3)]),
    ("close", 3.2, [("z1", "So which sport is faster?", 0.86, 0.35),
                    ("z2", "Comment below.", 0.86, 0.15)]),
]
END_CARD = 2.5
GAP = 0.1
CAPS = {
    "k1": "565 km/h.", "k2": "The fastest hit ever recorded.",
    "v1": "But that was a lab test.", "v2": "In a real match, the record is 426.",
    "r1": "That still beats a Formula 1 car, at 372.6.", "r2": "And tennis's fastest recorded serve, at 263.4.",
    "y1": "Its ancestors go back 2,000 years.", "y2": "British officers in India added a net in the 1860s.",
    "y3": "A party at Badminton House named it, in 1873.", "y4": "The Olympics came in 1992.",
    "s1": "Every shuttle is 16 feathers in a cork base,", "s2": "weighing about 5 grams.",
    "w1": "A shuttle slows down fast, so these speeds aren't directly comparable.",
    "z1": "So which sport is faster?", "z2": "Comment below.",
}
NUM_WORD = {"k1": "five sixty", "v2": "four twenty", "r1": "three seventy", "r2": "two sixty", "y1": "two thousand",
            "y2": "eighteen sixt", "y3": "eighteen seventy", "y4": "nineteen", "s1": "sixteen", "s2": "five grams"}
CUTS = [("hook", "caveat", "whip", [1, 0]), ("caveat", "rank", "zoom", [0, 0]), ("rank", "history", "whip", [0, 1]),
        ("history", "shuttle", "glitch", [1, 0]), ("shuttle", "why", "whip", [-1, 0]), ("why", "close", "flash", [0, 0]),
        ("close", "endcard", "fade", [0, 0])]


def main():
    k = Kokoro(MODELS + "kokoro.onnx", MODELS + "voices.bin")
    clips = {}
    for _, _, lines in SCENES:
        for lid, text, mult, _p in lines:
            s, sr = k.create(text, voice=VOICE, speed=BASE * mult, lang="en-us")
            s = trim(np.asarray(s, dtype=np.float32)); f = int(.008 * SR)
            s[:f] *= np.linspace(0, 1, f); s[-f:] *= np.linspace(1, 0, f); clips[lid] = s
    tl = {"fps": FPS, "scenes": {}, "lines": {}, "marks": {}, "order": [], "cuts": []}
    cursor = 0.0
    for name, min_len, lines in SCENES:
        s0 = cursor; cur = s0 + (1.3 if name == "hook" else .2)
        for lid, text, mult, pause in lines:
            dur = len(clips[lid]) / SR; cur += pause
            tl["lines"][lid] = {"text": text, "start": cur, "end": cur + dur, "scene": name}
            cur += dur + GAP
        end = max(cur + .25, s0 + min_len)
        tl["scenes"][name] = {"start": s0, "end": end}; tl["order"].append(name); cursor = end
    tl["scenes"]["endcard"] = {"start": cursor, "end": cursor + END_CARD}; tl["order"].append("endcard")
    tl["total"] = cursor + END_CARD
    n = int(np.ceil(tl["total"] * SR)) + SR; track = np.zeros(n, dtype=np.float32)
    for lid, i in tl["lines"].items():
        a = int(i["start"] * SR); track[a:a + len(clips[lid])] += clips[lid]
    v = track[np.abs(track) > .01]; track *= 10 ** (-20 / 20) / np.sqrt(np.mean(v ** 2))
    track = np.tanh(track * 1.1) / np.tanh(1.1) * .95
    sf.write(os.path.join(OUT, "narration_24k.wav"), track[: int((tl["total"] + .5) * SR)], SR)
    finalize(tl)
    json.dump(tl, open(os.path.join(OUT, "timeline.json"), "w"), indent=1)
    write_srt(tl)
    words = sum(len(v["text"].split()) for v in tl["lines"].values())
    print(f"total {tl['total']:.2f}s | {words} words")
    for nme in tl["order"]:
        s = tl["scenes"][nme]; print(f"  {nme:8s} {s['start']:6.2f} -> {s['end']:6.2f} ({s['end'] - s['start']:.2f}s)")


def finalize(tl):
    L, S, m = tl["lines"], tl["scenes"], tl["marks"]; ev = []
    E = lambda t, typ, **kw: ev.append(dict(t=round(t, 3), type=typ, **kw))
    def countup(t0, g=.5):
        for i in range(7): E(t0 + i * .07, "tick", gain=g)
    def numat(lid):
        src = L[lid]["text"].lower(); i = src.find(NUM_WORD[lid]); fr = max(i, 0) / len(src)
        return L[lid]["start"] + (L[lid]["end"] - L[lid]["start"]) * fr
    for lid, info in L.items():
        info["cap"] = CAPS[lid]; info["numAt"] = numat(lid) if lid in NUM_WORD else info["start"]
        dur = info["end"] - info["start"]; words = CAPS[lid].split(); tot = sum(len(w) for w in words) + len(words)
        a = info["start"]; info["words"] = []
        for w in words:
            d = dur * (len(w) + 1) / tot; info["words"].append({"w": w, "start": round(a, 3), "end": round(a + d, 3)}); a += d
        ch = chunks(CAPS[lid], 4); tt = sum(len(c) for c in ch); a = info["start"]; info["chunks"] = []
        for c in ch:
            d = dur * len(c) / tt; info["chunks"].append({"text": c, "start": round(a, 3), "end": round(a + d, 3)}); a += d
    # cuts (scene transitions)
    for a, b, kind, d in CUTS:
        t = S[b]["start"]; tl["cuts"].append({"t": t, "kind": kind, "dir": d})
        E(t - .14, "whoosh", gain=.85, dur=.45)
        if kind != "fade": E(t, "thud", gain=.55)
        if kind == "glitch": E(t - .05, "sting", gain=.5)
    # hook
    m["contact"] = .8; m["reveal565"] = .9
    E(m["contact"], "crack"); E(m["contact"], "shake", amp=.14); E(m["reveal565"], "bass"); E(m["reveal565"], "punch"); countup(m["reveal565"] + .03)
    E(.3, "whoosh", gain=.5, dur=.6)
    # caveat
    m["stamp"] = L["v1"]["start"] - .05; E(m["stamp"], "thud", gain=.9); E(m["stamp"], "shake", amp=.06); E(m["stamp"], "punch")
    m["reveal426"] = L["v2"]["numAt"] - .5; E(m["reveal426"], "thud", gain=.8); E(m["reveal426"], "punch"); countup(m["reveal426"] + .03)
    # rank
    s = S["rank"]; m["bar426"] = s["start"] + .25; m["bar372"] = L["r1"]["numAt"] - .55; m["bar263"] = L["r2"]["numAt"] - .55
    for k_ in ("bar426", "bar372", "bar263"): E(m[k_], "thud", gain=.55); E(m[k_], "whoosh", gain=.3, dur=.4); countup(m[k_] + .05, .35)
    E(m["bar372"], "punch"); E(m["bar263"], "punch")
    # history beats
    m["hy"] = [L[x]["start"] for x in ("y1", "y2", "y3", "y4")]
    for i, t in enumerate(m["hy"]): E(t - .05, "blip", f=[440, 560, 660, 880][i], gain=.7); E(t - .05, "punch")
    E(m["hy"][0], "whoosh", gain=.4, dur=.7); E(m["hy"][2], "whoosh", gain=.4, dur=.6)
    # shuttle
    s = S["shuttle"]; m["feathers"] = L["s1"]["numAt"] - .6
    for i in range(16): E(m["feathers"] + i * .045, "tick", gain=.45 + .02 * i)
    m["g5"] = L["s2"]["numAt"] - .5; E(m["g5"], "thud", gain=.7); E(m["g5"], "punch"); countup(m["g5"] + .03)
    # why
    s = S["why"]; m["launch"] = s["start"] + .35; E(m["launch"], "whoosh", gain=.6, dur=.7)
    m["lbl1"] = s["start"] + 1.0; m["lbl2"] = s["start"] + 2.0; E(m["lbl1"], "blip", f=520); E(m["lbl2"], "blip", f=700)
    # close
    s = S["close"]; m["comment"] = L["z1"]["start"]; E(m["comment"], "punch"); E(m["comment"], "blip", f=880)
    m["hit"] = s["end"] - .1; E(m["hit"], "bass"); E(m["hit"], "thud", gain=.9)
    m["lastDrop"] = S["endcard"]["start"] + .15
    tl["events"] = sorted(ev, key=lambda x: x["t"])


def write_srt(tl):
    rows = []
    for i in tl["lines"].values(): rows += i["chunks"]
    rows.sort(key=lambda r: r["start"])
    with open(os.path.join(OUT, "captions.srt"), "w") as f:
        for i, r in enumerate(rows, 1): f.write(f"{i}\n{fmt(r['start'])} --> {fmt(r['end'])}\n{r['text'].upper()}\n\n")


if __name__ == "__main__":
    main()
