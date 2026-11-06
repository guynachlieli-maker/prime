// New-feature e2e: full MoH search, barcode lookup, device import, profile photo, learning, a11y states.
const { chromium } = require('playwright');
const path = require('path');
const SHOTS = process.argv[2];
const WHOOP = process.argv[3];
const PHOTO = path.join(__dirname, 'plate.jpg');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 400, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
  await page.goto('http://localhost:4173');
  await page.evaluate(() => {
    const profile = { name: 'גיא', sex: 'male', age: 34, heightCm: 178, weightKg: 88, bodyFatPct: 24, bodyFatSource: 'estimate', activity: 'moderate', trainingDaysPerWeek: 4, strengthTraining: true, sleepHours: 7, goal: 'fat_loss', pace: 'balanced', diet: 'omnivore', kosher: true, allergies: [], dislikes: [], mealsPerDay: 4, maxPrepMinutes: 40,
      screening: { parqHeart:false,parqChestPain:false,parqDizziness:false,parqBloodPressureMeds:false,parqJointProblem:false,pregnantOrBreastfeeding:false,diabetesInsulin:false,kidneyDisease:false,thyroid:false,ibd:false,glp1:false,scoffSick:false,scoffControl:false,scoffLost6kg:false,scoffBelieveFat:false,scoffFoodDominates:false } };
    localStorage.setItem('prime.v1', JSON.stringify({ version: 1, profile, onboardingDone: true, tourDone: true, seenHints: [], logs: [], weighIns: [], water: {}, measurements: [], favorites: [], planFixed: {}, safetyEvents: [], settings: { hideAvatar: false, trainingConsent: false, theme: 'light', detailed: false, reminders: true } }));
  });
  await page.reload();
  await page.getByRole('button', { name: 'פרופיל והגדרות' }).click();
  await page.getByRole('button', { name: /ירידה בשומן/ }).first().click(); // computes targets

  // profile photo
  await page.locator('input[type=file][accept="image/*"]').first().setInputFiles(PHOTO);
  await page.waitForTimeout(400);
  console.log('PROFILE PHOTO', await page.locator('.me-photo img').count(), await page.locator('.avatar-btn img').count());
  await shot('f1-profile');

  // menu: personalised amounts, swap -> learning
  await page.locator('.tab-menu').click();
  await page.waitForTimeout(300);
  const total = await page.locator('.day-total').textContent();
  console.log('MENU TOTAL', total.replace(/\s+/g, ' '));
  await page.locator('.meal-head').first().click();
  console.log('INGREDIENTS', (await page.locator('.recipe li').allTextContents()).join(' | '));
  await shot('f2-menu');
  const firstMeal = await page.locator('.meal-head strong').first().textContent();
  await page.getByRole('button', { name: 'החלפת מנה' }).first().click();
  await page.locator('.sheet .result').first().getByRole('button', { name: 'לבחור' }).click();
  await page.waitForTimeout(300);
  console.log('SWAPPED', firstMeal, '->', await page.locator('.meal-head strong').first().textContent());

  // capture: full MoH search
  await page.locator('.tab-camera').click();
  await page.getByRole('radio', { name: /חיפוש/ }).click();
  await page.waitForTimeout(800);
  await page.fill('input.search', 'במבה');
  await page.waitForTimeout(300);
  console.log('SEARCH במבה', (await page.locator('.result strong').allTextContents()).slice(0, 4).join(' | '));
  await page.fill('input.search', 'קוטג');
  await page.waitForTimeout(200);
  console.log('SEARCH קוטג', (await page.locator('.result strong').allTextContents()).slice(0, 4).join(' | '));
  await page.locator('.result').first().getByRole('button', { name: /הוספה/ }).click();
  await shot('f3-search');

  // barcode manual entry
  await page.getByRole('radio', { name: /ברקוד/ }).click();
  await page.fill('input[aria-label="מספר ברקוד"]', '7290000066318');
  await page.getByRole('button', { name: 'חיפוש', exact: true }).click();
  await page.waitForTimeout(800);
  console.log('BARCODE', (await page.locator('.banner').allTextContents()).join(' || '));
  await page.fill('input[aria-label="מספר ברקוד"]', '7290000000001');
  await page.getByRole('button', { name: 'חיפוש', exact: true }).click();
  await page.waitForTimeout(500);
  console.log('BARCODE MISSING', await page.getByRole('button', { name: 'צילום התווית' }).count());
  await shot('f4-barcode');

  // photo without a recognition provider -> clear fallback
  await page.getByRole('radio', { name: /צילום/ }).click();
  await page.locator('input[type=file][capture]').first().setInputFiles(PHOTO);
  await page.waitForTimeout(1500);
  console.log('PHOTO FALLBACK', (await page.locator('.banner.warn').allTextContents()).join(' || ').slice(0, 120));
  await page.getByRole('button', { name: 'אישור ורישום' }).click();

  // devices: Whoop CSV import
  await page.getByRole('button', { name: 'פרופיל והגדרות' }).click();
  await page.getByRole('button', { name: 'ניהול' }).click();
  await page.getByRole('button', { name: /Whoop/ }).click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'ייבוא קובץ' }).click()]);
  await chooser.setFiles(WHOOP);
  await page.waitForTimeout(800);
  console.log('DEVICES', (await page.locator('.banner').allTextContents()).join(' || '));
  console.log('DEVICE ROWS', (await page.locator('.mtable tbody tr').allTextContents()).join(' | '));
  await shot('f5-devices');

  // today: device strip, learned card
  await page.locator('.tab-today').click();
  await page.waitForTimeout(300);
  console.log('STRIP', (await page.locator('.device-strip').textContent())?.replace(/\s+/g, ' '));
  await shot('f6-today');
  await page.getByRole('button', { name: 'פרופיל והגדרות' }).click();
  console.log('LEARNED', (await page.locator('.learned').count()) ? (await page.locator('.learned').textContent()) : (await page.getByText('עדיין לומדת').count() ? 'still learning (expected after 1 swap)' : 'none'));

  // a11y: selected state has a non-colour cue
  await page.locator('.tab-camera').click();
  const content = await page.locator('.segmented button.on').first().evaluate((el) => getComputedStyle(el, '::before').content + ' border ' + getComputedStyle(el).borderTopWidth);
  console.log('SELECTED CUE', content);
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
