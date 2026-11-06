import { FOODS, type Food } from '../data/foods';

const NUM_WORDS: Record<string, number> = {
  חצי: 0.5,
  אחד: 1,
  אחת: 1,
  שני: 2,
  שתי: 2,
  שניים: 2,
  שתיים: 2,
  שלוש: 3,
  שלושה: 3,
  ארבע: 4,
  ארבעה: 4,
  חמש: 5,
  חמישה: 5,
};

const norm = (s: string) => s.replace(/[׳'"״]/g, '').trim();

export interface ParsedItem {
  food: Food;
  grams: number;
  unitLabel: string;
  qty: number;
}

/**
 * Parses free Hebrew text such as "אכלתי שתי ביצים, פרוסה לחם מלא וחצי פיתה עם חומוס".
 * Deterministic: matches known food names/aliases and nearby quantity/unit words.
 */
export function parseFoodText(text: string): ParsedItem[] {
  const clean = norm(text).replace(/^אכלתי\s*/, '');
  const parts = clean.split(/,|\s+ו(?=[א-ת])|\s+עם\s+|\s+וגם\s+/).map((p) => p.trim()).filter(Boolean);
  const out: ParsedItem[] = [];
  for (const part of parts) {
    // find the longest name/alias contained in this part
    let best: { food: Food; name: string } | null = null;
    for (const f of FOODS) {
      for (const n of [f.name, ...f.aliases].map(norm)) {
        const core = n.split(' ')[0].length > 2 && !part.includes(n) ? n.split(' ')[0] : n;
        if (part.includes(core) && (!best || core.length > best.name.length)) best = { food: f, name: core };
      }
    }
    if (!best) continue;
    let qty = 1;
    const num = part.match(/(\d+(?:\.\d+)?)/);
    if (num) qty = Number(num[1]);
    else for (const [w, v] of Object.entries(NUM_WORDS)) if (new RegExp(`(^|\\s)${w}(\\s|$)`).test(part)) qty = v;
    const gramsMatch = part.match(/(\d+)\s*(גרם|ג׳|ג)/);
    let grams: number;
    let unitLabel: string;
    if (gramsMatch) {
      grams = Number(gramsMatch[1]);
      unitLabel = 'גרם';
      qty = grams;
    } else {
      const units = best.food.units.filter((u) => u.grams > 1);
      const named = units.find((u) => part.includes(u.label.split(' ')[0]) && u.label.split(' ')[0].length > 2);
      const preferred =
        units.find((u) => u.label === 'יחידה') ??
        units.find((u) => u.label.includes('בינונית')) ??
        units.find((u) => u.label.startsWith('יחידה')) ??
        units.find((u) => u.label.startsWith('פרוסה')) ??
        units.find((u) => u.label.startsWith('מנה'));
      const namedFit = named && named.label.startsWith('פרוסה') ? units.find((u) => u.label === 'פרוסה בינונית') ?? named : named;
      const unit = namedFit ?? preferred ?? units[0] ?? { label: 'גרם', grams: 100 };
      grams = unit.grams * qty;
      unitLabel = unit.label;
    }
    out.push({ food: best.food, grams, unitLabel, qty });
  }
  return out;
}
