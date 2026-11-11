import asyncio, json, sys, os, edge_tts
W, ID = sys.argv[1], sys.argv[2]
lines = json.load(open(os.path.join(W, 'script.json')))
words_all = json.load(open(os.path.join(W, 'vo', 'words.json')))
async def main():
    l = next(x for x in lines if x['id'] == ID)
    c = edge_tts.Communicate(l.get('say', l['text']), 'he-IL-AvriNeural', rate='+9%', pitch='+0Hz', volume='+0%', proxy=os.environ.get('HTTPS_PROXY'), boundary='WordBoundary')
    audio = bytearray(); words = []
    async for ch in c.stream():
        if ch['type'] == 'audio': audio += ch['data']
        elif ch['type'] == 'WordBoundary': words.append({'t': ch['offset'] / 1e7, 'd': ch['duration'] / 1e7, 'w': ch['text']})
    open(os.path.join(W, 'vo', ID + '.mp3'), 'wb').write(audio)
    out = [({**l, 'words': words} if x['id'] == ID else x) for x in words_all]
    json.dump(out, open(os.path.join(W, 'vo', 'words.json'), 'w'), ensure_ascii=False, indent=1)
    print([w['w'] for w in words])
asyncio.run(main())
