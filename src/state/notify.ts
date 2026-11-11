import { getState, setState, todayISO, type State } from './store';
import { eatenOn } from './derived';
import { weightTrend } from '../engine/adaptive';
import { SUPP_BY_ID } from '../data/supplements';
import { defaultReminders, motivation, upcoming, type Reminder } from '../engine/reminders';

/**
 * Delivers reminders. While PRIME is open (or running in the background on Android), a timer fires
 * a system notification through the service worker. Where the browser supports scheduled
 * notifications (Notification Triggers), the next 24 hours are also scheduled so they arrive with
 * the app closed. A calendar export (.ics) covers every phone, including iPhone.
 */
export type NotifyStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export function notifyStatus(): NotifyStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotifyStatus;
}

export async function askNotifyPermission(): Promise<NotifyStatus> {
  if (notifyStatus() === 'unsupported') return 'unsupported';
  try {
    const r = await Notification.requestPermission();
    setState((x) => ({ settings: { ...x.settings, notifyAsked: true } }));
    scheduleAhead();
    return r as NotifyStatus;
  } catch {
    return 'denied';
  }
}

export function remindersOf(s: State): Reminder[] {
  const list = s.reminders ?? defaultReminders(s.profile?.mealsPerDay ?? 4, s.learning);
  const plan = s.training?.plan;
  const withTraining =
    plan && !list.some((r) => r.kind === 'training')
      ? [...list, { id: 'training', kind: 'training' as const, title: 'הגיע הזמן לאימון', body: 'התוכנית של היום מחכה לך באפליקציה.', time: plan.prefs.time, days: plan.days.map((d) => d.weekday), enabled: true, module: 'training' as const }]
      : list;
  return withSupps(s, withTraining);
}

function withSupps(s: State, list: Reminder[]): Reminder[] {
  const supps = s.profile?.supplements ?? [];
  if (!supps.length || list.some((r) => r.id.startsWith('supp-'))) return list;
  // one reminder per time of day for the supplements the user takes
  const byTime = new Map<string, string[]>();
  for (const id of supps) {
    const sp = SUPP_BY_ID[id];
    if (sp) byTime.set(sp.time, [...(byTime.get(sp.time) ?? []), sp.name]);
  }
  const extra: Reminder[] = [...byTime.entries()].map(([time, names]) => ({ id: `supp-${time}`, kind: 'custom', title: `תוספים: ${names.join(', ')}`, body: 'סמנו במסך הבית אחרי שלקחתם.', time, days: [0, 1, 2, 3, 4, 5, 6], enabled: true, module: 'nutrition' }));
  return [...list, ...extra];
}

export function setReminders(list: Reminder[]) {
  setState({ reminders: list });
  scheduleAhead();
}

export function motivationNow(s: State = getState()): { title: string; body: string } {
  const t = s.targets;
  const today = todayISO();
  const eaten = eatenOn(s, today);
  const trend = weightTrend(s.weighIns);
  const change = trend.length >= 2 ? trend[trend.length - 1].trend - trend[0].trend : null;
  const since = todayISO(new Date(Date.now() - 7 * 864e5));
  const plan = t?.goalPlan;
  const cur = trend.length ? trend[trend.length - 1].trend : s.profile?.weightKg ?? 0;
  const kgToGoal = plan ? Math.abs(cur - plan.targetKg) : null;
  return motivation({
    name: s.profile?.name?.trim() || undefined,
    kcalToday: eaten.kcal,
    kcalTarget: t?.kcal.value ?? 0,
    proteinToday: eaten.protein,
    proteinTarget: t?.proteinG.value ?? 0,
    loggedDaysLast7: new Set(s.logs.filter((l) => l.date >= since && l.method !== 'supplement').map((l) => l.date)).size,
    trendChangeKg: change,
    goalLosing: (t?.weeklyChangeKg.value ?? -1) < 0,
    kgToGoal,
    weeksToGoal: kgToGoal !== null && t && Math.abs(t.weeklyChangeKg.value) > 0.01 ? Math.ceil(kgToGoal / Math.abs(t.weeklyChangeKg.value)) : null,
    loggedToday: s.logs.some((l) => l.date === today && l.method !== 'supplement'),
  });
}

