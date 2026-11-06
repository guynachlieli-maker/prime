import Anthropic from '@anthropic-ai/sdk';
import { FOODS, FOOD_BY_ID, loadFullDb, searchAll } from '../data/foods';
import { getSample, isSampleError, describeSampleError } from './claude-runtime';

/**
 * Food photo recognition and nutrition-label reading.
 * The model only identifies components and estimates grams; nutrient values always come from
 * the Ministry of Health table (spec: "המודל לא ממציא ערכים תזונתיים").
 *
 * Providers, in order:
 *  1. The Claude app runtime (published claude.ai page): the viewer's own account, after consent.
 *  2. A personal Anthropic API key from Settings (testing only; production goes through our server).
 */
export interface RecognizedItem {
  foodId: string;
  grams: number;
  confidence: 'high' | 'medium' | 'low';
  /** What the model actually saw, in specific Hebrew (e.g. "פתיתים מבושלים"). */
  name?: string;
  /** Other foodIds that look similar, for one-tap correction. */
  alternatives?: string[];
}

export interface Recognition {
  items: RecognizedItem[];
  clarifyingQuestion: string | null;
  clarifyingFoodId: string | null; // the food to add if the user answers "yes" (e.g. olive_oil)
  notes: string;
  provider: 'claude-app' | 'api-key';
}

export interface LabelReading {
  name: string;
  per100g: { kcal: number; protein: number; fat: number; carbs: number; fiber: number };
  servingGrams: number | null;
  allergens: string[];
}

const MODEL = 'claude-opus-5-5';

const FOOD_LIST = FOODS.map((f) => `${f.id}: ${f.name}`).join('\n');

const INSTRUCTIONS = `You identify the foods on a plate photographed by a user of an Israeli nutrition app.
Return only components you can see. For each component:
- "name": the specific dish/food in Hebrew as an Israeli would call it (e.g. "פתיתים מבושלים", "קוסקוס", "דייסת שיבולת שועל", "בורגול", "אורז לבן").
- "foodId": the closest foodId from the list below. If none matches well, still pick the closest and lower the confidence; the app will look up "name" in the full national table.
- "alternatives": up to 3 other foodIds that look similar in a photo.
Look carefully at texture and shape before naming grains and small pasta: ptitim (פתיתים, smooth round/rice-shaped pasta pearls) are NOT oats (flat irregular flakes in a porridge), couscous is tiny grains, bulgur is broken cracked wheat, rice grains are elongated. Same for cheeses, spreads (hummus vs tahini vs labneh), and breads (pita vs laffa vs bread slice).
Food list (id: Hebrew name):
${FOOD_LIST}
Estimate grams of each component from plate size, utensils and typical Israeli portions. Do not estimate calories.
Confidence: "high" when clearly visible and identifiable, "medium" when the type or amount is uncertain, "low" when guessing.
If one hidden factor would change the total the most (oil, sauce, rice type), ask ONE short clarifying question in Hebrew
and give the foodId to add if the answer is yes (e.g. "olive_oil"); otherwise null for both.
"notes" is one short Hebrew sentence on what you saw. If the image is not food, return no items and say so in notes.`;

const JSON_SHAPE = `Reply with only a JSON object: {"items":[{"name":string,"foodId":string,"alternatives":string[],"grams":number,"confidence":"high"|"medium"|"low"}],"clarifyingQuestion":string|null,"clarifyingFoodId":string|null,"notes":string}`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'clarifyingQuestion', 'clarifyingFoodId', 'notes'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'foodId', 'alternatives', 'grams', 'confidence'],
        properties: {
          name: { type: 'string' },
          foodId: { type: 'string', enum: FOODS.map((f) => f.id) },
          alternatives: { type: 'array', items: { type: 'string', enum: FOODS.map((f) => f.id) } },
          grams: { type: 'number' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    clarifyingQuestion: { type: ['string', 'null'] },
    clarifyingFoodId: { type: ['string', 'null'] },
    notes: { type: 'string' },
  },
} as const;

