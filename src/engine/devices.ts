import type { DeviceSample } from '../state/store';

/**
 * Device connections.
 *  1. Bluetooth (Web Bluetooth, Chrome on Android/desktop): standard heart-rate straps/watches in
 *     broadcast mode, and smart scales that implement the standard Weight Scale service.
 *  2. File import: Apple Health export (export.zip / export.xml), and CSV exports from Garmin,
 *     Whoop, Oura, Samsung Health, Fitbit, Polar, Withings (columns are detected by name).
 *  3. Cloud APIs (Garmin Health API, Whoop, Oura, Fitbit, Withings, Polar): need a server and
 *     a registered developer app per company: specified in HANDOFF.md, not callable from a page.
 */

export interface Provider {
  id: string;
  name: string;
  what: string;
  how: 'bluetooth' | 'file' | 'native';
  cloud: string; // what the full (server) integration will use
  exportHelp: string; // how to get a file today
}

export const PROVIDERS: Provider[] = [
  { id: 'apple', name: 'Apple Watch / Apple Health', what: 'צעדים, קלוריות פעילות, דופק במנוחה, HRV, שינה, משקל', how: 'file', cloud: 'HealthKit באפליקציית האייפון (לא נגיש מדפדפן)', exportHelp: 'באפליקציית Health: התמונה שלך למעלה ← ייצוא כל נתוני הבריאות. מעלים כאן את קובץ ה-ZIP.' },
  { id: 'garmin', name: 'Garmin', what: 'צעדים, קלוריות, דופק במנוחה, שינה, Body Battery', how: 'file', cloud: 'Garmin Health API (דורש אישור שותף מ-Garmin)', exportHelp: 'ב-Garmin Connect באתר: דוחות ← בוחרים דוח (צעדים/שינה/דופק) ← ייצוא CSV.' },
  { id: 'whoop', name: 'Whoop', what: 'התאוששות, HRV, דופק במנוחה, שינה, מאמץ', how: 'file', cloud: 'Whoop Developer API (OAuth)', exportHelp: 'באפליקציית Whoop: פרופיל ← App Settings ← Data Export. מעלים את physiological_cycles.csv.' },
  { id: 'oura', name: 'Oura (טבעת חכמה)', what: 'שינה, HRV, דופק במנוחה, צעדים, מוכנות', how: 'file', cloud: 'Oura API v2 (OAuth)', exportHelp: 'באתר cloud.ouraring.com: My Account ← Export Data ← CSV.' },
  { id: 'samsung', name: 'Samsung Galaxy Watch / Samsung Health', what: 'צעדים, שינה, דופק, משקל והרכב גוף', how: 'file', cloud: 'Health Connect באפליקציית האנדרואיד', exportHelp: 'ב-Samsung Health: הגדרות ← הורדת נתונים אישיים. מעלים את קבצי ה-CSV.' },
  { id: 'fitbit', name: 'Fitbit / Google Pixel Watch', what: 'צעדים, קלוריות, שינה, דופק במנוחה', how: 'file', cloud: 'Fitbit Web API / Health Connect', exportHelp: 'דרך Google Takeout ← Fitbit. מעלים את קבצי ה-CSV.' },
  { id: 'polar', name: 'Polar', what: 'אימונים, דופק, שינה', how: 'file', cloud: 'Polar AccessLink API', exportHelp: 'ב-Polar Flow: הגדרות ← ייצוא נתונים.' },
  { id: 'withings', name: 'Withings / משקל חכם', what: 'משקל, אחוז שומן, מסת שריר', how: 'file', cloud: 'Withings API (OAuth)', exportHelp: 'ב-Health Mate באתר: הגדרות ← הורדת הנתונים שלי.' },
  { id: 'ble-hr', name: 'רצועת דופק / שעון במצב שידור (Bluetooth)', what: 'דופק חי', how: 'bluetooth', cloud: 'ישיר, בלי שרת', exportHelp: 'מפעילים בשעון "שידור דופק" (Garmin, Polar, Wahoo ועוד) ומתחברים מכאן.' },
  { id: 'ble-scale', name: 'משקל חכם (Bluetooth)', what: 'משקל', how: 'bluetooth', cloud: 'ישיר, בלי שרת (משקלים שתומכים בתקן Weight Scale)', exportHelp: 'עולים על המשקל ולוחצים "התחברות".' },
];

/* ---------- Bluetooth ---------- */

type BtChar = { startNotifications(): Promise<BtChar>; addEventListener(t: string, f: (e: { target: { value: DataView } }) => void): void; stopNotifications?(): Promise<unknown> };
type BtDevice = { name?: string; gatt?: { connect(): Promise<{ getPrimaryService(s: string): Promise<{ getCharacteristic(c: string): Promise<BtChar> }>; disconnect(): void }> } };
type Bt = { requestDevice(o: unknown): Promise<BtDevice> };

export function bluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/** Heart Rate Measurement (0x2A37) parser per the Bluetooth GATT spec. */
export function parseHeartRate(v: DataView): number {
  const flags = v.getUint8(0);
  return flags & 0x1 ? v.getUint16(1, true) : v.getUint8(1);
}

