import type { Slot } from '../data/recipes';
import { usualTime, type LearningState } from './learning';

/**
 * Reminders: meal times, weigh-in, water, motivation and the user's own fixed-time reminders.
 * Pure logic (no browser APIs) so it can be tested and reused by any future module
 * (e.g. training sessions add their own reminder kinds).
 */
export type ReminderKind = 'meal' | 'weigh' | 'water' | 'motivation' | 'custom' | 'training';

export interface Reminder {
  id: string;
  kind: ReminderKind;
  title: string;
  body?: string;
  time: string; // HH:MM, local
  days: number[]; // 0 = Sunday … 6 = Saturday
  enabled: boolean;
  slot?: Slot;
  /** Module that owns the reminder; nutrition for now, training later. */
  module?: 'nutrition' | 'training';
}

export const DAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const MEAL_DEFAULTS: Record<Slot, string> = { breakfast: '08:00', lunch: '13:00', snack: '16:30', dinner: '19:30' };
const MEAL_TITLES: Record<Slot, string> = { breakfast: 'ארוחת בוקר', lunch: 'ארוחת צהריים', snack: 'ארוחת ביניים', dinner: 'ארוחת ערב' };

export function defaultReminders(mealsPerDay: number, learning?: LearningState): Reminder[] {
  const slots: Slot[] = mealsPerDay >= 4 ? ['breakfast', 'lunch', 'snack', 'dinner'] : ['breakfast', 'lunch', 'dinner'];
  const meals: Reminder[] = slots.map((slot) => ({
    id: `meal-${slot}`,
    kind: 'meal',
    slot,
    title: `הגיע הזמן ל${MEAL_TITLES[slot]}`,
    body: 'התפריט שלך מחכה. אחרי האוכל, רשמו בלחיצה.',
    time: (learning && usualTime(learning, slot)) || MEAL_DEFAULTS[slot],
    days: ALL_DAYS,
    enabled: true,
    module: 'nutrition',
  }));
  return [
    ...meals,
    { id: 'weigh', kind: 'weigh', title: 'שקילת בוקר', body: 'אחרי השירותים, לפני האוכל. המגמה חשובה יותר מהמספר של היום.', time: '07:30', days: [0, 3], enabled: true, module: 'nutrition' },
    { id: 'water', kind: 'water', title: 'כוס מים', body: 'עוד כוס מים מקרבת אותך ליעד השתייה של היום.', time: '11:00', days: ALL_DAYS, enabled: false, module: 'nutrition' },
    { id: 'motivation', kind: 'motivation', title: 'PRIME', time: '20:30', days: ALL_DAYS, enabled: true, module: 'nutrition' },
  ];
}

export function parseTime(t: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  return h < 24 && mm < 60 ? { h, m: mm } : null;
}

/** All occurrences between from (exclusive) and from + horizonMs, sorted. */
export function upcoming(reminders: Reminder[], from: Date, horizonMs = 7 * 864e5): { at: Date; r: Reminder }[] {
  const out: { at: Date; r: Reminder }[] = [];
  const end = from.getTime() + horizonMs;
  for (const r of reminders) {
    if (!r.enabled || !r.days.length) continue;
    const t = parseTime(r.time);
    if (!t) continue;
    for (let d = 0; d <= Math.ceil(horizonMs / 864e5); d++) {
      const at = new Date(from.getFullYear(), from.getMonth(), from.getDate() + d, t.h, t.m, 0, 0);
      if (at.getTime() <= from.getTime() || at.getTime() > end) continue;
      if (!r.days.includes(at.getDay())) continue;
      out.push({ at, r });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export interface MotivationContext {
  name?: string;
  kcalToday: number;
  kcalTarget: number;
  proteinToday: number;
  proteinTarget: number;
  loggedDaysLast7: number;
  trendChangeKg: number | null; // since start, negative = loss
  goalLosing: boolean;
  kgToGoal: number | null;
  weeksToGoal: number | null;
  loggedToday: boolean;
}

/** A short, specific message based on the day so far. Never shames; never pushes below target. */
export function motivation(c: MotivationContext, seed = new Date().getDate()): { title: string; body: string } {
  const hi = c.name ? `${c.name}, ` : '';
  const pick = <T,>(xs: T[]) => xs[seed % xs.length];
  if (!c.loggedToday)
    return { title: 'יום חדש, אותה מטרה', body: pick([`${hi}גם יום בלי רישום הוא חלק מהדרך. רשמו ארוחה אחת עכשיו, וזה מספיק כדי להישאר על המסלול.`, `${hi}לא נרשם היום אוכל. דקה אחת של רישום שומרת על התמונה המלאה.`]) };
  const proteinPct = c.proteinTarget ? c.proteinToday / c.proteinTarget : 0;
  const kcalPct = c.kcalTarget ? c.kcalToday / c.kcalTarget : 0;
  if (proteinPct < 0.7)
    return { title: 'חסר עוד קצת חלבון', body: `${hi}נשארו כ-${Math.round(c.proteinTarget - c.proteinToday)} גרם חלבון להיום. יוגורט חלבון, טונה או ביצים יסגרו את זה.` };
  if (kcalPct < 0.75)
    return { title: 'אל תדלגו על ארוחה', body: `${hi}אכלת היום פחות מהיעד. גוף שמקבל מספיק אוכל שומר על השריר ועל האנרגיה. כדאי להשלים ארוחה.` };
  if (c.trendChangeKg !== null && Math.abs(c.trendChangeKg) >= 0.5 && (c.trendChangeKg < 0) === c.goalLosing)
    return {
      title: 'ההתקדמות שלך אמיתית',
      body: `${hi}${c.goalLosing ? 'ירדת' : 'עלית'} ${Math.abs(c.trendChangeKg).toFixed(1)} ק"ג במגמה מאז ההתחלה.${c.kgToGoal && c.weeksToGoal ? ` נשארו ${c.kgToGoal.toFixed(1)} ק"ג, בערך ${c.weeksToGoal} שבועות.` : ''} ממשיכים.`,
    };
  if (c.loggedDaysLast7 >= 5) return { title: `${c.loggedDaysLast7} ימים מתוך 7`, body: `${hi}זו העקביות שמביאה תוצאות. עוד יום כזה מחר.` };
  return { title: 'יום טוב', body: pick([`${hi}עמדת ביעד היום. ככה נראית התקדמות.`, `${hi}עוד יום על המסלול. כל יום כזה מקרב את הגוף שראית בתחזית.`]) };
}

/** iCalendar export: recurring events with an alarm, so alerts arrive even when the app is closed. */
export function toICS(reminders: Reminder[], now = new Date()): string {
  const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PRIME//Reminders//HE', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:PRIME'];
  for (const r of reminders) {
    const t = parseTime(r.time);
    if (!r.enabled || !t || !r.days.length || r.kind === 'motivation') continue;
    const first = upcoming([{ ...r, days: r.days }], new Date(now.getTime() - 60e3), 8 * 864e5)[0]?.at ?? now;
    const dt = `${first.getFullYear()}${pad(first.getMonth() + 1)}${pad(first.getDate())}T${pad(t.h)}${pad(t.m)}00`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${r.id}@prime`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${dt}`,
      'DURATION:PT10M',
      `RRULE:FREQ=WEEKLY;BYDAY=${r.days.map((d) => DAYS[d]).join(',')}`,
      `SUMMARY:${esc(r.title)}`,
      ...(r.body ? [`DESCRIPTION:${esc(r.body)}`] : []),
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(r.title)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
