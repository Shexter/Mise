import { describe, expect, test } from 'vitest';

import { planDepletion } from '@/logic/deplete';
import { cloneMealForLogging } from '@/logic/mealCloning';
import type { MealWithItems } from '@/types';

const original: MealWithItems = {
  id: 'meal-1',
  loggedAt: '2026-08-24T18:00:00.000Z',
  localDate: '2026-08-24',
  mealType: 'dinner',
  name: 'Sunday curry',
  photoUri: 'file:///old-meal.jpg',
  source: 'photo',
  confidence: 'high',
  venue: 'home',
  servingsMult: 4,
  isFavorite: true,
  createdAt: '2026-08-24T18:00:00.000Z',
  items: [{
    id: 'item-1', mealId: 'meal-1', name: 'Rice', quantity: 200, unit: 'g',
    calories: 260, proteinG: 5, carbsG: 56, fatG: 1, fibreG: 2,
    isManualAddition: false, sortOrder: 0, canonicalId: 'jasmine-rice',
  }],
};

describe('cloneMealForLogging', () => {
  test('creates an independent leftovers review draft for the target date', () => {
    const draft = cloneMealForLogging(
      original,
      '2026-08-26',
      'leftovers',
      new Date('2026-08-26T12:30:00.000Z'),
    );

    expect(draft).toMatchObject({
      loggedAt: '2026-08-26T12:30:00.000Z',
      localDate: '2026-08-26',
      mealType: 'dinner',
      name: 'Sunday curry',
      photoUri: null,
      source: 'manual',
      confidence: null,
      venue: 'leftovers',
      servingsMult: 1,
    });
    expect(draft.items).toEqual([{
      name: 'Rice', quantity: 200, unit: 'g', calories: 260,
      proteinG: 5, carbsG: 56, fatG: 1, fibreG: 2,
      isManualAddition: false, canonicalId: 'jasmine-rice',
    }]);
    expect(draft.items[0]).not.toBe(original.items[0]);
  });

  test('leftovers produce no depletion while a fresh cook retains the batch size', () => {
    const leftovers = cloneMealForLogging(original, '2026-08-26', 'leftovers');
    expect(planDepletion({
      venue: leftovers.venue ?? 'home',
      servingsMult: leftovers.servingsMult ?? 1,
      ingredients: [{ canonicalId: 'jasmine-rice', quantity: 200, unit: 'g', kind: 'meal_item' }],
      catalogue: [],
      canonicals: new Map(),
    })).toEqual([]);

    const cookedAgain = cloneMealForLogging(original, '2026-08-26', 'home');
    expect(cookedAgain.venue).toBe('home');
    expect(cookedAgain.servingsMult).toBe(4);
  });
});
