import type { ActivityLevel, Goal } from '@/types';

export interface ActivityOption {
  value: ActivityLevel;
  label: string;
  detail: string;
  multiplier: number;
}

export const ACTIVITY_LEVELS: readonly ActivityOption[] = [
  {
    value: 'sedentary',
    label: 'Sedentary',
    detail: 'Desk job, little exercise',
    multiplier: 1.2,
  },
  {
    value: 'light',
    label: 'Light',
    detail: '1–3 days a week',
    multiplier: 1.375,
  },
  {
    value: 'moderate',
    label: 'Moderate',
    detail: '3–5 days a week',
    multiplier: 1.55,
  },
  {
    value: 'active',
    label: 'Active',
    detail: '6–7 days a week',
    multiplier: 1.725,
  },
  {
    value: 'very_active',
    label: 'Very active',
    detail: 'Physical job, or twice a day',
    multiplier: 1.9,
  },
];

export function activityMultiplier(level: ActivityLevel): number {
  const option = ACTIVITY_LEVELS.find((o) => o.value === level);
  return option?.multiplier ?? 1.2;
}

export function activityLabel(level: ActivityLevel): string {
  return ACTIVITY_LEVELS.find((o) => o.value === level)?.label ?? level;
}

export interface GoalOption {
  value: Goal;
  label: string;
  detail: string;
  /** kcal added to TDEE. */
  adjustment: number;
}

export const GOALS: readonly GoalOption[] = [
  { value: 'lose', label: 'Lose', detail: '500 under maintenance', adjustment: -500 },
  { value: 'maintain', label: 'Maintain', detail: 'Hold steady', adjustment: 0 },
  { value: 'gain', label: 'Gain', detail: '300 over maintenance', adjustment: 300 },
];

export function goalAdjustment(goal: Goal): number {
  return GOALS.find((g) => g.value === goal)?.adjustment ?? 0;
}

export function goalLabel(goal: Goal): string {
  return GOALS.find((g) => g.value === goal)?.label ?? goal;
}

/** Targets never drop below this, whatever the inputs say. */
export const MIN_TARGET_CALORIES = 1200;

/**
 * Rough approximation: ~7700 kcal of cumulative energy imbalance per kg of
 * body-mass change. Actual energy density of gained or lost mass varies by
 * body composition — this is the same widely used estimate every app in
 * this space relies on, not a precise metabolic model.
 */
export const KCAL_PER_KG = 7700;

/** Bounds for the weekly-pace input control — not an open text field. */
export const WEIGHT_GOAL_RATE_RANGE = { min: 0.1, max: 1 } as const;

/**
 * Converts a weekly pace into a daily calorie adjustment. `rateKgPerWeek`
 * is a non-negative pace (its magnitude is used regardless of sign);
 * direction comes from comparing the target to the current weight, not
 * from the sign of the rate itself — a target below current weight yields
 * a deficit, above yields a surplus, equal yields zero.
 */
export function rateGoalAdjustment(
  currentWeightKg: number,
  targetWeightKg: number,
  rateKgPerWeek: number,
): number {
  const direction = Math.sign(targetWeightKg - currentWeightKg);
  return (direction * Math.abs(rateKgPerWeek) * KCAL_PER_KG) / 7;
}

export const AGE_RANGE = { min: 13, max: 100 } as const;
