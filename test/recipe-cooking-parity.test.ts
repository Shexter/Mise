import { beforeEach, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

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
import { useCaptureStore } from '@/store/captureStore';
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
  test('routes the prepared recipe draft into the shared review controls', () => {
    const detail = readFileSync('app/recipe/[id].tsx', 'utf8');
    const review = readFileSync('app/review.tsx', 'utf8');

    expect(detail).toContain('label="Cook & Log Meal"');
    expect(detail).toContain('setMealDraft(mealFromRecipe(');
    expect(detail).toContain("router.push('/review')");
    expect(review).toContain('mealDraft.items.map(toDraftMealItem)');
    expect(review).toContain('source: draftSource');
    expect(review).toContain('mealDraft?.mealType ?? mealTypeForTime()');
    expect(review).toContain('mealDraft?.servingsMult ?? 1');
    expect(review).toContain("draftSource === 'recipe'");
  });

  test('constructs a review draft with recipe provenance and known identities', () => {
    const meal = mealFromRecipe({ recipe, localDate: '2026-08-11', canonicals });
    useCaptureStore.getState().setMealDraft(meal);

    expect(useCaptureStore.getState().mealDraft).toMatchObject({
      name: 'Gochujang rice',
      localDate: '2026-08-11',
      source: 'recipe',
      venue: 'home',
      servingsMult: 1,
    });
    expect(useCaptureStore.getState().mealDraft?.items.map((item) => item.canonicalId))
      .toEqual([undefined, 'jasmine-rice', 'gochujang']);
  });

  test.each([1, 2, 4] as const)('depletes stated quantities accurately at %sx', async (servingsMade) => {
    const rice = await insertPantryItem({ canonicalId: 'jasmine-rice', locationId: 'pantry', qtyRemaining: 2000, qtyUnit: 'g' });
    const gochujang = await insertPantryItem({ canonicalId: 'gochujang', locationId: 'fridge' });

    const recipeMeal = mealFromRecipe({ recipe, localDate: '2026-08-11', servingsMade, canonicals });
    const suggestionMeal = mealFromSuggestion({ suggestion, localDate: '2026-08-11', servingsMade, canonicals });

    expect(recipeMeal).toMatchObject({ source: 'recipe', venue: 'home', servingsMult: suggestionMeal.servingsMult });
    expect(recipeMeal.items.map(({ quantity, unit, canonicalId }) => ({ quantity, unit, canonicalId })))
      .toEqual(suggestionMeal.items.map(({ quantity, unit, canonicalId }) => ({ quantity, unit, canonicalId })));

    const stored = await insertMeal(recipeMeal);
    const summary = await depleteForMeal(stored);

    expect(stored.source).toBe('recipe');
    expect([...summary.names].sort()).toEqual(['Gochujang', 'Jasmine rice']);
    expect((await getPantryItem(rice.id))?.qtyRemaining).toBe(2000 - (200 * servingsMade));
    // The stated tablespoon is counted once per batch multiplier. The
    // dish-level "Gochujang rice" nutrition row must not count as another use.
    expect((await getPantryItem(gochujang.id))?.usesCount).toBe(servingsMade);
    expect((await getConsumptionEvents(stored.id)).map((event) => event.canonicalId).sort()).toEqual([
      'gochujang', 'jasmine-rice',
    ]);
  });

  test('does not guess or deplete an ingredient whose recipe states no amount', () => {
    const meal = mealFromRecipe({ recipe, localDate: '2026-08-11', canonicals });
    expect(meal.items.some((item) => item.canonicalId === 'spring-onion')).toBe(false);
  });

  test('does not resolve the dish-level nutrition row as another ingredient', async () => {
    const rice = await insertPantryItem({
      canonicalId: 'jasmine-rice',
      locationId: 'pantry',
      qtyRemaining: 1000,
      qtyUnit: 'g',
    });
    const riceRecipe = {
      ...recipe,
      title: 'Jasmine rice',
      ingredients: recipe.ingredients.filter((ingredient) => ingredient.canonicalId === 'jasmine-rice'),
    };
    const stored = await insertMeal(mealFromRecipe({
      recipe: riceRecipe,
      localDate: '2026-08-11',
      canonicals,
    }));

    await depleteForMeal(stored);

    expect((await getPantryItem(rice.id))?.qtyRemaining).toBe(800);
    expect((await getConsumptionEvents(stored.id)).filter(
      (event) => event.canonicalId === 'jasmine-rice',
    )).toHaveLength(1);
  });
});
