import { beforeEach, describe, expect, test } from 'vitest';

import {
  deleteMeal,
  getMeal,
  getMealsForDate,
  insertMeal,
  loadSeedData,
  type NewMeal,
} from '../src/db/queries';
import { mealToDraft, normaliseMealDraft } from '../src/logic/mealEdit';
import { saveEditedMeal } from '../src/logic/depletionService';
import { openTestDatabase } from './stubs/db';

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
});

describe('Cross-day meal logging, moving dates, and deletion', () => {
  test('can log a meal to a past date and retrieve it under that date', async () => {
    const pastDate = '2026-08-15';
    const meal: NewMeal = {
      loggedAt: `${pastDate}T12:00:00.000Z`,
      localDate: pastDate,
      mealType: 'lunch',
      name: 'Past Steak & Rice',
      photoUri: null,
      source: 'manual',
      confidence: null,
      venue: 'home',
      items: [
        {
          name: 'Steak',
          quantity: 200,
          unit: 'g',
          calories: 500,
          proteinG: 50,
          carbsG: 0,
          fatG: 30,
          isManualAddition: false,
          canonicalId: null,
        },
      ],
    };

    const inserted = await insertMeal(meal);
    expect(inserted.localDate).toBe(pastDate);

    const mealsForPastDate = await getMealsForDate(pastDate);
    expect(mealsForPastDate).toHaveLength(1);
    expect(mealsForPastDate[0]?.name).toBe('Past Steak & Rice');

    const mealsForToday = await getMealsForDate('2026-08-22');
    expect(mealsForToday).toHaveLength(0);
  });

  test('can move an existing meal from one date to another date via edit', async () => {
    const originalDate = '2026-08-20';
    const targetDate = '2026-08-21';

    const meal: NewMeal = {
      loggedAt: `${originalDate}T18:00:00.000Z`,
      localDate: originalDate,
      mealType: 'dinner',
      name: 'Salmon Bowl',
      photoUri: null,
      source: 'manual',
      confidence: null,
      venue: 'home',
      items: [
        {
          name: 'Salmon',
          quantity: 1,
          unit: 'serving',
          calories: 450,
          proteinG: 35,
          carbsG: 10,
          fatG: 22,
          isManualAddition: false,
          canonicalId: null,
        },
      ],
    };

    const inserted = await insertMeal(meal);
    expect(await getMealsForDate(originalDate)).toHaveLength(1);
    expect(await getMealsForDate(targetDate)).toHaveLength(0);

    const draft = mealToDraft(inserted);
    draft.localDate = targetDate;

    const normalised = normaliseMealDraft(draft);
    expect(normalised.localDate).toBe(targetDate);

    await saveEditedMeal(normalised);

    const oldDayMeals = await getMealsForDate(originalDate);
    expect(oldDayMeals).toHaveLength(0);

    const newDayMeals = await getMealsForDate(targetDate);
    expect(newDayMeals).toHaveLength(1);
    expect(newDayMeals[0]?.name).toBe('Salmon Bowl');
    expect(newDayMeals[0]?.localDate).toBe(targetDate);
  });

  test('can delete a meal from any day', async () => {
    const date = '2026-08-10';
    const meal: NewMeal = {
      loggedAt: `${date}T08:00:00.000Z`,
      localDate: date,
      mealType: 'breakfast',
      name: 'Avocado Toast',
      photoUri: null,
      source: 'manual',
      confidence: null,
      venue: 'out',
      items: [
        {
          name: 'Toast',
          quantity: 2,
          unit: 'serving',
          calories: 320,
          proteinG: 8,
          carbsG: 40,
          fatG: 14,
          isManualAddition: false,
          canonicalId: null,
        },
      ],
    };

    const inserted = await insertMeal(meal);
    expect(await getMealsForDate(date)).toHaveLength(1);

    await deleteMeal(inserted.id);

    expect(await getMealsForDate(date)).toHaveLength(0);
    expect(await getMeal(inserted.id)).toBeNull();
  });
});
