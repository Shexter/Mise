import {
  MIN_TARGET_CALORIES,
  activityMultiplier,
  goalAdjustment,
  rateGoalAdjustment,
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

/** Katch-McArdle resting energy from measured fat-free mass. */
export function katchMcArdle(fatFreeMassKg: number): number {
  return 370 + 21.6 * fatFreeMassKg;
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

/** An optional goal weight and pace; both must be set to take effect. */
export interface GoalPacing {
  targetWeightKg: number | null;
  weightGoalRateKgPerWeek: number | null;
}

/**
 * The single place "the adjustment" is decided, used by every caller that
 * used to call `goalAdjustment(goal)` directly for a real profile —
 * `energyTargets()` below and, per `bodyComposition.ts`'s `measuredTarget()`
 * and its `stated` resolver, the DEXA/InBody/stated calorie sources too.
 * One function so a target weight and rate take effect regardless of which
 * source computes the base `maintenance`/resting figure.
 */
export function goalCalorieAdjustment(
  weightKg: number,
  goal: Goal,
  pacing?: GoalPacing,
): number {
  if (pacing?.targetWeightKg != null && pacing?.weightGoalRateKgPerWeek != null) {
    return rateGoalAdjustment(
      weightKg,
      pacing.targetWeightKg,
      pacing.weightGoalRateKgPerWeek,
    );
  }
  return goalAdjustment(goal);
}

export function energyTargets(
  input: BmrInput,
  activityLevel: ActivityLevel,
  goal: Goal,
  pacing?: GoalPacing,
): EnergyTargets {
  const maintenance = Math.round(
    totalDailyEnergyExpenditure(input, activityLevel),
  );
  const target = Math.max(
    MIN_TARGET_CALORIES,
    Math.round(maintenance + goalCalorieAdjustment(input.weightKg, goal, pacing)),
  );
  return { maintenance, target };
}
