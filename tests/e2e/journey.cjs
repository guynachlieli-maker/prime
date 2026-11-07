// Progress page: 80 kg -> 70 kg. Every button must show a different, monotonic body; goal on the system date.
const { chromium } = require('playwright');
const SHOTS = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const cases = [
    { name: 'no-date', target: 70 },
    { name: '2-months', target: 70, date: new Date(Date.now() + 61 * 864e5).toISOString().slice(0, 10) },
    { name: '6-months', target: 70, date: new Date(Date.now() + 183 * 864e5).toISOString().slice(0, 10) },
    { name: 'close', target: 77 },
  ];
  for (const c of cases) {
    const p = await b.newPage({ viewport: { width: 400, height: 900 } });
    p.on('pageerror', (e) => errors.push(c.name + ' pageerror: ' + e.message));
    await p.goto('http://localhost:4173');
    await p.evaluate((c) => {
      localStorage.setItem('prime.v1', JSON.stringify({ version: 1, onboardingDone: true, tourDone: true, startedAt: new Date().toISOString(), profile: { name: 'בדיקה', sex: 'male', age: 30, heightCm: 178, weightKg: 80, bodyFatPct: 24, bodyFatSource: 'estimate', activity: 'moderate', trainingDaysPerWeek: 3, strengthTraining: true, sleepHours: 7, goal: 'fat_loss', pace: 'balanced', diet: 'omnivore', kosher: false, allergies: [], dislikes: [], mealsPerDay: 4, maxPrepMinutes: 30, screening: {}, targetWeightKg: c.target, targetDate: c.date }, settings: { theme: 'light', hideAvatar: false, trainingConsent: false, detailed: false, reminders: false } }));
    }, c);
    await p.reload();
    await p.waitForTimeout(600);
    await p.locator('.tab-progress').click();
    await p.waitForTimeout(700);
    const chips = p.locator('.journey-times .chip');
    const n = await chips.count();
    const rows = [];
    for (let i = 0; i < n; i++) {
      await chips.nth(i).click();
      await p.waitForTimeout(800);
      const label = (await chips.nth(i).innerText()).replace(/\s+/g, ' ').trim();
      const cap = (await p.locator('.holo-stage figure').nth(1).innerText()).replace(/\s+/g, ' ');
      const kg = Number((cap.match(/([\d.]+) ק"ג/) || [])[1]);
      const date = (await p.locator('.holo-stage figure').nth(1).locator('small').innerText()).trim();
      rows.push({ label, kg, date });
      await p.locator('.journey').screenshot({ path: `${SHOTS}/j-${c.name}-${i}.png` });
    }
    const selected = (await p.locator('.journey-times .chip.on').innerText().catch(() => '')).trim();
    const goalText = (await p.locator('.insight').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
    console.log(c.name, JSON.stringify(rows), '| goal screen:', goalText.slice(0, 160));
    if (n !== 3) errors.push(`${c.name}: ${n} buttons`);
    if (!rows[2] || !/ביעד/.test(rows[2].label)) errors.push(`${c.name}: last button is not the goal`);
    if (rows[0] && rows[1] && rows[2]) {
      if (!(80 > rows[0].kg && rows[0].kg > rows[1].kg && rows[1].kg > rows[2].kg)) errors.push(`${c.name}: weights not decreasing ${rows.map((r) => r.kg)}`);
      if (Math.abs(rows[2].kg - c.target) > 0.6) errors.push(`${c.name}: goal button shows ${rows[2].kg}, target ${c.target}`);
    }
    await p.close();
  }
  console.log('ERRORS', JSON.stringify(errors, null, 1));
  await b.close();
})();
