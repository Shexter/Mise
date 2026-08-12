import { describe, expect, test } from 'vitest';

import { nutritionReportSummary } from '@/logic/nutritionReport';
import type { NutritionBucket } from '@/logic/nutritionRange';

function day(overrides: Partial<NutritionBucket>): NutritionBucket {
  return {
    startDate: '2026-08-01', endDate: '2026-08-01', knownValue: null,
    coverage: 'no-meals', daysWithMeals: 0, totalDays: 1,
    recordedTarget: null, targetChanged: false, ...overrides,
  };
}

describe('nutritionReportSummary', () => {
  test('derives average and range only from defensible known values', () => {
    const summary = nutritionReportSummary([
      day({ knownValue: 10, coverage: 'complete', daysWithMeals: 1, recordedTarget: 30 }),
      day({ knownValue: null, coverage: 'unknown', daysWithMeals: 1, recordedTarget: 30 }),
      day({ knownValue: 20, coverage: 'partial', daysWithMeals: 1, recordedTarget: 35 }),
      day({}),
    ]);
    expect(summary).toEqual({
      knownAverage: 15, minimum: 10, maximum: 20,
      knownDays: 2, loggedDays: 3, totalDays: 4,
      recordedTargets: [30, 35], incomplete: true,
    });
  });

  test('withholds statistics when no value is known', () => {
    expect(nutritionReportSummary([day({ coverage: 'unknown', daysWithMeals: 1 })])).toMatchObject({
      knownAverage: null, minimum: null, maximum: null, knownDays: 0,
    });
  });
});