function content(r: Reminder): { title: string; body: string } {
  if (r.kind === 'motivation') return motivationNow();
  return { title: r.title, body: r.body ?? '' };
}

type Toast = { title: string; body: string; id: string };
const toastListeners = new Set<(t: Toast) => void>();
export function onToast(fn: (t: Toast) => void) {
  toastListeners.add(fn);
  return () => toastListeners.delete(fn);
}

async function show(r: Reminder) {
  const c = content(r);
  // in the app: an in-app card is enough (and works everywhere)
  if (document.visibilityState === 'visible') {
    toastListeners.forEach((f) => f({ ...c, id: r.id }));
    return;
  }
  if (notifyStatus() !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(c.title, { body: c.body, tag: r.id, icon: './icon-192.png', badge: './icon-192.png', lang: 'he', dir: 'rtl' });
    else new Notification(c.title, { body: c.body, tag: r.id, lang: 'he', dir: 'rtl' });
  } catch {
    /* blocked here */
  }
}

/** Uses Notification Triggers where available, so reminders arrive with the app closed. */
async function scheduleAhead() {
  try {
    const s = getState();
    if (!s.settings.reminders || notifyStatus() !== 'granted') return;
    const TT = (window as unknown as { TimestampTrigger?: new (t: number) => unknown }).TimestampTrigger;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (!TT || !reg) return;
    const old = await reg.getNotifications({ includeTriggered: false } as GetNotificationOptions);
    old.forEach((n) => n.tag.startsWith('sched-') && n.close());
    for (const { at, r } of upcoming(remindersOf(s), new Date(), 864e5)) {
      const c = content(r);
      await reg.showNotification(c.title, { body: c.body, tag: `sched-${r.id}-${at.getTime()}`, showTrigger: new TT(at.getTime()), icon: './icon-192.png', lang: 'he', dir: 'rtl' } as NotificationOptions);
    }
  } catch {
    /* not supported */
  }
}

const LAST = 'prime.lastReminderCheck';

/** Starts the in-app timer. Returns a stop function. */
export function startReminders(): () => void {
  let last = Number(localStorage.getItem(LAST) ?? Date.now());
  const check = () => {
    const s = getState();
    const now = Date.now();
    if (s.settings.reminders && s.onboardingDone) {
      const due = upcoming(remindersOf(s), new Date(last), now - last).filter((x) => now - x.at.getTime() < 20 * 60e3);
      // don't flood after a long gap: one per reminder, newest only
      const seen = new Set<string>();
      for (const d of due.reverse()) {
        if (seen.has(d.r.id)) continue;
        seen.add(d.r.id);
        if (d.r.kind === 'meal' && d.r.slot && s.logs.some((l) => l.date === todayISO() && l.slot === d.r.slot && l.method !== 'supplement')) continue; // already logged
        if (d.r.kind === 'weigh' && s.weighIns.some((w) => w.date === todayISO())) continue;
        void show(d.r);
      }
    }
    last = now;
    try {
      localStorage.setItem(LAST, String(now));
    } catch {
      /* ignore */
    }
  };
  check();
  scheduleAhead();
  const id = window.setInterval(check, 30e3);
  const onVis = () => document.visibilityState === 'visible' && check();
  document.addEventListener('visibilitychange', onVis);
  return () => {
    window.clearInterval(id);
    document.removeEventListener('visibilitychange', onVis);
  };
}

export function downloadCalendar(list: Reminder[]) {
  import('../engine/reminders').then(({ toICS }) => {
    const blob = new Blob([toICS(list)], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'prime-reminders.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
}
