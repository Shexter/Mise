import { beforeEach, describe, expect, test } from 'vitest';

import {
  ensureDailyTarget,
  getDaySummaries,
  insertMeal,
} from '../src/db/queries';
import type { Profile } from '../src/types';
import { openTestDatabase } from './stubs/db';

const profile: Profile = {
  sex: 'male', age: 30, heightCm: 180, weightKg: 80,
  activityLevel: 'moderate', goal: 'maintain', targetCalories: 2200,
  targetSource: 'estimated', statedCalories: null, statedFigureKind: null,
  proteinPct: 0.3, carbsPct: 0.4, fatPct: 0.3, units: 'metric',
  onboardedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  openTestDatabase();
});

async function log(localDate: string, calories: number) {
  return insertMeal({
    loggedAt: `${localDate}T12:00:00.000Z`, localDate, mealType: 'lunch',
    name: `Meal ${localDate}`, photoUri: null, source: 'manual', confidence: null,
    venue: 'out', items: [{ name: 'Meal', quantity: 1, unit: 'serving', calories,
      proteinG: 0, carbsG: 0, fatG: 0, isManualAddition: true }],
  });
}

describe('getDaySummaries', () => {
  test('returns logged gaps only and keeps a zero-calorie log distinct from absence', async () => {
    await log('2026-04-02', 0);
    await log('2026-04-20', 640);
    const rows = await getDaySummaries('2026-04-01', '2026-04-30');
    expect(rows).toEqual([
      { localDate: '2026-04-02', calories: 0, targetCalories: null },
      { localDate: '2026-04-20', calories: 640, targetCalories: null },
    ]);
    expect(rows.some((row) => row.localDate === '2026-04-03')).toBe(false);
  });

  test('preserves an unknown calorie value instead of letting SQL sum it as zero', async () => {
    const localDate = '2026-04-12';
    await insertMeal({
      loggedAt: `${localDate}T12:00:00.000Z`, localDate, mealType: 'lunch', name: 'Unknown recipe',
      photoUri: null, source: 'suggestion', confidence: null,
      items: [{
        name: 'Unknown recipe', quantity: 1, unit: 'serving', calories: null,
        proteinG: null, carbsG: null, fatG: null, isManualAddition: false,
      }],
    });
    expect(await getDaySummaries('2026-04-01', '2026-04-30')).toEqual([
      { localDate, calories: null, targetCalories: null },
    ]);
  });

  test('sums every logged day in a full month in one range result', async () => {
    for (let day = 1; day <= 28; day += 1) {
      const localDate = `2026-02-${String(day).padStart(2, '0')}`;
      await log(localDate, day);
      await log(localDate, day);
    }
    const rows = await getDaySummaries('2026-02-01', '2026-02-28');
    expect(rows).toHaveLength(28);
    expect(rows[27]).toMatchObject({ localDate: '2026-02-28', calories: 56 });
  });

  test('returns an empty array for an empty month', async () => {
    expect(await getDaySummaries('2026-05-01', '2026-05-31')).toEqual([]);
  });

  test('uses the target recorded for the historical day', async () => {
    await ensureDailyTarget('2026-03-10', profile);
    await log('2026-03-10', 1800);
    const currentProfile = { ...profile, targetCalories: 1500 };
    await ensureDailyTarget('2026-03-10', currentProfile);
    expect(await getDaySummaries('2026-03-01', '2026-03-31')).toEqual([
      { localDate: '2026-03-10', calories: 1800, targetCalories: 2200 },
    ]);
  });
});
