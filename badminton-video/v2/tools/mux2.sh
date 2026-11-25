#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=v2/deliverables; mkdir -p $OUT
ffmpeg -y -loglevel error -framerate 30 -i v2/build/frames/f_%05d.jpg -i v2/build/mix.wav \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -c:a aac -b:a 256k -af "loudnorm=I=-14:TP=-1.5:LRA=9" \
  -movflags +faststart -shortest $OUT/fastest-sport-50s_9x16.mp4
cp v2/build/captions.srt $OUT/captions.srt
cp v2/build/stem_narration.wav $OUT/narration.wav; cp v2/build/stem_music.wav $OUT/music_stem.wav; cp v2/build/stem_sfx.wav $OUT/sfx_stem.wav
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,duration -of compact $OUT/fastest-sport-50s_9x16.mp4
