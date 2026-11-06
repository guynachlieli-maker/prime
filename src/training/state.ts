import { getState, setState, todayISO, uid } from '../state/store';
import { generatePlan, phasePlan, type Phase, type SessionLog, type TrainingPlan, type TrainingPrefs } from './plan';

export interface TrainingState {
  plan?: TrainingPlan;
  sessions: SessionLog[];
  phases?: Phase[];
  phaseStart?: string; // ISO date
  /** exercise id -> replacement chosen by the user */
  swaps?: Record<string, string>;
}

export const EMPTY_TRAINING: TrainingState = { sessions: [] };

export function training(): TrainingState {
  return getState().training ?? EMPTY_TRAINING;
}

export function createPlan(prefs: TrainingPrefs) {
  const s = getState();
  const p = s.profile;
  const plan = generatePlan(prefs);
  const phases = p ? phasePlan({ goal: prefs.goal, sex: p.sex, bodyFatPct: p.bodyFatPct ?? 25, level: prefs.level }) : undefined;
  setState((x) => ({
    training: { ...(x.training ?? EMPTY_TRAINING), plan, phases, phaseStart: todayISO(), swaps: {} },
    modules: { ...x.modules, training: true },
    reminders: x.reminders?.filter((r) => r.kind !== 'training'),
    // training days take the place of the profile's training settings
    profile: x.profile ? { ...x.profile, trainingDaysPerWeek: prefs.days, strengthTraining: true } : x.profile,
  }));
}

export function saveSession(log: Omit<SessionLog, 'id'>) {
  setState((x) => {
    const t = x.training ?? EMPTY_TRAINING;
    return { training: { ...t, sessions: [...t.sessions, { ...log, id: uid() }] } };
  });
}

/** Current phase from the macrocycle and how many weeks are left in it. */
export function currentPhase(t: TrainingState, now = new Date()): { phase: Phase; index: number; weekIn: number } | null {
  if (!t.phases?.length || !t.phaseStart) return null;
  let weeks = Math.floor((now.getTime() - Date.parse(t.phaseStart + 'T00:00:00')) / (7 * 864e5));
  for (let i = 0; i < t.phases.length; i++) {
    if (weeks < t.phases[i].weeks) return { phase: t.phases[i], index: i, weekIn: weeks + 1 };
    weeks -= t.phases[i].weeks;
  }
  const last = t.phases.length - 1;
  return { phase: t.phases[last], index: last, weekIn: t.phases[last].weeks };
}