/** Weight Measurement (0x2A9D) parser: SI unit = 0.005 kg resolution, imperial = 0.01 lb. */
export function parseWeight(v: DataView): number {
  const flags = v.getUint8(0);
  const raw = v.getUint16(1, true);
  return flags & 0x1 ? raw * 0.01 * 0.45359237 : raw * 0.005;
}

export async function connectHeartRate(onBpm: (bpm: number) => void): Promise<{ name: string; stop: () => void }> {
  const bt = (navigator as unknown as { bluetooth: Bt }).bluetooth;
  const device = await bt.requestDevice({ filters: [{ services: ['heart_rate'] }] });
  const server = await device.gatt!.connect();
  const ch = await (await server.getPrimaryService('heart_rate')).getCharacteristic('heart_rate_measurement');
  await ch.startNotifications();
  ch.addEventListener('characteristicvaluechanged', (e) => onBpm(parseHeartRate(e.target.value)));
  return { name: device.name ?? 'חיישן דופק', stop: () => server.disconnect() };
}

export async function connectScale(onWeight: (kg: number) => void): Promise<{ name: string; stop: () => void }> {
  const bt = (navigator as unknown as { bluetooth: Bt }).bluetooth;
  const device = await bt.requestDevice({ filters: [{ services: ['weight_scale'] }] });
  const server = await device.gatt!.connect();
  const ch = await (await server.getPrimaryService('weight_scale')).getCharacteristic('weight_measurement');
  await ch.startNotifications();
  ch.addEventListener('characteristicvaluechanged', (e) => onWeight(Math.round(parseWeight(e.target.value) * 10) / 10));
  return { name: device.name ?? 'משקל חכם', stop: () => server.disconnect() };
}

/* ---------- file import ---------- */

const day = (s: string): string | null => {
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/) ?? s.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (!m) return null;
  if (m[1].length === 4) return `${m[1]}-${m[2]}-${m[3]}`;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};

type Acc = Map<string, DeviceSample & { _hr?: number[]; _hrv?: number[]; _sleepMin?: number; _wt?: number[]; _bySrc?: Record<string, { steps: number; kcal: number }> }>;

function finish(acc: Acc): DeviceSample[] {
  return [...acc.values()]
    .map((d) => {
      const out: DeviceSample = { date: d.date, source: d.source };
      if (d.steps) out.steps = Math.round(d.steps);
      if (d.activeKcal) out.activeKcal = Math.round(d.activeKcal);
      if (d._hr?.length) out.restingHr = Math.round(Math.min(...d._hr));
      if (d._hrv?.length) out.hrv = Math.round(d._hrv.reduce((a, b) => a + b, 0) / d._hrv.length);
      if (d._sleepMin) out.sleepHours = Math.round((d._sleepMin / 60) * 10) / 10;
      if (d._wt?.length) out.weightKg = Math.round(d._wt[0] * 10) / 10;
      if (d.bodyFatPct) out.bodyFatPct = d.bodyFatPct;
      return out;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

const get = (acc: Acc, date: string, source: string) => {
  let d = acc.get(date);
  if (!d) acc.set(date, (d = { date, source }));
  return d;
};

/** "2024-01-01 08:00:00 +0200" -> epoch ms */
function appleDate(s: string): number {
  const m = s.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-])(\d{2})(\d{2})$/);
  return m ? Date.parse(`${m[1]}T${m[2]}${m[3]}${m[4]}:${m[5]}`) : Date.parse(s);
}

/** Parse Apple Health export.xml text (streamed in chunks). */
export function parseAppleHealthXml(chunks: Iterable<string>, sinceDays = 120): DeviceSample[] {
  const acc: Acc = new Map();
  const since = new Date(Date.now() - sinceDays * 864e5).toISOString().slice(0, 10);
  const re = /<Record\s[^>]*?type="HK(?:Quantity|Category)TypeIdentifier(\w+)"[^>]*>/g;
  const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? '';
  let rest = '';
  for (const chunk of chunks) {
    const textBuf = rest + chunk;
    let last = 0;
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(textBuf))) {
      last = re.lastIndex;
      const tag = m[0];
      const type = m[1];
      const unit = attr(tag, 'unit');
      const start = attr(tag, 'startDate');
      const end = attr(tag, 'endDate');
      const value = attr(tag, 'value');
      if (!start) continue;
      const date = start.slice(0, 10);
      if (date < since) continue;
      const d = get(acc, date, 'Apple Health');
      const v = Number(value);
      switch (type) {
        // iPhone and Watch both record steps/energy: sum per source, then keep the larger source (no double counting)
        case 'StepCount': {
          const src = ((d._bySrc ??= {})[attr(tag, 'sourceName')] ??= { steps: 0, kcal: 0 });
          src.steps += v;
          d.steps = Math.max(...Object.values(d._bySrc).map((x) => x.steps));
          break;
        }
        case 'ActiveEnergyBurned': {
          const src = ((d._bySrc ??= {})[attr(tag, 'sourceName')] ??= { steps: 0, kcal: 0 });
          src.kcal += unit === 'kJ' ? v / 4.184 : v;
          d.activeKcal = Math.max(...Object.values(d._bySrc).map((x) => x.kcal));
          break;
        }
        case 'RestingHeartRate':
          (d._hr ??= []).push(v);
          break;
        case 'HeartRateVariabilitySDNN':
          (d._hrv ??= []).push(v);
          break;
        case 'BodyMass':
          (d._wt ??= []).push(unit === 'lb' ? v * 0.45359237 : v);
          break;
        case 'BodyFatPercentage':
          d.bodyFatPct = Math.round((v <= 1 ? v * 100 : v) * 10) / 10;
          break;
        case 'SleepAnalysis':
          if (/Asleep/.test(value)) {
            const mins = (appleDate(end) - appleDate(start)) / 60000;
            const wake = get(acc, end.slice(0, 10), 'Apple Health');
            if (mins > 0 && mins < 24 * 60) wake._sleepMin = (wake._sleepMin ?? 0) + mins;
          }
          break;
      }
    }
    rest = textBuf.slice(Math.max(last, textBuf.length - 2000));
  }
  return finish(acc);
}

