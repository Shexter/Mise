import {
  MIN_TARGET_CALORIES,
  activityMultiplier,
  goalAdjustment,
} from '@/constants/activityLevels';
import type { ActivityLevel, Goal, Sex } from '@/types';

export interface BmrInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
}

/**
 * Mifflin-St Jeor basal metabolic rate.
 *
 *   male:   10·kg + 6.25·cm − 5·age + 5
 *   female: 10·kg + 6.25·cm − 5·age − 161
 */
export function basalMetabolicRate({
  sex,
  age,
  heightCm,
  weightKg,
}: BmrInput): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/** Total daily energy expenditure — BMR scaled by the activity multiplier. */
export function totalDailyEnergyExpenditure(
  input: BmrInput,
  activityLevel: ActivityLevel,
): number {
  return basalMetabolicRate(input) * activityMultiplier(activityLevel);
}

export interface EnergyTargets {
  /** Maintenance calories, rounded. */
  maintenance: number;
  /** Maintenance plus the goal adjustment, floored at 1200. */
  target: number;
}

export function energyTargets(
  input: BmrInput,
  activityLevel: ActivityLevel,
  goal: Goal,
): EnergyTargets {
  const maintenance = Math.round(
    totalDailyEnergyExpenditure(input, activityLevel),
  );
  const target = Math.max(
    MIN_TARGET_CALORIES,
    Math.round(maintenance + goalAdjustment(goal)),
  );
  return { maintenance, target };
}
