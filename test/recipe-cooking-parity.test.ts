import { beforeEach, describe, expect, test } from 'vitest';

import {
  getAllCanonicals,
  getConsumptionEvents,
  getPantryItem,
  insertMeal,
  insertPantryItem,
  loadSeedData,
} from '@/db/queries';
import { depleteForMeal } from '@/logic/depletionService';
import { mealFromRecipe } from '@/logic/recipe';
import { mealFromSuggestion } from '@/logic/suggestionService';
import type { CanonicalItem, RecipeWithIngredients, Suggestion } from '@/types';
import { openTestDatabase } from './stubs/db';

let canonicals: Map<string, CanonicalItem>;

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
  canonicals = new Map((await getAllCanonicals()).map((canonical) => [canonical.id, canonical]));
});

const suggestion: Suggestion = {
  dish: 'Gochujang rice', reasons: [], kcalPerServing: 0, servings: 1,
  effortMinutes: 0, method: [], missing: [],
  uses: [
    { canonicalId: 'jasmine-rice', qty: 200, unit: 'g' },
    { canonicalId: 'gochujang', qty: 1, unit: 'tbsp' },
  ],
};

const recipe: RecipeWithIngredients = {
  id: 'recipe-1', title: suggestion.dish, sourceLink: 'https://example.com/source',
  steps: [], imageUri: null, status: 'ready',
  createdAt: '2026-08-11T00:00:00.000Z', updatedAt: '2026-08-11T00:00:00.000Z',
  ingredients: [
    { id: 'ri-1', recipeId: 'recipe-1', name: 'Jasmine rice', quantity: 200, unit: 'g', canonicalId: 'jasmine-rice', sortOrder: 0 },
    { id: 'ri-2', recipeId: 'recipe-1', name: 'Gochujang', quantity: 1, unit: 'tbsp', canonicalId: 'gochujang', sortOrder: 1 },
    { id: 'ri-3', recipeId: 'recipe-1', name: 'Spring onion to taste', quantity: null, unit: null, canonicalId: 'spring-onion', sortOrder: 2 },
  ],
};

describe('cooking a saved recipe', () => {
  test('depletes stated canonical quantities through the same path as a cooked suggestion', async () => {
    const rice = await insertPantryItem({ canonicalId: 'jasmine-rice', locationId: 'pantry', qtyRemaining: 1000, qtyUnit: 'g' });
    const gochujang = await insertPantryItem({ canonicalId: 'gochujang', locationId: 'fridge' });

    const recipeMeal = mealFromRecipe({ recipe, localDate: '2026-08-11', canonicals });
    const suggestionMeal = mealFromSuggestion({ suggestion, localDate: '2026-08-11', servingsMade: 1, canonicals });

    expect(recipeMeal).toMatchObject({ source: 'recipe', venue: 'home', servingsMult: suggestionMeal.servingsMult });
    expect(recipeMeal.items.map(({ quantity, unit, canonicalId }) => ({ quantity, unit, canonicalId })))
      .toEqual(suggestionMeal.items.map(({ quantity, unit, canonicalId }) => ({ quantity, unit, canonicalId })));

    const stored = await insertMeal(recipeMeal);
    const summary = await depleteForMeal(stored);

    expect([...summary.names].sort()).toEqual(['Gochujang', 'Jasmine rice']);
    expect((await getPantryItem(rice.id))?.qtyRemaining).toBe(800);
    // The canonical's typical use is half a tablespoon, so one stated
    // tablespoon is two uses — identical to the cooked-suggestion path.
    expect((await getPantryItem(gochujang.id))?.usesCount).toBe(2);
    expect((await getConsumptionEvents(stored.id)).map((event) => event.canonicalId).sort()).toEqual([
      'gochujang', 'gochujang', 'jasmine-rice',
    ]);
  });

  test('does not guess or deplete an ingredient whose recipe states no amount', () => {
    const meal = mealFromRecipe({ recipe, localDate: '2026-08-11', canonicals });
    expect(meal.items.some((item) => item.canonicalId === 'spring-onion')).toBe(false);
  });
});
