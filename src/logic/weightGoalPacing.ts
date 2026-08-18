import { format } from 'date-fns';

import { goalLabel } from '@/constants/activityLevels';
import type { Goal } from '@/types';

export interface WeightGoalForecast {
  /** Always non-negative. */
  weeksToGoal: number;
  forecastDate: Date;
}

/**
 * Pure, direction-agnostic forecast — weeks-to-goal derives from the
 * magnitude of the gap between current and target weight and the pace,
 * never from matching signs, matching `rateGoalAdjustment`'s reasoning in
 * `src/constants/activityLevels.ts`. Never persisted; call again at
 * display time whenever the inputs might have moved.
 *
 * Returns `null` when there is no defensible forecast — a non-positive
 * rate — rather than a negative or infinite week count.
 */
export function weightGoalForecast(
  currentWeightKg: number,
  targetWeightKg: number,
  rateKgPerWeek: number,
  now: Date,
): WeightGoalForecast | null {
  if (!(rateKgPerWeek > 0)) return null;
  const deltaKg = Math.abs(targetWeightKg - currentWeightKg);
  const weeksToGoal = deltaKg / rateKgPerWeek;
  const forecastDate = new Date(now.getTime() + weeksToGoal * 7 * 24 * 60 * 60 * 1000);
  return { weeksToGoal, forecastDate };
}

/**
 * The row-summary text shown wherever a goal is displayed (Settings, and
 * mirrored in the onboarding forecast caption): the base goal label, plus a
 * live forecast estimate whenever a target weight and rate are both set.
 * Pure and directly testable — this codebase has no component-render test
 * infrastructure anywhere, so the behavior a UI test would otherwise cover
 * (target+rate shows a forecast; clearing either reverts to the plain
 * label) is verified here instead, at the same layer every other
 * UI-adjacent function in this repo is tested at.
 */
export function goalSummaryLabel(
  goal: Goal,
  weightKg: number,
  targetWeightKg: number | null,
  weightGoalRateKgPerWeek: number | null,
  now: Date,
): string {
  const base = goalLabel(goal);
  if (targetWeightKg === null || weightGoalRateKgPerWeek === null) return base;
  const forecast = weightGoalForecast(weightKg, targetWeightKg, weightGoalRateKgPerWeek, now);
  if (!forecast) return base;
  if (forecast.weeksToGoal === 0) return `${base} · already there`;
  return `${base} · est. ${format(forecast.forecastDate, 'd MMM yyyy')}`;
}
