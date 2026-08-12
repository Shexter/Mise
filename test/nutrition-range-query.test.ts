import { beforeEach, describe, expect, test } from 'vitest';

import {
  ensureDailyTarget,
  getNutritionDayValues,
  getNutritionRangeBuckets,
  insertMeal,
} from '@/db/queries';
import { customNutritionPeriod } from '@/logic/nutritionRange';
import type { Profile } from '@/types';
import { openTestDatabase } from './stubs/db';

const profile: Profile = {
  sex: null, age: null, heightCm: null, weightKg: 70,
  activityLevel: 'moderate', goal: 'maintain', targetCalories: 2000,
  targetSource: 'stated', statedCalories: 2000, statedFigureKind: 'total',
  proteinPct: 0.3, carbsPct: 0.4, fatPct: 0.3, fibreTargetG: 30,
  units: 'metric', onboardedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => openTestDatabase());

async function log(
  localDate: string,
  items: Array<{
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    fibreG: number | null;
  }>,
) {
  await insertMeal({
    loggedAt: `${localDate}T12:00:00.000Z`, localDate, mealType: 'lunch',
    name: `Meal ${localDate}`, photoUri: null, source: 'manual', confidence: null,
    venue: 'out', items: items.map((nutrition, index) => ({
      name: `Item ${index + 1}`, quantity: 1, unit: 'serving', ...nutrition,
      isManualAddition: true,
    })),
  });
}

describe('nutrition range queries', () => {
  test('returns complete, partial, unknown, and target-only dates without coercion', async () => {
    await ensureDailyTarget('2026-08-03', profile);
    await log('2026-08-03', [
      { calories: 400, proteinG: 20, carbsG: 40, fatG: 10, fibreG: 6 },
      { calories: 100, proteinG: null, carbsG: 10, fatG: null, fibreG: null },
    ]);
    await log('2026-08-04', [
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0 },
    ]);
    await log('2026-08-05', [
      { calories: 250, proteinG: null, carbsG: null, fatG: null, fibreG: null },
    ]);
    await ensureDailyTarget('2026-08-06', { ...profile, fibreTargetG: 35 });

    expect(await getNutritionDayValues('fibre', '2026-08-03', '2026-08-06')).toEqual([
      { localDate: '2026-08-03', knownValue: 6, coverage: 'partial', hasMeals: true, recordedTarget: 30 },
      { localDate: '2026-08-04', knownValue: 0, coverage: 'complete', hasMeals: true, recordedTarget: null },
      { localDate: '2026-08-05', knownValue: null, coverage: 'unknown', hasMeals: true, recordedTarget: null },
      { localDate: '2026-08-06', knownValue: null, coverage: 'no-meals', hasMeals: false, recordedTarget: 35 },
    ]);
  });

  test.each([
    ['energy', 500, 2000],
    ['protein', 20, 150],
    ['carbohydrate', 50, 200],
    ['fat', 10, 67],
    ['fibre', 6, 30],
  ] as const)('selects the closed %s value and recorded-target columns', async (metric, value, target) => {
    await ensureDailyTarget('2026-08-03', profile);
    await log('2026-08-03', [
      { calories: 400, proteinG: 20, carbsG: 40, fatG: 10, fibreG: 6 },
      { calories: 100, proteinG: null, carbsG: 10, fatG: null, fibreG: null },
    ]);

    const [row] = await getNutritionDayValues(metric, '2026-08-03', '2026-08-03');
    expect(row).toMatchObject({ knownValue: value, recordedTarget: target });
  });

  test('fills absent dates and groups weekly values with mixed historical targets', async () => {
    await ensureDailyTarget('2026-08-03', profile);
    await log('2026-08-03', [{ calories: 400, proteinG: 20, carbsG: 40, fatG: 10, fibreG: 6 }]);
    const changed = { ...profile, targetCalories: 2400, statedCalories: 2400, fibreTargetG: 35 };
    await ensureDailyTarget('2026-08-04', changed);
    await log('2026-08-04', [{ calories: 600, proteinG: 30, carbsG: 60, fatG: 20, fibreG: 8 }]);
    await log('2026-08-10', [{ calories: 300, proteinG: null, carbsG: null, fatG: null, fibreG: null }]);

    const period = customNutritionPeriod('2026-08-03', '2026-08-11');
    const daily = await getNutritionRangeBuckets('protein', period, 'daily');
    expect(daily).toHaveLength(9);
    expect(daily[2]).toMatchObject({ startDate: '2026-08-05', coverage: 'no-meals', knownValue: null });

    const weekly = await getNutritionRangeBuckets('energy', period, 'weekly');
    expect(weekly).toHaveLength(2);
    expect(weekly[0]).toMatchObject({
      knownValue: 1000, coverage: 'complete', recordedTarget: null, targetChanged: true,
      daysWithMeals: 2, totalDays: 7,
    });
    expect(weekly[1]).toMatchObject({
      knownValue: 300, coverage: 'complete', recordedTarget: null, targetChanged: false,
      daysWithMeals: 1, totalDays: 2,
    });
  });

  test('rejects reversed query bounds before reading storage', async () => {
    await expect(getNutritionDayValues('energy', '2026-08-12', '2026-08-11')).rejects.toThrow(/start/i);
  });
});
