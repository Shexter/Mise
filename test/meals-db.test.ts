import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getMeal,
  getRecentAndFavoriteMeals,
  insertMeal,
  toggleMealFavorite,
} from '@/db/queries';
import { db, openTestDatabase } from './stubs/db';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-26T12:00:00.000Z'));
  openTestDatabase();
});

afterEach(() => vi.useRealTimers());

async function log(name: string, loggedAt: string, calories: number) {
  return insertMeal({
    loggedAt,
    localDate: loggedAt.slice(0, 10),
    mealType: 'lunch',
    name,
    photoUri: null,
    source: 'manual',
    confidence: null,
    venue: 'home',
    servingsMult: 1,
    items: [{
      name,
      quantity: 1,
      unit: 'serving',
      calories,
      proteinG: 10,
      carbsG: 20,
      fatG: 5,
      isManualAddition: false,
    }],
  });
}

describe('quick re-log meal queries', () => {
  test('the latest schema defaults favorites off and creates the lookup index', async () => {
    const meal = await log('Toast', '2026-08-26T08:00:00.000Z', 200);
    expect((await getMeal(meal.id))?.isFavorite).toBe(false);
    const indexes = await db().getAllAsync<{ name: string }>("PRAGMA index_list('meals')");
    expect(indexes.map((row) => row.name)).toContain('idx_meals_favorite');
  });

  test('toggles a meal favorite and persists the returned state', async () => {
    const meal = await log('Rice bowl', '2026-08-26T12:00:00.000Z', 500);
    expect(await toggleMealFavorite(meal.id)).toBe(true);
    expect((await getMeal(meal.id))?.isFavorite).toBe(true);
    expect(await toggleMealFavorite(meal.id)).toBe(false);
    expect((await getMeal(meal.id))?.isFavorite).toBe(false);
  });

  test('deduplicates recent dishes, keeps old favorites, and ranks pins first', async () => {
    await log('Morning Coffee', '2026-08-25T08:00:00.000Z', 80);
    await log(' morning coffee! ', '2026-08-26T08:00:00.000Z', 120);
    const curry = await log('Curry', '2026-08-24T18:00:00.000Z', 650);
    const oldFavorite = await log('Old favorite', '2026-05-01T12:00:00.000Z', 400);
    await log('Too old', '2026-05-02T12:00:00.000Z', 300);
    await toggleMealFavorite(curry.id);
    await toggleMealFavorite(oldFavorite.id);

    const results = await getRecentAndFavoriteMeals();
    expect(results.map((entry) => entry.meal.name)).toEqual([
      'Curry',
      'Old favorite',
      ' morning coffee! ',
    ]);
    expect(results.map((entry) => [entry.isFavorite, entry.timesLogged])).toEqual([
      [true, 1],
      [true, 0],
      [false, 2],
    ]);
    expect(results[2]?.meal.items[0]?.calories).toBe(120);
  });

  test('rejects a favorite toggle for a missing meal', async () => {
    await expect(toggleMealFavorite('missing')).rejects.toThrow('Meal no longer exists.');
  });
});
