import { beforeEach, describe, expect, test } from 'vitest';

import { parseEstimate } from '@/api/parse';
import { getMeal, insertMeal, loadSeedData } from '@/db/queries';
import { macrosOfMeals } from '@/logic/scaling';
import type { MealWithItems } from '@/types';
import { openTestDatabase } from './stubs/db';

const baseEstimate = {
  meal_name: 'Oats', confidence: 'high', items: [{
    name: 'Oats', quantity: 1, unit: 'serving', calories: 200,
    protein_g: 8, carbs_g: 33, fat_g: 4,
  }], likely_hidden_ingredients: [],
};

function meal(fibreG: number | null): MealWithItems {
  return {
    id: 'meal', loggedAt: '2026-08-10T12:00:00.000Z', localDate: '2026-08-10',
    mealType: 'lunch', name: 'Test', photoUri: null, source: 'manual', confidence: null,
    venue: 'home', servingsMult: 1, createdAt: '2026-08-10T12:00:00.000Z',
    items: [{ id: 'item', mealId: 'meal', name: 'Test', quantity: 1, unit: 'serving',
      calories: 100, proteinG: 5, carbsG: 10, fatG: 2, fibreG, isManualAddition: true,
      sortOrder: 0, canonicalId: null }],
  };
}

describe('fibre parsing', () => {
  test('keeps present, omitted, and null fibre distinct', () => {
    expect(parseEstimate(JSON.stringify({ ...baseEstimate, items: [{ ...baseEstimate.items[0], fibre_g: 6.5 }] })).items[0]?.fibreG).toBe(6.5);
    expect(parseEstimate(JSON.stringify(baseEstimate)).items[0]?.fibreG).toBeNull();
    expect(parseEstimate(JSON.stringify({ ...baseEstimate, items: [{ ...baseEstimate.items[0], fibre_g: null }] })).items[0]?.fibreG).toBeNull();
  });
});

describe('fibre aggregation', () => {
  test('sums complete days but propagates any unknown value', () => {
    expect(macrosOfMeals([meal(4), meal(6)]).fibreG).toBe(10);
    expect(macrosOfMeals([meal(4), meal(null)]).fibreG).toBeNull();
    expect(macrosOfMeals([]).fibreG).toBe(0);
  });
});

describe('fibre storage', () => {
  beforeEach(async () => {
    openTestDatabase();
    await loadSeedData();
  });

  test('reads an omitted fibre value back as unknown, not zero', async () => {
    const stored = await insertMeal({
      loggedAt: '2026-08-10T12:00:00.000Z', localDate: '2026-08-10', mealType: 'lunch',
      name: 'Old meal', photoUri: null, source: 'manual', confidence: null,
      items: [{ name: 'Rice', quantity: 1, unit: 'serving', calories: 200, proteinG: 4, carbsG: 44, fatG: 1, isManualAddition: true }],
    });
    expect((await getMeal(stored.id))?.items[0]?.fibreG).toBeNull();
  });
});
