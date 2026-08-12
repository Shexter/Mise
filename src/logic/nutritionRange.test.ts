import { describe, expect, test } from 'vitest';

import {
  bucketNutritionValues,
  customNutritionPeriod,
  nutritionPeriodDates,
  presetNutritionPeriod,
} from '@/logic/nutritionRange';

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
      { knownValue: null, coverage: 'no-meals' },
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
});
