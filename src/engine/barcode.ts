import { registerFood, type Food } from '../data/foods';

const isAllergen = (a: Food['allergens'][number] | undefined): a is Food['allergens'][number] => Boolean(a);

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

const ALLERGEN_MAP: Record<string, Food['allergens'][number] | undefined> = {
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

/* ---------- products the user added from a label (remembered on this device) ---------- */

const MY_PRODUCTS = 'prime.myProducts';

function loadMine(): Food[] {
  try {
    return JSON.parse(localStorage.getItem(MY_PRODUCTS) ?? '[]') as Food[];
  } catch {
    return [];
  }
}

export function rememberProduct(f: Food) {
  try {
    const all = loadMine().filter((x) => x.id !== f.id);
    localStorage.setItem(MY_PRODUCTS, JSON.stringify([...all, f].slice(-300)));
  } catch {
    /* storage full: the product still works for this session */
  }
}

/** Register remembered products so logs and favourites can find them after a reload. */
export function restoreMyProducts() {
  loadMine().forEach(registerFood);
}

/* ---------- live Open Food Facts lookup (world-wide, includes imported products) ---------- */

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_he?: string;
  brands?: string;
  serving_quantity?: number | string;
  allergens_tags?: string[];
  nutriments?: Record<string, number | string | undefined>;
}

export function foodFromOff(code: string, p: OffProduct): Food | null {
  const n = p.nutriments ?? {};
  const num = (k: string) => {
    const v = Number(n[k]);
    return Number.isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : 0;
  };
  let kcal = Number(n['energy-kcal_100g']);
  if (!Number.isFinite(kcal) && Number.isFinite(Number(n['energy_100g']))) kcal = Number(n['energy_100g']) / 4.184;
  const name = (p.product_name_he || p.product_name || '').trim();
  if (!name || !Number.isFinite(kcal) || kcal < 0 || kcal > 950) return null;
  const brand = (p.brands ?? '').split(',')[0].trim();
  const serving = Number(p.serving_quantity);
  return {
    id: `bc:${code}`,
    code: Number(code),
    name: brand ? `${name} (${brand})` : name,
    officialName: name,
    aliases: [],
    per100g: { kcal: Math.round(kcal), protein: num('proteins_100g'), fat: num('fat_100g'), carbs: num('carbohydrates_100g'), fiber: num('fiber_100g') },
    units: [{ label: 'גרם', grams: 1 }, ...(serving > 0 && serving < 2000 ? [{ label: 'מנה לפי האריזה', grams: serving }] : [])],
    allergens: (p.allergens_tags ?? []).map((a) => ALLERGEN_MAP[a.split(':').pop() ?? '']).filter(isAllergen),
    vegan: false,
    vegetarian: false,
    category: 'other',
    role: 'other',
    source: 'openfoodfacts',
    verified: false,
  };
}

async function lookupOnline(code: string): Promise<Food | null | 'offline'> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=code,product_name,product_name_he,brands,serving_quantity,allergens_tags,nutriments`, { signal: ctl.signal });
    if (r.status === 404) return null;
    if (!r.ok) return 'offline';
    const d = (await r.json()) as { status?: number; product?: OffProduct };
    if (!d.product || d.status === 0) return null;
    return foodFromOff(code, d.product);
  } catch {
    return 'offline'; // no network, or the host blocks outside requests (e.g. inside claude.ai)
  } finally {
    clearTimeout(timer);
  }
}

export type LookupSource = 'mine' | 'online' | 'bundled';

/**
 * Finds a product by barcode: 1) products the user added from a label, 2) Open Food Facts live
 * (~3 million products world-wide, incl. imports sold in Israel), 3) the bundled Israeli table
 * (works offline and where outside requests are blocked).
 */
export async function lookupBarcode(code: string): Promise<{ food: Food; from: LookupSource } | null> {
  const id = `bc:${code}`;
  const mine = loadMine().find((f) => f.id === id);
  if (mine) {
    registerFood(mine);
    return { food: mine, from: 'mine' };
  }
  const online = await lookupOnline(code);
  if (online && online !== 'offline') {
    registerFood(online);
    return { food: online, from: 'online' };
  }
  let table: Map<string, ProductRow>;
  try {
    table = await loadProducts();
  } catch {
    return null;
  }
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
      .filter(isAllergen),
    vegan: false,
    vegetarian: false,
    category: 'other',
    role: 'other',
    source: 'openfoodfacts',
    verified: false,
  };
  registerFood(f);
  return { food: f, from: 'bundled' };
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
  if (code) rememberProduct(f);
  return f;
}

/* ---------- Israeli supermarket barcode index (price-transparency files) ---------- */

export interface KnownProduct {
  code: string;
  name: string;
  manufacturer: string;
  country: string;
  quantity: string;
  unit: string;
}

type IndexRow = [string, string, string, string, string, string];
let index: Map<string, IndexRow> | null = null;
let indexLoading: Promise<Map<string, IndexRow>> | null = null;

function loadIndex(): Promise<Map<string, IndexRow>> {
  if (index) return Promise.resolve(index);
  if (!indexLoading)
    indexLoading = fetch('./il-barcodes.json')
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<{ products: IndexRow[] }>;
      })
      .then((d) => (index = new Map(d.products.map((p) => [p[0], p]))))
      .catch((e) => {
        indexLoading = null;
        throw e;
      });
  return indexLoading;
}

/** Identifies a product sold in Israeli supermarkets (name, maker, size). No nutrition values. */
export async function identifyBarcode(code: string): Promise<KnownProduct | null> {
  try {
    const t = await loadIndex();
    const r = t.get(code) ?? t.get(code.padStart(13, '0'));
    if (!r) return null;
    const [c, name, manufacturer, country, quantity, unit] = r;
    return { code: c, name, manufacturer, country, quantity, unit };
  } catch {
    return null;
  }
}

/** Words of a product name that help find it in the Ministry of Health table. */
export function nameKeywords(name: string): string {
  return name
    .replace(/\d+([.,]\d+)?\s*(גרם|גר|ג'|ג|מ"ל|מל|ליטר|ל'|ק"ג|יח'|יחידות|%)/g, ' ')
    .replace(/["'״׳()\-+*/.,]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !/^\d+$/.test(w))
    .slice(0, 4)
    .join(' ');
}
