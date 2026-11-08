import json, subprocess, sys, os
W = sys.argv[1]
d = json.load(open(f'{W}/vo/words.json'))
GAP_BEFORE = {'hook': 0.45, 'why': 0.4, 'brand': 0.75, 'one': 0.55, 'camera': 0.35, 'menu': 0.35, 'train': 0.35, 'body': 0.4, 'trust': 0.4, 'cta': 0.6}
TAIL = 2.3
t = 0.0
lines = []
os.makedirs(f'{W}/vo/proc', exist_ok=True)
R = 1.0  # natural pitch (the lowered voice sounded heavy)
for x in d:
    s = max(0, x['words'][0]['t'] - 0.03)
    e = x['words'][-1]['t'] + x['words'][-1]['d'] + 0.14
    t += GAP_BEFORE[x['id']]
    out = f"{W}/vo/proc/{x['id']}.wav"
    af = (f"atrim={s}:{e},asetpts=PTS-STARTPTS,aresample=48000,"
          "highpass=f=80,equalizer=f=140:t=q:w=1:g=1.2,equalizer=f=350:t=q:w=1:g=-2,equalizer=f=3800:t=q:w=1.4:g=3,equalizer=f=9000:t=q:w=1:g=1.5,"
          "acompressor=threshold=-22dB:ratio=2.5:attack=6:release=90:makeup=3dB")
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', f"{W}/vo/{x['id']}.mp3", '-af', af, '-ac', '1', out], check=True)
    dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]))
    toks = x['text'].split()
    assert len(toks) == len(x['words']), (x['id'], len(toks), len(x['words']))
    words = [{'w': toks[i], 't': round(t + w['t'] - s, 3), 'e': round(t + w['t'] - s + w['d'], 3)} for i, w in enumerate(x['words'])]
    lines.append({'id': x['id'], 'text': x['text'], 'start': round(t, 3), 'end': round(t + dur, 3), 'file': out, 'words': words})
    t += dur
total = round(t + TAIL, 2)
json.dump({'total': total, 'lines': lines}, open(f'{W}/timeline.json', 'w'), ensure_ascii=False, indent=1)
# voice track
inputs, filt = [], []
for i, l in enumerate(lines):
    inputs += ['-i', l['file']]
    filt.append(f"[{i}]adelay={int(l['start']*1000)}:all=1[a{i}]")
filt.append(''.join(f'[a{i}]' for i in range(len(lines))) + f'amix=inputs={len(lines)}:normalize=0,apad=whole_dur={total}[v]')
subprocess.run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', ';'.join(filt), '-map', '[v]', '-ar', '48000', '-ac', '1', f'{W}/voice.wav'], check=True)
print('total', total)
for l in lines: print(l['id'], l['start'], l['end'])