function clean(r: Omit<Recognition, 'provider'>, provider: Recognition['provider']): Recognition {
  const items = (Array.isArray(r.items) ? r.items : [])
    .filter((i) => FOOD_BY_ID[i.foodId] && Number(i.grams) > 0 && Number(i.grams) < 2000)
    .map((i) => ({
      foodId: i.foodId,
      grams: Math.round(Number(i.grams)),
      confidence: (['high', 'medium', 'low'] as const).includes(i.confidence) ? i.confidence : 'medium',
      name: typeof i.name === 'string' ? i.name.trim().slice(0, 60) : undefined,
      alternatives: Array.isArray(i.alternatives) ? i.alternatives.filter((a) => FOOD_BY_ID[a] && a !== i.foodId).slice(0, 3) : [],
    }));
  return {
    items,
    clarifyingQuestion: typeof r.clarifyingQuestion === 'string' ? r.clarifyingQuestion : null,
    clarifyingFoodId: r.clarifyingFoodId && FOOD_BY_ID[r.clarifyingFoodId] ? r.clarifyingFoodId : null,
    notes: typeof r.notes === 'string' ? r.notes : '',
    provider,
  };
}

export class VisionError extends Error {}

const words = (x: string) => x.replace(/[׳'"״,()]/g, ' ').split(/\s+/).filter((w) => w.length > 1);

/**
 * The model's own Hebrew name decides when the closest list item is wrong: if the chosen food
 * shares no word with what the model said it saw, look the name up in the full national table
 * (4,500 foods) and use that instead. Example: "פתיתים מבושלים" never ends up as oats.
 */
export async function resolveByName(r: Recognition): Promise<Recognition> {
  const needs = r.items.some((i) => i.name && !sharesWord(i.name, FOOD_BY_ID[i.foodId]?.name ?? ''));
  if (!needs) return r;
  try {
    await loadFullDb();
  } catch {
    /* core list only */
  }
  const items = r.items.map((i) => {
    if (!i.name || sharesWord(i.name, FOOD_BY_ID[i.foodId]?.name ?? '')) return i;
    const hit = searchAll(i.name, 5).find((f) => sharesWord(i.name!, f.name)) ?? searchAll(words(i.name)[0] ?? '', 5).find((f) => sharesWord(i.name!, f.name));
    return hit ? { ...i, foodId: hit.id, alternatives: [i.foodId, ...(i.alternatives ?? [])].filter((a) => a !== hit.id).slice(0, 3) } : i;
  });
  return { ...r, items };
}

function sharesWord(a: string, b: string): boolean {
  const wb = new Set(words(b).map((w) => w.slice(0, 4)));
  return words(a).some((w) => wb.has(w.slice(0, 4)));
}

export async function availableProvider(apiKey?: string): Promise<'claude-app' | 'api-key' | null> {
  const s = await getSample();
  if (s) {
    try {
      if ((await s.limits()).images) return 'claude-app';
    } catch {
      /* fall through */
    }
  }
  return apiKey ? 'api-key' : null;
}

export async function recognizeFood(args: { file: Blob; apiKey?: string }): Promise<Recognition> {
  const provider = await availableProvider(args.apiKey);
  if (provider === 'claude-app') {
    const sample = (await getSample())!;
    try {
      const r = await sample.json<Omit<Recognition, 'provider'>>(`${INSTRUCTIONS}\n\nThe attached image is the user's plate.\n${JSON_SHAPE}`, { images: [args.file], modelTier: 'default' });
      return resolveByName(clean(r, 'claude-app'));
    } catch (e) {
      throw new VisionError(isSampleError(e) ? describeSampleError(e) : 'תקלה בזיהוי. נסו שוב.');
    }
  }
  if (provider === 'api-key') {
    const img = await toBase64(args.file);
    const client = new Anthropic({ apiKey: args.apiKey!, dangerouslyAllowBrowser: true });
    try {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system: INSTRUCTIONS,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> } },
        messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } }, { type: 'text', text: 'מה יש בצלחת?' }] }],
      });
      if (res.stop_reason === 'refusal') throw new VisionError('הבקשה נדחתה. נסו תמונה אחרת או רישום ידני.');
      const text = res.content.find((b) => b.type === 'text');
      if (!text || text.type !== 'text') throw new VisionError('לא התקבלה תשובה.');
      return await resolveByName(clean(JSON.parse(text.text), 'api-key'));
    } catch (e) {
      throw new VisionError(describeApiError(e));
    }
  }
  throw new VisionError('NO_PROVIDER');
}

