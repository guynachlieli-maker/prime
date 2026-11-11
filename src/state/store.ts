import type { Reminder } from '../engine/reminders';
import type { TrainingState } from '../training/state';
import { useSyncExternalStore } from 'react';
import { computeTargets } from '../engine/targets';
import { EMPTY_SCREENING, type Nutrients, type Profile, type Targets } from '../engine/types';
import type { WeighIn } from '../engine/adaptive';
import type { Slot } from '../data/recipes';
import { EMPTY_LEARNING, recordMealTime, type LearningState } from '../engine/learning';

export type LogMethod = 'photo' | 'barcode' | 'search' | 'voice' | 'plan' | 'favorite' | 'supplement';

export interface LogItem {
  foodId: string;
  name: string;
  grams: number;
}

export interface MealLog {
  id: string;
  date: string;
  time: string;
  slot: Slot;
  items: LogItem[];
  method: LogMethod;
  nutrients: Nutrients;
  photo?: string; // small data URL thumbnail, kept on this device only
  aiEstimate?: Nutrients; // original estimate before the user's corrections
}

export interface Measurement {
  date: string;
  waistCm?: number;
  hipCm?: number;
  chestCm?: number;
  thighCm?: number;
  armCm?: number;
  neckCm?: number;
}

export interface SafetyEvent {
  date: string;
  kind: string;
  message: string;
}

export interface DeviceSample {
  date: string;
  source: string;
  steps?: number;
  activeKcal?: number;
  restingHr?: number;
  hrv?: number;
  sleepHours?: number;
  weightKg?: number;
  bodyFatPct?: number;
}

export interface ConnectedDevice {
  id: string;
  name: string;
  kind: 'bluetooth-hr' | 'bluetooth-scale' | 'file' | 'cloud';
  lastSync: string;
}

export interface State {
  version: 1;
  profile?: Profile;
  targets?: Targets;
  tdeeOverride?: number;
  lastTdeeReview?: string;
  onboardingDone: boolean;
  startedAt?: string;
  tourDone: boolean;
  seenHints: string[];
  logs: MealLog[];
  weighIns: (WeighIn & { time: string })[];
  water: Record<string, number>;
  measurements: Measurement[];
  favorites: { id: string; name: string; items: LogItem[] }[];
  planFixed: Record<string, Record<number, string>>;
  activeProgramId?: string;
  safetyEvents: SafetyEvent[];
  learning: LearningState;
  profilePhoto?: string;
  devices: ConnectedDevice[];
  deviceData: DeviceSample[];
  /** undefined until the user first opens reminders (then filled with defaults). */
  reminders?: Reminder[];
  /** date -> supplement id -> log id ('' when it has no calories) */
  suppTaken?: Record<string, Record<string, string>>;
  /** Feature modules. Nutrition is active; training is prepared for a later release. */
  modules: { nutrition: true; training: boolean };
  /** Training module storage (empty until the module launches). */
  training?: TrainingState;
  settings: {
    apiKey?: string;
    hideAvatar: boolean;
    trainingConsent: boolean;
    theme: 'system' | 'light' | 'dark';
    detailed: boolean;
    reminders: boolean;
    notifyAsked?: boolean;
  };
}

const KEY = 'prime.v1';

const initial: State = {
  version: 1,
  onboardingDone: false,
  tourDone: false,
  seenHints: [],
  logs: [],
  weighIns: [],
  water: {},
  measurements: [],
  favorites: [],
  planFixed: {},
  safetyEvents: [],
  learning: EMPTY_LEARNING,
  devices: [],
  deviceData: [],
  modules: { nutrition: true, training: false },
  settings: { hideAvatar: false, trainingConsent: false, theme: 'system', detailed: false, reminders: true },
};

