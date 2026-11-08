// Captures app screens for the promo video (dark theme, 3x). Usage: node marketing/capture.cjs <outDir>
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.argv[2];
const PLATE = path.join(__dirname, 'pasta.jpg'); // Unsplash photo KvOvh3ooWjI (Unsplash licence: free commercial use)
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, colorScheme: 'dark', locale: 'he-IL' });
  await ctx.clock.setFixedTime(new Date('2026-11-08T10:40:00'));
  const page = await ctx.newPage();
  const shot = async (n, opts = {}) => {
    await page.waitForTimeout(opts.wait ?? 900);
    await page.screenshot({ path: `${OUT}/${n}.png` });
  };
  await page.route('https://api.anthropic.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: 'x', stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
      content: [{ type: 'text', text: JSON.stringify({ items: [{ name: 'פסטה מבושלת', foodId: 'pasta', alternatives: [], grams: 260, confidence: 'high' }, { name: 'רוטב עגבניות', foodId: 'tomato', alternatives: [], grams: 90, confidence: 'medium' }, { name: 'גבינה מגורדת', foodId: 'yellow_cheese', alternatives: [], grams: 15, confidence: 'medium' }], clarifyingQuestion: null, clarifyingFoodId: null, notes: 'פסטה ברוטב עגבניות עם גבינה.' }) }] }) }),
  );
  const click = (t) => page.getByRole('button', { name: t, exact: true }).first().click();

  // ---------- onboarding: goal + target ----------
  await page.goto('http://localhost:4173');
  await page.fill('input', 'גיא');
  await click('בוא נתחיל');
  await shot('01-goal');
  await page.getByText('ירידה בשומן').first().click();
  await click('המשך');
  await page.getByRole('radio', { name: 'זכר' }).click();
  const inputs = page.locator('input[inputmode="decimal"]');
  await inputs.nth(0).fill('32');
  await inputs.nth(1).fill('180');
  await inputs.nth(2).fill('86');
  await click('המשך');
  await click('המשך');
  await page.getByRole('radio', { name: '4', exact: true }).click();
  await page.getByRole('radio', { name: '60 דק׳' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('02-training-questions');
  await click('המשך');
  await page.getByRole('button', { name: 'אבקת חלבון (מי גבינה)' }).click();
  await page.getByRole('button', { name: 'קריאטין' }).click();
  await click('המשך');
  await page.locator('input[inputmode="decimal"]').first().fill('76');
  await shot('03-target');
  await click('המשך');
  await page.waitForTimeout(1200);
  await shot('04-journey-goal');
  await page.locator('.journey-times .chip').nth(0).click();
  await shot('05-journey-1');
  await page.locator('.journey-times .chip').nth(1).click();
  await shot('06-journey-2');
  await click('המשך');
  await shot('07-plan');
  await page.mouse.wheel(0, 900);
  await shot('08-plan-training');
  await click('יאללה, מתחילים');
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'דילוג' }).click().catch(() => {});

  // ---------- today ----------
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('10-today');
  await page.locator('[data-tour="day"]').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 120));
  await shot('11-today-timeline');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: /למה\? יעד חלבון/ }).first().click();
  await shot('12-why');
  await page.keyboard.press('Escape');

  // ---------- camera ----------
  await page.locator('.tab-camera').click();
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('prime.v1'));
    s.settings.apiKey = 'sk-ant-demo';
    localStorage.setItem('prime.v1', JSON.stringify(s));
  });
  await page.reload();
  await page.locator('.tab-camera').click();
  await page.waitForTimeout(400);
  await shot('20-camera');
  await page.locator('input[type=file]').first().setInputFiles(PLATE);
  await page.waitForSelector('.basket-list li', { timeout: 15000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('21-camera-result');
  await page.locator('.basket').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -140));
  await shot('21b-basket');
  await page.getByRole('radio', { name: 'ברקוד' }).click().catch(() => {});
  await page.waitForTimeout(300);
  const code = page.locator('input[aria-label="מספר ברקוד"]');
  if (await code.count()) {
    await code.fill('7290000066318');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    await shot('22-barcode');
  }

  // ---------- menu ----------
  await page.locator('.tab-menu').click();
  await shot('30-menu');
  await page.locator('.role-tag.pre').first().scrollIntoViewIfNeeded().catch(() => {});
  await page.evaluate(() => window.scrollBy(0, 160));
  await shot('31-menu-workout-meals');

  // ---------- training ----------
  await page.locator('.tab-training').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('40-training');
  await page.evaluate(() => window.scrollBy(0, 560));
  await shot('41-training-week');
  await page.evaluate(() => window.scrollTo(0, 0));
  await click('להתחיל אימון');
  await page.waitForTimeout(500);
  await page.locator('.sets input[inputmode="decimal"]').first().fill('60');
  await page.locator('.set-check').first().click();
  await page.waitForTimeout(3200);
  await shot('42-session', { wait: 200 });
  await page.locator('.ex-actions .icon-btn').first().click();
  await page.waitForTimeout(2500);
  await shot('43-exercise');
  await page.keyboard.press('Escape');
  await click('יציאה');
  await page.getByRole('radio', { name: 'תרגילים' }).click();
  await page.waitForTimeout(2500);
  await shot('44-library', { wait: 1500 });

  // ---------- progress ----------
  await page.locator('.tab-progress').click();
  await page.waitForTimeout(1200);
  await shot('50-progress');
  await browser.close();
})().catch((e) => {
  console.error('FAILED', e.message);
  process.exit(1);
});