const COLS: [keyof DeviceSample | '_hr' | '_hrv' | '_sleepMin' | '_sleepH' | '_wt', RegExp][] = [
  ['steps', /^(steps|total steps|step count|צעדים|count)$/i],
  ['activeKcal', /(active (energy|calories)|energy burned|calories burned|activity calories|active_calories|קלוריות)/i],
  ['_hr', /(resting heart rate|resting hr|rhr|lowest heart rate|דופק במנוחה)/i],
  ['_hrv', /(heart rate variability|hrv|average hrv|rmssd)/i],
  ['_sleepMin', /(asleep duration \(min\)|total sleep \(min\)|sleep duration \(min\)|minutes asleep)/i],
  ['_sleepH', /(total sleep duration|sleep \(h|hours asleep|שינה)/i],
  ['_wt', /^(weight|weight \(kg\)|body weight|משקל)/i],
  ['bodyFatPct', /(body fat|fat %|fat ratio|אחוז שומן)/i],
];
const DATE_COL = /(date|day|cycle start time|start time|summary date|start|תאריך|יום)/i;

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === ',' && !q) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Generic CSV import for Garmin, Whoop, Oura, Samsung, Fitbit, Polar, Withings exports. */
export function parseHealthCsv(text: string, source: string): DeviceSample[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  // Samsung Health CSVs have a metadata first line
  let headerIdx = 0;
  if (lines[0].split(',').length <= 3 && lines.length > 2) headerIdx = 1;
  const header = splitCsvLine(lines[headerIdx]).map((h) => h.replace(/^﻿/, ''));
  const dateIdx = header.findIndex((h) => DATE_COL.test(h));
  if (dateIdx < 0) return [];
  const map = header.map((h) => COLS.find(([, re]) => re.test(h))?.[0]);
  const acc: Acc = new Map();
  for (const line of lines.slice(headerIdx + 1)) {
    const cells = splitCsvLine(line);
    const date = day(cells[dateIdx] ?? '');
    if (!date) continue;
    const d = get(acc, date, source);
    cells.forEach((c, i) => {
      const k = map[i];
      const v = Number(c.replace(/[^\d.-]/g, ''));
      if (!k || !c || !Number.isFinite(v)) return;
      if (k === 'steps') d.steps = (d.steps ?? 0) + v;
      else if (k === 'activeKcal') d.activeKcal = (d.activeKcal ?? 0) + v;
      else if (k === '_hr') (d._hr ??= []).push(v);
      else if (k === '_hrv') (d._hrv ??= []).push(v);
      else if (k === '_sleepMin') d._sleepMin = (d._sleepMin ?? 0) + v;
      else if (k === '_sleepH') d._sleepMin = (d._sleepMin ?? 0) + v * 60;
      else if (k === '_wt') (d._wt ??= []).push(v > 250 ? v * 0.45359237 : v);
      else if (k === 'bodyFatPct') d.bodyFatPct = v;
    });
  }
  return finish(acc).filter((d) => Object.keys(d).length > 2);
}

/** Reads any supported export file in the browser. */
export async function importHealthFile(file: File, source: string): Promise<DeviceSample[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.zip')) {
    const { unzip } = await import('fflate');
    const buf = new Uint8Array(await file.arrayBuffer());
    const files: Record<string, Uint8Array> = await new Promise((res, rej) =>
      unzip(buf, { filter: (f) => /export\.xml$|\.csv$/i.test(f.name) && !/export_cda/i.test(f.name) }, (err, out) => (err ? rej(err) : res(out))),
    );
    const out: DeviceSample[] = [];
    for (const [fname, data] of Object.entries(files)) {
      const text = new TextDecoder().decode(data);
      if (/export\.xml$/i.test(fname)) out.push(...parseAppleHealthXml(chunked(text)));
      else out.push(...parseHealthCsv(text, source));
    }
    return out;
  }
  if (name.endsWith('.xml')) {
    const chunks: string[] = [];
    const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return parseAppleHealthXml(chunks);
  }
  return parseHealthCsv(await file.text(), source);
}

function* chunked(text: string, size = 1 << 20) {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size);
}
