import { getState, recomputeTargets, saveProfile, setState, todayISO, uid, type State } from '../state/store';
import type { Goal } from '../engine/types';
import { generatePlan, phasePlan, type Phase, type SessionLog, type TrainingGoal, type TrainingPlan, type TrainingPrefs } from './plan';

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

/** One goal for the whole app: the nutrition goal and the training goal are two views of it. */
export function toTrainingGoal(goal: Goal, focus: 'strength' | 'endurance' = 'strength'): TrainingGoal {
  return goal === 'fat_loss' ? 'cut' : goal === 'muscle_gain' ? 'muscle' : goal === 'bulk' ? 'bulk' : goal === 'recomp' ? 'recomp' : goal === 'performance' ? focus : 'health';
}

export function createPlan(prefs: TrainingPrefs) {
  const s = getState();
  const p = s.profile;
  const fresh = generatePlan(prefs);
  const old = s.training?.plan;
  // editing details (time, equipment, days) keeps the place in the program; a new goal or level starts it over
  const sameProgram = !!old && old.prefs.goal === prefs.goal && old.prefs.level === prefs.level;
  const plan = sameProgram ? { ...fresh, createdAt: old.createdAt } : fresh;
  const phases = p ? phasePlan({ goal: prefs.goal, sex: p.sex, bodyFatPct: p.bodyFatPct ?? 25, level: prefs.level }) : undefined;
  // the nutrition goal follows the current phase of the long-term plan (e.g. a cut before a bulk)
  const nutritionGoal: Goal | undefined = prefs.goal === 'health' || !phases ? undefined : phases[0].nutritionGoal;
  if (p && nutritionGoal && nutritionGoal !== p.goal) saveProfile({ ...p, goal: nutritionGoal });
  setState((x) => ({
    training: { ...(x.training ?? EMPTY_TRAINING), plan, phases, phaseStart: sameProgram && x.training?.phaseStart ? x.training.phaseStart : todayISO(), swaps: {} },
    modules: { ...x.modules, training: true },
    reminders: x.reminders?.filter((r) => r.kind !== 'training'),
    // training days take the place of the profile's training settings
    profile: x.profile ? { ...x.profile, trainingDaysPerWeek: prefs.days, strengthTraining: true } : x.profile,
  }));
  recomputeTargets();
}

const SESSION_DRAFT = 'prime.session';

/** A workout in progress. Kept on the device so leaving the screen (or closing the app) never loses it. */
export interface SessionDraft {
  date: string;
  planId: string;
  dayId: string;
  started: number;
  list: import('./plan').PlannedExercise[];
  logs: import('./plan').ExerciseLog[];
  cardioDone: boolean;
}

export function loadSessionDraft(planId?: string): SessionDraft | null {
  try {
    const d = JSON.parse(localStorage.getItem(SESSION_DRAFT) ?? 'null') as SessionDraft | null;
    // only today's workout of the current plan can be resumed
    return d && d.date === todayISO() && (!planId || d.planId === planId) && Array.isArray(d.logs) && Array.isArray(d.list) ? d : null;
  } catch {
    return null;
  }
}

export function saveSessionDraft(d: SessionDraft | null) {
  try {
    if (d) localStorage.setItem(SESSION_DRAFT, JSON.stringify(d));
    else localStorage.removeItem(SESSION_DRAFT);
  } catch {
    /* ignore */
  }
}

/** Remembers that the user prefers another exercise in place of a planned one. */
export function rememberSwap(from: string, to: string) {
  setState((x) => {
    const t = x.training ?? EMPTY_TRAINING;
    const swaps = { ...(t.swaps ?? {}) };
    if (from === to) delete swaps[from];
    else swaps[from] = to;
    return { training: { ...t, swaps } };
  });
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

/**
 * The long-term plan moved to a phase whose nutrition goal differs from the profile's goal
 * (e.g. the bulk ended and the short cut began). The user confirms the change; nothing moves silently.
 */
export function phaseMismatch(s: State, now = new Date()): { phase: Phase; goal: Goal } | null {
  const t = s.training;
  if (!t?.plan || !s.profile || t.plan.prefs.goal === 'health') return null;
  const ph = currentPhase(t, now);
  if (!ph || ph.phase.nutritionGoal === s.profile.goal) return null;
  // while a target weight is still being worked on, the cut or the gain simply continues
  if (s.targets?.goalPlan && ph.index > 0) return null;
  return { phase: ph.phase, goal: ph.phase.nutritionGoal };
}
