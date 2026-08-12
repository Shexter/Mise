import type { NutritionBucket } from '@/logic/nutritionRange';

export interface NutritionReportSummary {
  knownAverage: number | null;
  minimum: number | null;
  maximum: number | null;
  knownDays: number;
  loggedDays: number;
  totalDays: number;
  recordedTargets: number[];
  incomplete: boolean;
}

/** Conservative report statistics derived only from defensible known values. */
export function nutritionReportSummary(days: readonly NutritionBucket[]): NutritionReportSummary {
  const known = days.flatMap((day) => day.knownValue === null ? [] : [day.knownValue]);
  const recordedTargets = [...new Set(days.flatMap((day) => day.recordedTarget === null ? [] : [day.recordedTarget]))];
  const loggedDays = days.filter((day) => day.daysWithMeals > 0).length;
  return {
    knownAverage: known.length === 0 ? null : known.reduce((total, value) => total + value, 0) / known.length,
    minimum: known.length === 0 ? null : Math.min(...known),
    maximum: known.length === 0 ? null : Math.max(...known),
    knownDays: known.length,
    loggedDays,
    totalDays: days.length,
    recordedTargets,
    incomplete: days.some((day) => day.daysWithMeals > 0 && day.coverage !== 'complete'),
  };
}
