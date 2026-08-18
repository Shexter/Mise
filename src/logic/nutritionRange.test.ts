import { describe, expect, test } from 'vitest';

import {
  bucketNutritionValues,
  customNutritionPeriod,
  nutritionTrend,
  nutritionPeriodDates,
  presetNutritionPeriod,
} from '@/logic/nutritionRange';
import { dailyNutritionSummary } from '@/logic/dailyNutritionSummary';
import type { DailyTarget, MealWithItems } from '@/types';

describe('nutrition ranges', () => {
  test.each([
    ['7-day', 7, '2026-08-05'],
    ['30-day', 30, '2026-07-13'],
    ['90-day', 90, '2026-05-14'],
  ] as const)('builds inclusive %s periods', (kind, length, expectedStart) => {
    const period = presetNutritionPeriod(kind, '2026-08-11');
    expect(period.startDate).toBe(expectedStart);
    expect(nutritionPeriodDates(period)).toHaveLength(length);
  });

  test('validates custom period order', () => {
    expect(customNutritionPeriod('2026-08-01', '2026-08-11')).toMatchObject({ kind: 'custom' });
    expect(() => customNutritionPeriod('2026-08-12', '2026-08-11')).toThrow(/start/i);
  });

  test('keeps no-meal, wholly unknown, and known zero distinct', () => {
    const period = customNutritionPeriod('2026-08-01', '2026-08-03');
    const buckets = bucketNutritionValues([
      { localDate: '2026-08-02', knownValue: null, coverage: 'unknown', hasMeals: true, recordedTarget: 30 },
      { localDate: '2026-08-03', knownValue: 0, coverage: 'complete', hasMeals: true, recordedTarget: 30 },
    ], period, 'daily');

    expect(buckets.map(({ knownValue, coverage }) => ({ knownValue, coverage }))).toEqual([
      { knownValue: 0, coverage: 'no-meals' },
      { knownValue: null, coverage: 'unknown' },
      { knownValue: 0, coverage: 'complete' },
    ]);
  });

  test('groups Monday-first weeks and discloses changed recorded targets', () => {
    const period = customNutritionPeriod('2026-08-03', '2026-08-11');
    const buckets = bucketNutritionValues([
      { localDate: '2026-08-03', knownValue: 20, coverage: 'complete', hasMeals: true, recordedTarget: 30 },
      { localDate: '2026-08-04', knownValue: 10, coverage: 'partial', hasMeals: true, recordedTarget: 35 },
      { localDate: '2026-08-10', knownValue: 15, coverage: 'complete', hasMeals: true, recordedTarget: 35 },
    ], period, 'weekly');

    expect(buckets).toHaveLength(2);
    expect(buckets[0]).toMatchObject({
      startDate: '2026-08-03', endDate: '2026-08-09', knownValue: 30,
      coverage: 'partial', recordedTarget: null, targetChanged: true,
    });
    expect(buckets[1]).toMatchObject({
      startDate: '2026-08-10', endDate: '2026-08-11', knownValue: 15,
      coverage: 'complete', recordedTarget: 35, targetChanged: false,
    });
  });

  test('ranged output exactly reuses single-day coverage for mixed days', () => {
    const period = customNutritionPeriod('2026-08-01', '2026-08-03');
    const meals: MealWithItems[] = [
      meal('complete', '2026-08-02', [20]),
      meal('partial', '2026-08-03', [10, null]),
    ];
    const targets: DailyTarget[] = [target('2026-08-02'), target('2026-08-03')];
    const trend = nutritionTrend(period, 'protein', meals, targets);

    for (const point of trend) {
      const dayMeals = meals.filter((candidate) => candidate.localDate === point.localDate);
      const dayTarget = targets.find((candidate) => candidate.localDate === point.localDate) ?? null;
      const expected = dailyNutritionSummary(point.localDate, dayMeals, dayTarget);
      expect(point).toMatchObject({
        knownValue: expected.metrics.protein.knownValue,
        coverage: expected.metrics.protein.coverage,
        hasMeals: expected.hasMeals,
        recordedTarget: expected.metrics.protein.target,
      });
    }
    expect(trend.map((point) => point.coverage)).toEqual(['no-meals', 'complete', 'partial']);
  });
});

function meal(id: string, localDate: string, proteinValues: Array<number | null>): MealWithItems {
  return {
    id,
    loggedAt: `${localDate}T12:00:00.000Z`,
    localDate,
    mealType: 'lunch',
    name: id,
    photoUri: null,
    source: 'manual',
    confidence: null,
    venue: 'out',
    servingsMult: 1,
    createdAt: `${localDate}T12:00:00.000Z`,
    items: proteinValues.map((proteinG, index) => ({
      id: `${id}-${index}`,
      mealId: id,
      name: `Item ${index}`,
      quantity: 1,
      unit: 'serving',
      calories: proteinG === null ? null : proteinG * 4,
      proteinG,
      carbsG: 0,
      fatG: 0,
      fibreG: 0,
      isManualAddition: true,
      sortOrder: index,
      canonicalId: null,
    })),
  };
}

function target(localDate: string): DailyTarget {
  return {
    localDate,
    targetCalories: 2_000,
    proteinG: 150,
    carbsG: 200,
    fatG: 67,
    fibreG: 30,
  };
}
