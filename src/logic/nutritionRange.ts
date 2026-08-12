import { addDays, differenceInCalendarDays, startOfWeek } from 'date-fns';

import { localDateString, parseLocalDate } from '@/logic/dates';
import type { DailyNutritionMetric, NutritionCoverage } from '@/logic/dailyNutritionSummary';

export type NutritionPresetRange = '7-day' | '30-day' | '90-day';
export type NutritionRange = NutritionPresetRange | 'custom';
export type NutritionAggregation = 'daily' | 'weekly';
export type NutritionChartForm = 'bar' | 'line';

export interface NutritionPeriod {
  kind: NutritionRange;
  startDate: string;
  endDate: string;
}

export interface NutritionDayValue {
  localDate: string;
  knownValue: number | null;
  coverage: NutritionCoverage;
  hasMeals: boolean;
  recordedTarget: number | null;
}

export interface NutritionBucket {
  startDate: string;
  endDate: string;
  /** Sum of defensible known contributions; null when none are known. */
  knownValue: number | null;
  coverage: NutritionCoverage;
  daysWithMeals: number;
  totalDays: number;
  /** Null when absent or when targets changed within the bucket. */
  recordedTarget: number | null;
  targetChanged: boolean;
}

export interface NutritionRangeConfiguration {
  metric: DailyNutritionMetric;
  period: NutritionPeriod;
  aggregation: NutritionAggregation;
  chartForm: NutritionChartForm;
}

export function presetNutritionPeriod(
  kind: NutritionPresetRange,
  endDate: string,
): NutritionPeriod {
  const days = kind === '7-day' ? 7 : kind === '30-day' ? 30 : 90;
  return {
    kind,
    startDate: localDateString(addDays(parseLocalDate(endDate), -(days - 1))),
    endDate,
  };
}

export function customNutritionPeriod(startDate: string, endDate: string): NutritionPeriod {
  if (startDate > endDate) throw new Error('Nutrition period start must not be after its end.');
  return { kind: 'custom', startDate, endDate };
}

export function nutritionPeriodDates(period: NutritionPeriod): string[] {
  const count = differenceInCalendarDays(parseLocalDate(period.endDate), parseLocalDate(period.startDate)) + 1;
  if (count < 1) return [];
  return Array.from({ length: count }, (_, index) =>
    localDateString(addDays(parseLocalDate(period.startDate), index)),
  );
}

/** Groups pure day records without interpreting missing nutrition as zero. */
export function bucketNutritionValues(
  values: readonly NutritionDayValue[],
  period: NutritionPeriod,
  aggregation: NutritionAggregation,
): NutritionBucket[] {
  const byDate = new Map(values.map((value) => [value.localDate, value]));
  const dates = nutritionPeriodDates(period);
  const groups = new Map<string, string[]>();

  for (const date of dates) {
    const key = aggregation === 'daily'
      ? date
      : localDateString(startOfWeek(parseLocalDate(date), { weekStartsOn: 1 }));
    groups.set(key, [...(groups.get(key) ?? []), date]);
  }

  return [...groups.values()].map((groupDates) => {
    const records = groupDates.map((date) => byDate.get(date) ?? {
      localDate: date,
      knownValue: null,
      coverage: 'no-meals' as const,
      hasMeals: false,
      recordedTarget: null,
    });
    const known = records.flatMap((record) => record.knownValue === null ? [] : [record.knownValue]);
    const daysWithMeals = records.filter((record) => record.hasMeals).length;
    const coverage = bucketCoverage(records, daysWithMeals);
    const targets = [...new Set(records.flatMap((record) => record.recordedTarget === null ? [] : [record.recordedTarget]))];

    return {
      startDate: groupDates[0]!,
      endDate: groupDates[groupDates.length - 1]!,
      knownValue: known.length === 0 ? null : known.reduce((total, value) => total + value, 0),
      coverage,
      daysWithMeals,
      totalDays: groupDates.length,
      recordedTarget: targets.length === 1 ? targets[0]! : null,
      targetChanged: targets.length > 1,
    };
  });
}

function bucketCoverage(
  records: readonly NutritionDayValue[],
  daysWithMeals: number,
): NutritionCoverage {
  if (daysWithMeals === 0) return 'no-meals';
  const logged = records.filter((record) => record.hasMeals);
  if (logged.every((record) => record.coverage === 'unknown')) return 'unknown';
  if (logged.every((record) => record.coverage === 'complete')) return 'complete';
  return 'partial';
}
