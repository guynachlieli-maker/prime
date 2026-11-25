#!/usr/bin/env bash
# frames + audio -> final MP4 (1080x1920, 30fps), plus SRT, stems and thumbnail
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=deliverables; mkdir -p $OUT
ffmpeg -y -loglevel error -framerate 30 -i build/frames/f_%05d.jpg -i build/mix.wav \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -r 30 -c:a aac -b:a 256k -af "loudnorm=I=-14:TP=-1.5:LRA=9" \
  -movflags +faststart -shortest $OUT/fastest-sport-on-earth_9x16.mp4
cp build/captions.srt $OUT/captions.srt
cp build/stem_narration.wav $OUT/narration.wav
cp build/stem_music.wav $OUT/music_stem.wav
cp build/stem_sfx.wav $OUT/sfx_stem.wav
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,duration -of compact $OUT/fastest-sport-on-earth_9x16.mp4
