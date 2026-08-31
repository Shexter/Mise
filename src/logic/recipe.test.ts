import { describe, expect, test } from 'vitest';

import { coverageForRecipe, mealFromRecipe } from '@/logic/recipe';
import type { PantryItem, RecipeWithIngredients } from '@/types';

const recipe: RecipeWithIngredients = {
  id: 'recipe', title: 'Miso noodles', sourceLink: 'https://example.com/post', steps: [],
  imageUri: null, status: 'ready', createdAt: '2026-08-10T00:00:00Z', updatedAt: '2026-08-10T00:00:00Z',
  ingredients: [
    { id: 'a', recipeId: 'recipe', name: 'Miso', quantity: 2, unit: 'tbsp', canonicalId: 'miso', sortOrder: 0 },
    { id: 'b', recipeId: 'recipe', name: 'Noodles', quantity: 200, unit: 'g', canonicalId: 'noodles', sortOrder: 1 },
    { id: 'c', recipeId: 'recipe', name: 'A splash of oil', quantity: null, unit: null, canonicalId: 'oil', sortOrder: 2 },
    { id: 'd', recipeId: 'recipe', name: 'Mystery garnish', quantity: null, unit: null, canonicalId: null, sortOrder: 3 },
  ],
};

const pantry = (canonicalId: string, status: PantryItem['status'] = 'in_stock'): PantryItem => ({
  id: canonicalId, canonicalId, productId: null, locationId: 'pantry', qtyRemaining: 1,
  qtyUnit: 'g', qtySource: 'user', fullness: null, usesCount: 0, purchasedAt: '2026-08-10',
  acquiredAtKnown: true,
  openedAt: null, expiresAt: null, expirySource: null, priceCents: null, photoUri: null, status,
  estimatedDecrementsSinceAnchor: 0, lastAnchorAt: null, replacementAsked: false,
  createdAt: '2026-08-10T00:00:00Z', updatedAt: '2026-08-10T00:00:00Z',
});

describe('saved recipe logic', () => {
  test('coverage never claims an unresolved ingredient is held', () => {
    expect(coverageForRecipe(recipe, [pantry('miso'), pantry('oil')])).toEqual({
      held: ['Miso', 'A splash of oil'], missing: ['Noodles'], unresolved: ['Mystery garnish'],
    });
  });

  test('an empty pantry reports resolved ingredients as missing', () => {
    expect(coverageForRecipe(recipe, [])).toMatchObject({
      held: [], missing: ['Miso', 'Noodles', 'A splash of oil'], unresolved: ['Mystery garnish'],
    });
  });

  test('cooking only carries stated resolved quantities to depletion', () => {
    const meal = mealFromRecipe({ recipe, localDate: '2026-08-10', servingsMade: 2, canonicals: new Map() });
    expect(meal.source).toBe('recipe');
    expect(meal.venue).toBe('home');
    expect(meal.servingsMult).toBe(2);
    expect(meal.items.map((item) => item.name)).toEqual(['Miso noodles', 'miso', 'noodles']);
  });
});
