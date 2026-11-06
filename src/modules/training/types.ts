/**
 * Data model for the future training module. Nothing renders this yet; the types fix the storage
 * shape (state.training) so plans and logs can be added without a migration.
 */
export type Muscle = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core' | 'full';
export type Equipment = 'none' | 'dumbbells' | 'barbell' | 'machines' | 'bands' | 'kettlebell';

export interface Exercise {
  id: string;
  name: string; // Hebrew
  muscles: Muscle[];
  equipment: Equipment[];
  cues: string[];
  videoUrl?: string;
}

export interface PlannedSet {
  exerciseId: string;
  sets: number;
  reps: [number, number]; // range
  rir?: number; // reps in reserve
  restSec: number;
}

export interface WorkoutDay {
  id: string;
  title: string;
  weekday?: number; // 0-6, optional fixed day
  blocks: PlannedSet[];
  estMinutes: number;
}

export interface TrainingPlan {
  id: string;
  title: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  daysPerWeek: number;
  weeks: number;
  days: WorkoutDay[];
  /** Extra carbohydrate grams on training days (nutrition integration). */
  trainingDayCarbsG?: number;
}

export interface LoggedSet {
  exerciseId: string;
  reps: number;
  kg: number;
  rir?: number;
}

export interface WorkoutSession {
  id: string;
  date: string; // YYYY-MM-DD
  planId?: string;
  dayId?: string;
  sets: LoggedSet[];
  minutes?: number;
  rpe?: number; // 1-10 session effort
}

export interface TrainingState {
  activePlanId?: string;
  plans: TrainingPlan[];
  sessions: WorkoutSession[];
}

export const EMPTY_TRAINING: TrainingState = { plans: [], sessions: [] };