/** Reads a nutrition label photo (used when a barcode is not in the product table). */
export async function readNutritionLabel(args: { file: Blob; apiKey?: string }): Promise<LabelReading> {
  const prompt = `This is a photo of an Israeli food product's nutrition facts label (Hebrew, "סימון תזונתי").
Read the values PER 100 g (or per 100 ml). Reply with only a JSON object:
{"name": string (product name in Hebrew if visible, else ""), "per100g": {"kcal": number, "protein": number, "fat": number, "carbs": number, "fiber": number}, "servingGrams": number|null, "allergens": string[] (Hebrew, as printed)}
Use 0 for a value that is printed as 0 and null is not allowed in per100g; if the label is unreadable, return per100g all 0 and name "".`;
  const provider = await availableProvider(args.apiKey);
  let r: LabelReading;
  if (provider === 'claude-app') {
    const sample = (await getSample())!;
    try {
      r = await sample.json<LabelReading>(prompt, { images: [args.file], modelTier: 'default' });
    } catch (e) {
      throw new VisionError(isSampleError(e) ? describeSampleError(e) : 'קריאת התווית נכשלה.');
    }
  } else if (provider === 'api-key') {
    const client = new Anthropic({ apiKey: args.apiKey!, dangerouslyAllowBrowser: true });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await toBase64(args.file) } }, { type: 'text', text: prompt }] }],
    });
    const t = res.content.find((b) => b.type === 'text');
    const raw = t && t.type === 'text' ? t.text : '{}';
    r = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as LabelReading;
  } else throw new VisionError('NO_PROVIDER');
  const p = r.per100g ?? ({} as LabelReading['per100g']);
  const n = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0);
  const reading: LabelReading = {
    name: typeof r.name === 'string' ? r.name : '',
    per100g: { kcal: n(p.kcal), protein: n(p.protein), fat: n(p.fat), carbs: n(p.carbs), fiber: n(p.fiber) },
    servingGrams: r.servingGrams && Number(r.servingGrams) > 0 ? Number(r.servingGrams) : null,
    allergens: Array.isArray(r.allergens) ? r.allergens.map(String).slice(0, 12) : [],
  };
  if (!reading.per100g.kcal) throw new VisionError('לא הצלחנו לקרוא את התווית. צלמו מקרוב, ישר ובאור טוב.');
  // sanity: energy must roughly match the macros (Atwater, ±25%), otherwise ask the user to check
  return reading;
}

export function labelLooksConsistent(r: LabelReading): boolean {
  const a = r.per100g.protein * 4 + r.per100g.carbs * 4 + r.per100g.fat * 9;
  return r.per100g.kcal > 0 && Math.abs(a - r.per100g.kcal) / r.per100g.kcal < 0.25;
}

export function describeApiError(e: unknown): string {
  if (e instanceof VisionError) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return 'קוד הגישה לזיהוי תמונות לא תקין. בדקו אותו בפרופיל.';
  if (e instanceof Anthropic.BadRequestError && /credit balance/i.test(e.message)) return 'אין יתרה בחשבון של זיהוי התמונות. אפשר לבחור את המנות מהרשימה.';
  if (e instanceof Anthropic.RateLimitError) return 'יותר מדי בקשות. נסו שוב בעוד דקה.';
  if (e instanceof Anthropic.APIConnectionError) return 'אין חיבור לשרת. אפשר לרשום ידנית.';
  if (e instanceof Anthropic.APIError) return `שגיאה מהשרת (${e.status}). אפשר לרשום ידנית.`;
  return e instanceof Error ? e.message : 'שגיאה לא צפויה.';
}

async function toBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Downscale a photo to keep requests small and fast. Returns a JPEG blob and a tiny thumbnail. */
export async function prepareImage(file: File): Promise<{ blob: Blob; thumb: string }> {
  const bmp = await createImageBitmap(file);
  const draw = (max: number) => {
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s);
    c.height = Math.round(bmp.height * s);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return c;
  };
  const big = draw(1280);
  const blob: Blob = await new Promise((res, rej) => big.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.85));
  return { blob, thumb: draw(160).toDataURL('image/jpeg', 0.7) };
}

/** Checks a personal access key with a tiny request. */
export async function checkKey(apiKey: string): Promise<'ok' | 'no_credit' | 'invalid' | 'error'> {
  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    await client.messages.create({ model: 'claude-haiku-5-5', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] });
    return 'ok';
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return 'invalid';
    if (e instanceof Anthropic.BadRequestError && /credit balance/i.test(e.message)) return 'no_credit';
    if (e instanceof Anthropic.PermissionDeniedError) return 'invalid';
    return 'error';
  }
}
