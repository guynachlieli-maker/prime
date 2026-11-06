import type { ReminderKind } from '../engine/reminders';

/**
 * Feature modules. PRIME ships the nutrition module; the training module is defined here so it can
 * be switched on and off without changing the store shape. Training lives in src/training.
 *
 * To launch training:
 *  1. Fill src/modules/training (plans data + screens) using the types in ./training/types.ts.
 *  2. Set `available: true` below and add its tab in App.tsx (TABS) behind `state.modules.training`.
 *  3. Training sessions add reminders with kind 'training' and module 'training'.
 *  4. Optional: `kcalAdjustForDay` lets training days carry more carbohydrate (targets stay inside
 *     the safety rails; the engine applies the adjustment after the floors).
 */
export interface AppModule {
  id: 'nutrition' | 'training';
  title: string;
  available: boolean;
  reminderKinds: ReminderKind[];
}

export const MODULES: AppModule[] = [
  { id: 'nutrition', title: 'תזונה', available: true, reminderKinds: ['meal', 'weigh', 'water', 'motivation', 'custom'] },
  { id: 'training', title: 'אימונים', available: true, reminderKinds: ['training'] },
];

export const isAvailable = (id: AppModule['id']) => MODULES.find((m) => m.id === id)?.available ?? false;
