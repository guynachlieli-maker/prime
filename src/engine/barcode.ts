import { FOOD_BY_ID, registerFood, type Food } from '../data/foods';

/**
 * Barcode reading and product lookup.
 * Reading: the browser's BarcodeDetector where available (Chrome/Android), otherwise ZXing
 * (works on iPhone Safari). Lookup: a product table of Israeli products from Open Food Facts,
 * bundled with the app. Open Food Facts is community-edited, so these values are marked
 * "check against the label" (verified: false) until the retailer/manufacturer feed in the spec exists.
 */

type Detector = { detect(src: ImageBitmapSource): Promise<{ rawValue: string }[]> };
type DetectorCtor = new (o: { formats: string[] }) => Detector;
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

function nativeDetector(): Detector | null {
  const BD = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  if (!BD) return null;
  try {
    return new BD({ formats: FORMATS });
  } catch {
    return null;
  }
}

export function isValidEan(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((a, d, i) => a + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Decode a barcode from a photo. */
export async function scanImage(file: Blob): Promise<string | null> {
  const det = nativeDetector();
  if (det) {
    try {
      const r = await det.detect(await createImageBitmap(file));
      if (r[0]?.rawValue) return r[0].rawValue;
    } catch {
      /* fall back to ZXing */
    }
  }
  const { BrowserMultiFormatReader } = await import('@zxing/browser');
  const url = URL.createObjectURL(file);
  try {
    const res = await new BrowserMultiFormatReader().decodeFromImageUrl(url);
    return res.getText();
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Live scanning from the camera. Resolves a stop function; rejects if the camera is not available. */
export async function startLiveScan(video: HTMLVideoElement, onCode: (code: string) => void): Promise<() => void> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('no-camera');
  const det = nativeDetector();
  if (det) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    await video.play();
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        const r = await det.detect(video);
        if (r[0]?.rawValue && isValidEan(r[0].rawValue)) {
          onCode(r[0].rawValue);
          return;
        }
      } catch {
        /* frame not ready */
      }
      setTimeout(tick, 200);
    };
    tick();
    return () => {
      stopped = true;
      stream.getTracks().forEach((t) => t.stop());
    };
  }
  const { BrowserMultiFormatReader } = await import('@zxing/browser');
  const reader = new BrowserMultiFormatReader();
  const controls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' }, audio: false }, video, (result) => {
    const t = result?.getText();
    if (t && isValidEan(t)) onCode(t);
  });
  return () => controls.stop();
}

/* ---------- product table ---------- */

type ProductRow = [code: string, name: string, brand: string, kcal: number, protein: number, fat: number, carbs: number, fiber: number, serving: number | null, allergens: string];
let products: Map<string, ProductRow> | null = null;
let loading: Promise<Map<string, ProductRow>> | null = null;

function loadProducts(): Promise<Map<string, ProductRow>> {
  if (products) return Promise.resolve(products);
  if (!loading)
    loading = fetch('./il-products.json')
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<{ products: ProductRow[] }>;
      })
      .then((d) => (products = new Map(d.products.map((p) => [p[0], p]))))
      .catch((e) => {
        loading = null;
        throw e;
      });
  return loading;
}

const ALLERGEN_MAP: Record<string, Food['allergens'][number]> = {
  gluten: 'gluten',
  milk: 'dairy',
  eggs: 'egg',
  nuts: 'nuts',
  peanuts: 'peanuts',
  'sesame-seeds': 'sesame',
  fish: 'fish',
  soybeans: 'soy',
  גלוטן: 'gluten',
  חלב: 'dairy',
  ביצים: 'egg',
  אגוזים: 'nuts',
  בוטנים: 'peanuts',
  שומשום: 'sesame',
  דגים: 'fish',
  סויה: 'soy',
};

export async function lookupBarcode(code: string): Promise<Food | null> {
  const id = `bc:${code}`;
  if (FOOD_BY_ID[id]) return FOOD_BY_ID[id];
  const table = await loadProducts();
  const p = table.get(code) ?? table.get(code.replace(/^0+/, ''));
  if (!p) return null;
  const [c, name, brand, kcal, protein, fat, carbs, fiber, serving, allergens] = p;
  const f: Food = {
    id,
    code: Number(c),
    name: brand ? `${name} (${brand})` : name,
    officialName: name,
    aliases: [],
    per100g: { kcal, protein, fat, carbs, fiber },
    units: [{ label: 'גרם', grams: 1 }, ...(serving ? [{ label: 'מנה לפי האריזה', grams: serving }] : [])],
    allergens: allergens
      .split(',')
      .map((a) => ALLERGEN_MAP[a])
      .filter(Boolean),
    vegan: false,
    vegetarian: false,
    category: 'other',
    role: 'other',
    source: 'openfoodfacts',
    verified: false,
  };
  registerFood(f);
  return f;
}

/** A product read from a photographed nutrition label. */
export function foodFromLabel(code: string | null, reading: { name: string; per100g: Food['per100g']; servingGrams: number | null }): Food {
  const f: Food = {
    id: code ? `bc:${code}` : `label:${Date.now()}`,
    code: code ? Number(code) : 0,
    name: reading.name || 'מוצר מתווית',
    officialName: reading.name,
    aliases: [],
    per100g: reading.per100g,
    units: [{ label: 'גרם', grams: 1 }, ...(reading.servingGrams ? [{ label: 'מנה לפי האריזה', grams: reading.servingGrams }] : [])],
    allergens: [],
    vegan: false,
    vegetarian: false,
    category: 'other',
    role: 'other',
    source: 'label',
    verified: false,
  };
  registerFood(f);
  return f;
}
