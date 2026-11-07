import asyncio, json, sys, os
import edge_tts
W = sys.argv[1]
lines = json.load(open(os.path.join(W, 'script.json')))
async def one(l):
    c = edge_tts.Communicate(l['text'], 'he-IL-AvriNeural', rate='+3%', pitch='-14Hz', volume='+0%', proxy=os.environ.get('HTTPS_PROXY'), boundary='WordBoundary')
    audio = bytearray(); words = []
    async for ch in c.stream():
        if ch['type'] == 'audio': audio += ch['data']
        elif ch['type'] == 'WordBoundary': words.append({'t': ch['offset'] / 1e7, 'd': ch['duration'] / 1e7, 'w': ch['text']})
    open(os.path.join(W, 'vo', l['id'] + '.mp3'), 'wb').write(audio)
    return {**l, 'words': words}
async def main():
    out = [await one(l) for l in lines]
    json.dump(out, open(os.path.join(W, 'vo', 'words.json'), 'w'), ensure_ascii=False, indent=1)
asyncio.run(main())
