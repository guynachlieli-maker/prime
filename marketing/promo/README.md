# PRIME promo video (Hebrew, 9:16, ~51 s)

Everything here is reproducible; no stock footage or licensed music.

1. `node marketing/capture.cjs <work>/screens` captures the app screens (dark theme, 3x) from `vite preview` on :4173.
2. `script.json` holds the narration (10 lines). `tts.py <work>` voices it with Microsoft's neural voice he-IL-AvriNeural (needs network access to speech.platform.bing.com) and records word timings.
3. `layout.py <work>` trims each line, deepens the voice slightly (pitch 0.95, warmth EQ, compression), places the lines on the timeline and writes `timeline.json` + `voice.wav`.
4. `comp.html` is the motion design: a deterministic `render(t)` (3D phones, kinetic type, transitions, particles, grain, word-synced captions). `render.cjs <work> 30` renders every frame with Playwright.
5. `score.py <work>` synthesizes the original score and sound design (`music.wav`, `sfx.wav`).
6. Mix (voice, ducked music, SFX, loudness -14 LUFS) and encode with ffmpeg; see the commands in the session log or `make-video.sh`.

Voice licensing note: the free Edge read-aloud endpoint is meant for personal use. For paid ads, re-voice the same script with Azure Speech (same voice, commercial licence) or a human narrator; the timeline adapts automatically.
