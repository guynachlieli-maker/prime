// node render.cjs <workdir> <fps> [from] [to] [stepFrames]
const { chromium } = require('playwright');
const fs = require('fs');
const [W, fpsS, fromS, toS, stepS] = process.argv.slice(2);
const fps = Number(fpsS);
(async () => {
  const tl = JSON.parse(fs.readFileSync(W + '/timeline.json', 'utf8'));
  const b = await chromium.launch({ args: ['--disable-web-security', '--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.error('pageerror', e.message));
  await p.addInitScript((tl) => { window.TIMELINE = tl; }, tl);
  await p.goto('file://' + W + '/comp.html');
  await p.evaluate(() => window.ready);
  await p.waitForTimeout(500);
  const total = Math.ceil(tl.total * fps);
  const from = fromS ? Number(fromS) : 0, to = toS ? Number(toS) : total, step = stepS ? Number(stepS) : 1;
  fs.mkdirSync(W + '/frames', { recursive: true });
  for (let f = from; f < to; f += step) {
    await p.evaluate((t) => window.render(t), f / fps);
    await p.screenshot({ path: `${W}/frames/f${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 93 });
    if (f % 150 === 0) console.log('frame', f, '/', total);
  }
  await b.close();
})();
