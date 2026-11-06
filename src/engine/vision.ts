import Anthropic from '@anthropic-ai/sdk';
import { FOODS, FOOD_BY_ID } from '../data/foods';

/**
 * Food photo recognition.
 * The model only identifies components and estimates grams. Nutrient values always come from our
 * food table (spec: "המודל לא ממציא ערכים תזונתיים"). Each component must map to a food id from the table.
 *
 * In production this call must run on our server (the key must never ship in the app). In this
 * build the user can paste their own key in Settings, which calls the API directly from the browser.
 */
export interface RecognizedItem {
  foodId: string;
  grams: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface Recognition {
  items: RecognizedItem[];
  clarifyingQuestion: string | null;
  notes: string;
}

const MODEL = 'claude-opus-5-5';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'clarifyingQuestion', 'notes'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['foodId', 'grams', 'confidence'],
        properties: {
          foodId: { type: 'string', enum: FOODS.map((f) => f.id) },
          grams: { type: 'number' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    clarifyingQuestion: { type: ['string', 'null'] },
    notes: { type: 'string' },
  },
} as const;

const SYSTEM = `You identify the foods on a plate photographed by a user of an Israeli nutrition app.
Return only components you can see. Map each component to the closest foodId from this list (id: Hebrew name):
${FOODS.map((f) => `${f.id}: ${f.name}`).join('\n')}
Estimate the grams of each component from plate size and typical portions. Do not estimate calories.
If one hidden factor would change the total the most (oil, sauce, rice type), ask one short clarifying question in Hebrew; otherwise null.
"notes" is one short Hebrew sentence on what you saw. If the image is not food, return no items and say so in notes.`;

export async function recognizeFood(args: { apiKey: string; imageBase64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' }): Promise<Recognition> {
  const client = new Anthropic({ apiKey: args.apiKey, dangerouslyAllowBrowser: true });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> } },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: args.mediaType, data: args.imageBase64 } },
          { type: 'text', text: 'מה יש בצלחת?' },
        ],
      },
    ],
  });
  if (res.stop_reason === 'refusal') throw new Error('הבקשה נדחתה. נסו תמונה אחרת או רישום ידני.');
  const text = res.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('לא התקבלה תשובה מהמודל.');
  const parsed = JSON.parse(text.text) as Recognition;
  parsed.items = parsed.items.filter((i) => FOOD_BY_ID[i.foodId] && i.grams > 0 && i.grams < 2000);
  return parsed;
}

export function describeApiError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'מפתח ה-API לא תקין. בדקו אותו בהגדרות.';
  if (e instanceof Anthropic.RateLimitError) return 'יותר מדי בקשות. נסו שוב בעוד דקה.';
  if (e instanceof Anthropic.APIConnectionError) return 'אין חיבור לשרת. התמונה נשמרה, ואפשר לרשום ידנית.';
  if (e instanceof Anthropic.APIError) return `שגיאה מהשרת (${e.status}). אפשר לרשום ידנית.`;
  return e instanceof Error ? e.message : 'שגיאה לא צפויה.';
}

/** Downscale a photo to keep requests small and fast. Returns base64 (no prefix) and a tiny thumbnail. */
export async function prepareImage(file: File): Promise<{ base64: string; thumb: string; mediaType: 'image/jpeg' }> {
  const bmp = await createImageBitmap(file);
  const draw = (max: number, q: number) => {
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s);
    c.height = Math.round(bmp.height * s);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q);
  };
  const full = draw(1024, 0.85);
  return { base64: full.split(',')[1], thumb: draw(160, 0.7), mediaType: 'image/jpeg' };
}
