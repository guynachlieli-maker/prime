#!/usr/bin/env bash
# usage: marketing/promo/make-video.sh <workdir>   (expects screens/, vo/ etc. in <workdir>)
set -euo pipefail
W="$1"; D="$(cd "$(dirname "$0")" && pwd)"
cp "$D"/{comp.html,render.cjs,score.py,layout.py,tts.py,script.json} "$W"/
python3 "$W/layout.py" "$W"
node "$W/render.cjs" "$W" 30
python3 "$W/score.py" "$W"
ffmpeg -y -v error -i "$W/voice.wav" -i "$W/music.wav" -i "$W/sfx.wav" -filter_complex \
 "[0]aformat=channel_layouts=stereo,asplit=2[v][key];[1]volume=0.32[m];[m][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350:makeup=1[md];[2]volume=0.42[s];[v][md][s]amix=inputs=3:normalize=0,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.2:LRA=9[out]" \
 -map "[out]" -ar 48000 "$W/mix.wav"
ffmpeg -y -v error -framerate 30 -i "$W/frames/f%05d.jpg" -i "$W/mix.wav" -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high -movflags +faststart -c:a aac -b:a 256k -shortest "$W/prime-promo.mp4"
