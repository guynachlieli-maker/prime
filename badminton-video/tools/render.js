#!/usr/bin/env node
// Deterministic frame renderer: node tools/render.js preview <t1,t2,...> | all [workers] [from] [to]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const OUT = process.env.FRAMES_DIR || path.join(root, 'build', 'frames');
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.woff2': 'font/woff2', '.css': 'text/css' };
function serve(port) {
  return new Promise((res) => {
    const srv = http.createServer((q, r) => {
      const p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
      fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
    }).listen(port, () => res(srv));
  });
}
async function open(port) {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] });
  const pg = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
  pg.on('console', (m) => { const x = m.text(); if (!/GPU stall|GL Driver/.test(x)) console.log('console:', x); });
  await pg.goto(`http://localhost:${port}/build/scene.html`);
  await pg.waitForFunction('window.ready===true', null, { timeout: 120000 });
  return { b, pg };
}
(async () => {
  const mode = process.argv[2];
  const TL = JSON.parse(fs.readFileSync(path.join(root, 'build', 'timeline.json')));
  const total = Math.ceil(TL.total * TL.fps);
  fs.mkdirSync(OUT, { recursive: true });
  if (mode === 'preview') {
    const srv = await serve(8200); const { b, pg } = await open(8200);
    const dir = path.join(root, 'build', 'preview'); fs.mkdirSync(dir, { recursive: true });
    for (const ts of process.argv[3].split(',')) {
      const f = Math.round(parseFloat(ts) * TL.fps);
      const name = await pg.evaluate((f) => window.renderFrame(f), f);
      await pg.screenshot({ path: path.join(dir, `p_${ts}.png`) });
      console.log('t=', ts, 'scene', name);
    }
    await b.close(); srv.close(); return;
  }
  if (mode === 'slowmo') { // 60 fps layer for the smash slow-motion window
    const srv = await serve(8400); const { b, pg } = await open(8400);
    const dir = path.join(root, 'build', 'frames60'); fs.mkdirSync(dir, { recursive: true });
    const a = TL.marks.slowA, e = TL.marks.slowB; let i = 0;
    for (let t = a; t < e; t += 1 / 60, i++) {
      await pg.evaluate((f) => window.renderFrame(f), t * TL.fps);
      await pg.screenshot({ path: path.join(dir, `s_${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 93 });
    }
    console.log('slowmo frames', i); await b.close(); srv.close(); return;
  }
  if (mode === 'all') {
    const workers = parseInt(process.argv[3] || '4'); const from = parseInt(process.argv[4] || '0'); const to = Math.min(total, parseInt(process.argv[5] || total));
    const srv = await serve(8300);
    const t0 = Date.now(); let done = 0;
    await Promise.all(Array.from({ length: workers }, async (_, w) => {
      const { b, pg } = await open(8300);
      for (let f = from + w; f < to; f += workers) {
        const file = path.join(OUT, `f_${String(f).padStart(5, '0')}.jpg`);
        if (fs.existsSync(file)) { done++; continue; }
        await pg.evaluate((f) => window.renderFrame(f), f);
        await pg.screenshot({ path: file, type: 'jpeg', quality: 93 });
        if (++done % 100 === 0) console.log(`${done}/${to - from} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
      await b.close();
    }));
    srv.close(); console.log('done', done, 'frames in', ((Date.now() - t0) / 1000).toFixed(0), 's'); return;
  }
})();