/** Brings saved data of any earlier build up to the current shape. Exported for tests. */
export function migrate(parsed: Partial<State>): State {
  const s: State = {
    ...initial,
    ...parsed,
    version: 1,
    learning: { ...EMPTY_LEARNING, ...(parsed.learning ?? {}) },
    settings: { ...initial.settings, ...(parsed.settings ?? {}) },
    modules: { ...initial.modules, ...(parsed.modules ?? {}) },
  };
  // arrays and maps that older builds did not have
  for (const k of ['logs', 'weighIns', 'measurements', 'favorites', 'safetyEvents', 'devices', 'deviceData', 'seenHints'] as const) if (!Array.isArray(s[k])) (s as unknown as Record<string, unknown>)[k] = [];
  for (const k of ['water', 'planFixed'] as const) if (!s[k] || typeof s[k] !== 'object') (s as unknown as Record<string, unknown>)[k] = {};
  // supplements used to be logged as plan meals: mark them, so they never count as an eaten meal
  const suppIds = new Set(Object.values(s.suppTaken ?? {}).flatMap((d) => Object.values(d)).filter(Boolean));
  if (suppIds.size && s.logs.some((l) => suppIds.has(l.id) && l.method !== 'supplement')) s.logs = s.logs.map((l) => (suppIds.has(l.id) ? { ...l, method: 'supplement' } : l));
  if (s.profile) {
    const p = s.profile;
    s.profile = {
      ...p,
      allergies: p.allergies ?? [],
      dislikes: p.dislikes ?? [],
      mealsPerDay: Math.min(5, Math.max(3, Math.round(p.mealsPerDay || 4))),
      maxPrepMinutes: Math.max(5, p.maxPrepMinutes || 30),
      screening: { ...EMPTY_SCREENING, ...(p.screening ?? {}) },
    };
  }
  if (s.training && !Array.isArray(s.training.sessions)) s.training = { ...s.training, sessions: [] };
  return s;
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw) as State;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return initial;
    return migrate(parsed);
  } catch {
    return initial;
  }
}

let state: State = typeof window === 'undefined' ? initial : load();
const listeners = new Set<() => void>();
let storageFull = false;
/** True when the last save did not fit in the browser's storage (shown as a warning in the profile). */
export const isStorageFull = () => storageFull;

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storageFull = false;
  } catch {
    // Storage is full: meal photos are the only heavy part, so drop the oldest ones and try again.
    const withPhoto = state.logs.filter((l) => l.photo);
    for (let drop = Math.ceil(withPhoto.length / 2); drop > 0 && withPhoto.length; drop = withPhoto.length) {
      const ids = new Set(withPhoto.splice(0, drop).map((l) => l.id));
      state = { ...state, logs: state.logs.map((l) => (ids.has(l.id) ? { ...l, photo: undefined } : l)) };
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
        storageFull = false;
        return;
      } catch {
        /* keep dropping */
      }
    }
    storageFull = true; // the app keeps working in memory
  }
}

export function getState(): State {
  return state;
}

export function setState(update: Partial<State> | ((s: State) => Partial<State>)) {
  const patch = typeof update === 'function' ? update(state) : update;
  if (Object.keys(patch).length === 0) return;
  state = { ...state, ...patch };
  persist();
  listeners.forEach((l) => l());
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
    () => selector(initial),
  );
}

export const todayISO = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
export const nowTime = () => new Date().toTimeString().slice(0, 5);
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function saveProfile(p: Profile) {
  const s = getState();
  setState({ profile: p, targets: computeTargets(p, { tdeeOverride: s.tdeeOverride }) });
}

export function recomputeTargets() {
  const s = getState();
  if (s.profile) setState({ targets: computeTargets(s.profile, { tdeeOverride: s.tdeeOverride }) });
}

export function addLog(log: Omit<MealLog, 'id'>) {
  setState((s) => ({ logs: [...s.logs, { ...log, id: uid() }], learning: recordMealTime(s.learning, log.slot, log.time) }));
}

export function learn(fn: (l: LearningState) => LearningState) {
  setState((s) => ({ learning: fn(s.learning) }));
}

