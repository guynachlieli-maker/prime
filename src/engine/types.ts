export type Sex = 'male' | 'female';
export type Goal = 'fat_loss' | 'muscle_gain' | 'recomp' | 'performance' | 'health';
export type Pace = 'gentle' | 'balanced' | 'fast';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'extra';
export type BodyFatSource = 'unknown' | 'estimate' | 'navy' | 'bia' | 'dexa';
export type DietStyle = 'omnivore' | 'vegetarian' | 'vegan';
export type Allergen = 'gluten' | 'dairy' | 'egg' | 'nuts' | 'peanuts' | 'sesame' | 'fish' | 'soy';

export interface Screening {
  // PAR-Q+ general health questions (any "yes" => doctor clearance before training plans)
  parqHeart: boolean;
  parqChestPain: boolean;
  parqDizziness: boolean;
  parqBloodPressureMeds: boolean;
  parqJointProblem: boolean;
  // Medical nutrition screen
  pregnantOrBreastfeeding: boolean;
  diabetesInsulin: boolean;
  kidneyDisease: boolean;
  thyroid: boolean;
  ibd: boolean;
  glp1: boolean;
  // SCOFF (5 yes/no)
  scoffSick: boolean;
  scoffControl: boolean;
  scoffLost6kg: boolean;
  scoffBelieveFat: boolean;
  scoffFoodDominates: boolean;
}

export const EMPTY_SCREENING: Screening = {
  parqHeart: false,
  parqChestPain: false,
  parqDizziness: false,
  parqBloodPressureMeds: false,
  parqJointProblem: false,
  pregnantOrBreastfeeding: false,
  diabetesInsulin: false,
  kidneyDisease: false,
  thyroid: false,
  ibd: false,
  glp1: false,
  scoffSick: false,
  scoffControl: false,
  scoffLost6kg: false,
  scoffBelieveFat: false,
  scoffFoodDominates: false,
};

export interface Profile {
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct?: number;
  bodyFatSource: BodyFatSource;
  activity: ActivityLevel;
  trainingDaysPerWeek: number;
  strengthTraining: boolean;
  sleepHours: number;
  goal: Goal;
  pace: Pace;
  /** Optional target weight (kg). When set, the engine derives the weekly pace from it. */
  targetWeightKg?: number;
  /** Optional ISO date (YYYY-MM-DD) to reach the target weight by. */
  targetDate?: string;
  diet: DietStyle;
  kosher: boolean;
  allergies: Allergen[];
  dislikes: string[];
  mealsPerDay: number;
  maxPrepMinutes: number;
  screening: Screening;
}

export interface Explained<T> {
  value: T;
  why: string;
  sources: string[];
}

export interface Targets {
  bmr: Explained<number>;
  tdee: Explained<number>;
  kcal: Explained<number>;
  proteinG: Explained<number>;
  fatG: Explained<number>;
  carbsG: Explained<number>;
  fiberG: Explained<number>;
  waterMl: Explained<number>;
  weeklyChangeKg: Explained<number>;
  floorApplied: boolean;
  /** Target-weight plan, when the user gave a target weight. */
  goalPlan?: { targetKg: number; targetDate?: string; etaISO: string | null; weeks: number | null; feasible: boolean | null; insight: string } | null;
  createdAt: string;
}

export interface Nutrients {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
}
