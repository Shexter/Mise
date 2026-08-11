import { beforeEach, describe, expect, test } from 'vitest';

import {
  getConsumptionEvents,
  deleteMeal,
  insertMeal,
  loadSeedData,
} from '../src/db/queries';
import { useDayStore } from '../src/store/dayStore';
import { openTestDatabase } from './stubs/db';

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
  useDayStore.setState({
    selectedDate: '2026-08-01', following: false, loading: false,
    meals: [], target: null,
    consumed: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0 },
    loggedDates: [], pendingUndo: null, lastDepletion: null,
  });
});

describe('day store meal editing', () => {
  test('refreshes totals immediately and retains a deliberately selected past date', async () => {
    const meal = await insertMeal({
      loggedAt: '2026-08-01T12:00:00.000Z', localDate: '2026-08-01',
      mealType: 'lunch', name: 'Lunch', photoUri: null, source: 'manual',
      confidence: null, venue: 'out', servingsMult: 1,
      items: [{ name: 'Lunch', quantity: 1, unit: 'serving', calories: 300,
        proteinG: 10, carbsG: 20, fatG: 8, isManualAddition: true }],
    });
    await useDayStore.getState().refresh();
    expect(useDayStore.getState().consumed.calories).toBe(300);

    await useDayStore.getState().updateMeal({
      ...meal,
      items: [{ ...meal.items[0]!, calories: 450, proteinG: 20 }],
    });
    const state = useDayStore.getState();
    expect(state.selectedDate).toBe('2026-08-01');
    expect(state.following).toBe(false);
    expect(state.consumed).toMatchObject({ calories: 450, proteinG: 20 });
    expect(state.meals[0]?.items[0]?.calories).toBe(450);
  });

  test('a normalized no-op does not create depletion events', async () => {
    const meal = await insertMeal({
      loggedAt: '2026-08-01T12:00:00.000Z', localDate: '2026-08-01',
      mealType: 'lunch', name: 'Lunch', photoUri: null, source: 'manual',
      confidence: null, venue: 'out', servingsMult: 1,
      items: [{ name: 'Lunch', quantity: 1, unit: 'serving', calories: 300,
        proteinG: 10, carbsG: 20, fatG: 8, isManualAddition: true }],
    });
    await useDayStore.getState().updateMeal(meal);
    expect(await getConsumptionEvents(meal.id)).toEqual([]);
  });

  test('a failed save leaves the visible store state unchanged', async () => {
    const meal = await insertMeal({
      loggedAt: '2026-08-01T12:00:00.000Z', localDate: '2026-08-01',
      mealType: 'lunch', name: 'Lunch', photoUri: null, source: 'manual',
      confidence: null, venue: 'out', servingsMult: 1,
      items: [{ name: 'Lunch', quantity: 1, unit: 'serving', calories: 300,
        proteinG: 10, carbsG: 20, fatG: 8, isManualAddition: true }],
    });
    await useDayStore.getState().refresh();
    const visibleBefore = useDayStore.getState().meals;
    await deleteMeal(meal.id);
    await expect(
      useDayStore.getState().updateMeal({ ...meal, name: 'Never saved' }),
    ).rejects.toThrow('Meal no longer exists');
    expect(useDayStore.getState().meals).toEqual(visibleBefore);
  });
});