/** Merge device samples by date+source (latest import wins). */
export function addDeviceData(samples: DeviceSample[], device: Omit<ConnectedDevice, 'lastSync'>) {
  setState((s) => {
    const key = (d: DeviceSample) => `${d.date}|${d.source}`;
    const map = new Map(s.deviceData.map((d) => [key(d), d]));
    for (const d of samples) map.set(key(d), { ...map.get(key(d)), ...d });
    const devices = [...s.devices.filter((x) => x.id !== device.id), { ...device, lastSync: new Date().toISOString() }];
    return { deviceData: [...map.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-400), devices };
  });
  // weights from a scale or health export also feed the weight trend (one per day, morning value)
  const weights = samples.filter((d) => d.weightKg && d.weightKg > 30 && d.weightKg < 300);
  if (weights.length)
    setState((s) => {
      const have = new Set(s.weighIns.map((w) => w.date));
      const add = weights.filter((w) => !have.has(w.date)).map((w) => ({ date: w.date, kg: Math.round(w.weightKg! * 10) / 10, time: '07:00' }));
      return add.length ? { weighIns: [...s.weighIns, ...add].sort((a, b) => a.date.localeCompare(b.date)) } : {};
    });
}

export function removeLog(id: string) {
  setState((s) => ({ logs: s.logs.filter((l) => l.id !== id) }));
}

export function addWeighIn(kg: number, date = todayISO()) {
  setState((s) => ({ weighIns: [...s.weighIns, { date, kg, time: nowTime() }] }));
  // keep profile weight in sync with the latest weigh-in, then refresh targets
  const p = getState().profile;
  if (p) saveProfile({ ...p, weightKg: kg });
}

export function logSafetyEvent(kind: string, message: string) {
  setState((s) => {
    const date = todayISO();
    if (s.safetyEvents.some((e) => e.date === date && e.kind === kind)) return {};
    return { safetyEvents: [...s.safetyEvents, { date, kind, message }] };
  });
}

export function markHint(id: string) {
  setState((s) => (s.seenHints.includes(id) ? {} : { seenHints: [...s.seenHints, id] }));
}

export function exportData(): string {
  const { settings, ...rest } = getState();
  return JSON.stringify({ ...rest, settings: { ...settings, apiKey: settings.apiKey ? '[הוסר מהייצוא]' : undefined } }, null, 2);
}

/** Restores a backup made with "download my data". Returns an error message, or null on success. */
export function importData(json: string): string | null {
  try {
    const parsed = JSON.parse(json) as Partial<State>;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1 || !parsed.profile || typeof parsed.profile.weightKg !== 'number') return 'הקובץ הזה אינו גיבוי של PRIME.';
    const next = migrate(parsed);
    // the access code is never part of a backup: keep the one on this device
    next.settings = { ...next.settings, apiKey: state.settings.apiKey };
    next.targets = computeTargets(next.profile!, { tdeeOverride: next.tdeeOverride });
    state = next;
    persist();
    listeners.forEach((l) => l());
    return null;
  } catch {
    return 'לא הצלחנו לקרוא את הקובץ.';
  }
}

export function deleteAllData() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('prime.')) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
  state = initial;
  listeners.forEach((l) => l());
}

export function loadDemoData() {
  // Two weeks of sample history so a first-time viewer can see every screen populated.
  const s = getState();
  if (!s.profile) return;
  const weighIns: State['weighIns'] = [];
  const logs: MealLog[] = [];
  const start = s.profile.weightKg + 1.2;
  for (let i = 20; i >= 1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = todayISO(d);
    weighIns.push({ date, kg: Math.round((start - (20 - i) * 0.06 + Math.sin(i * 1.7) * 0.35) * 10) / 10, time: '07:10' });
    const kcal = (s.targets?.kcal.value ?? 2200) + Math.round(Math.sin(i) * 120);
    logs.push({
      id: uid(),
      date,
      time: '13:00',
      slot: 'lunch',
      items: [{ foodId: 'chicken_breast', name: 'סיכום יומי (נתוני הדגמה)', grams: 0 }],
      method: 'search',
      nutrients: { kcal, protein: (s.targets?.proteinG.value ?? 150) * 0.95, fat: 70, carbs: 230, fiber: 25 },
    });
  }
  setState({ weighIns: [...weighIns, ...s.weighIns], logs: [...logs, ...s.logs] });
}
