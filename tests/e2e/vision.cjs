const { chromium } = require('playwright');
const SHOTS = process.argv[2];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  let reqBody = null;
  await page.route('https://api.anthropic.com/**', async (route) => {
    reqBody = JSON.parse(route.request().postData());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
      content: [{ type: 'text', text: JSON.stringify({ items: [{ foodId: 'rice_white', grams: 180, confidence: 'high' }, { foodId: 'chicken_breast', grams: 140, confidence: 'medium' }, { foodId: 'unknown_x', grams: 50, confidence: 'low' }], clarifyingQuestion: 'נוסף שמן לעוף?', notes: 'אורז לבן וחזה עוף.' }) }],
    }) });
  });
  // seed a finished profile directly
  await page.goto('http://localhost:4173');
  await page.evaluate(() => {
    const profile = { name: 'בדיקה', sex: 'female', age: 29, heightCm: 165, weightKg: 62, bodyFatPct: 27, bodyFatSource: 'estimate', activity: 'moderate', trainingDaysPerWeek: 4, strengthTraining: true, sleepHours: 7, goal: 'recomp', pace: 'balanced', diet: 'vegetarian', kosher: true, allergies: ['sesame'], dislikes: [], mealsPerDay: 5, maxPrepMinutes: 30,
      screening: { parqHeart:false,parqChestPain:false,parqDizziness:false,parqBloodPressureMeds:false,parqJointProblem:false,pregnantOrBreastfeeding:false,diabetesInsulin:false,kidneyDisease:false,thyroid:false,ibd:false,glp1:false,scoffSick:false,scoffControl:false,scoffLost6kg:false,scoffBelieveFat:false,scoffFoodDominates:false } };
    localStorage.setItem('prime.v1', JSON.stringify({ version: 1, profile, onboardingDone: true, tourDone: true, seenHints: [], logs: [], weighIns: [], water: {}, measurements: [], favorites: [], planFixed: {}, safetyEvents: [], settings: { hideAvatar: false, trainingConsent: false, theme: 'dark', detailed: true, reminders: true, apiKey: 'sk-ant-test' } }));
  });
  await page.reload();
  await page.waitForTimeout(400);
  // targets are computed on saveProfile; trigger by editing goal in profile
  await page.getByRole('button', { name: 'פרופיל והגדרות' }).click();
  await page.getByRole('button', { name: /ריקומפוזיציה/ }).first().click();
  await page.locator('.tab-today').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/v1-today-dark.png` });
  await page.getByRole('button', { name: /למה\? יעד חלבון/ }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/v2-why.png` });
  await page.keyboard.press('Escape');
  await page.locator('.tab-camera').click();
  await page.locator('input[type=file]').first().setInputFiles('plate.jpg');
  await page.waitForSelector('.basket-list li', { timeout: 10000 });
  await page.screenshot({ path: `${SHOTS}/v3-recognized.png` });
  const names = await page.locator('.basket-list strong').allTextContents();
  const total = await page.locator('.basket-total strong').textContent();
  console.log('ITEMS', names.join(' | '), 'TOTAL', total);
  console.log('REQ model', reqBody.model, 'format', reqBody.output_config && reqBody.output_config.format && reqBody.output_config.format.type, 'img', reqBody.messages[0].content[0].type);
  await page.getByRole('button', { name: 'כן, נוסף שמן (כף)' }).click();
  await page.getByRole('button', { name: 'אישור ורישום' }).click();
  await page.locator('.tab-menu').click();
  await page.waitForTimeout(300);
  const meals = await page.locator('.meal-head strong').allTextContents();
  console.log('MENU (vegetarian, kosher, no sesame, 5 meals)', meals.join(' | '));
  await page.screenshot({ path: `${SHOTS}/v4-menu.png` });
  await page.locator('.tab-progress').click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/v5-progress.png` });
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
