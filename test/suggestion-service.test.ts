import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../src/api/suggest', () => ({
  generateSuggestions: vi.fn(),
}));
vi.mock('../src/api/keyStore', () => ({
  hasApiKey: vi.fn(),
}));

import { generateSuggestions } from '../src/api/suggest';
import { hasApiKey } from '../src/api/keyStore';
import {
  getAllCanonicals,
  getPantryItem,
  insertMeal,
  insertPantryItem,
  loadSeedData,
} from '../src/db/queries';
import { depleteForMeal } from '../src/logic/depletionService';
import {
  getOrGenerateSuggestions,
  mealFromSuggestion,
} from '../src/logic/suggestionService';
import { localDateString } from '../src/logic/dates';
import type { CanonicalItem, Suggestion } from '../src/types';
import { openTestDatabase } from './stubs/db';

/**
 * The cache-or-generate decision in `suggestionService.ts`: reuse when
 * nothing material has changed, regenerate when it has, and only an
 * explicit refresh spends a call outside that rule (decision 40).
 */

const FAKE_SUGGESTION: Suggestion = {
  dish: 'Test stir-fry',
  reasons: [{ kind: 'clears_stock', label: 'clears an expiring item' }],
  kcalPerServing: 400,
  servings: 2,
  effortMinutes: 15,
  uses: [{ canonicalId: 'soy-sauce-light', qty: 10, unit: 'ml' }],
  missing: [],
  method: [],
};

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
  vi.mocked(generateSuggestions).mockReset();
  vi.mocked(hasApiKey).mockReset();
  vi.mocked(generateSuggestions).mockResolvedValue({
    suggestions: [FAKE_SUGGESTION],
    shortfall: null,
  });
});

describe('getOrGenerateSuggestions caching', () => {
  test('generates and caches on a cold cache', async () => {
    vi.mocked(hasApiKey).mockResolvedValue(true);
    const localDate = localDateString();

    const result = await getOrGenerateSuggestions({ localDate, mode: 'tonight' });

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.fromCache).toBe(false);
      expect(result.set.suggestions[0]?.dish).toBe('Test stir-fry');
    }
    expect(generateSuggestions).toHaveBeenCalledTimes(1);
  });

  test('reopening the surface with nothing changed makes no request', async () => {
    vi.mocked(hasApiKey).mockResolvedValue(true);
    const localDate = localDateString();

    const first = await getOrGenerateSuggestions({ localDate, mode: 'tonight' });
    expect(first.status).toBe('ready');
    expect(generateSuggestions).toHaveBeenCalledTimes(1);

    const second = await getOrGenerateSuggestions({ localDate, mode: 'tonight' });
    expect(second.status).toBe('ready');
    if (second.status === 'ready') {
      expect(second.fromCache).toBe(true);
    }
    // Still just the one call from the first, cold-cache request.
    expect(generateSuggestions).toHaveBeenCalledTimes(1);
  });

  test('an explicit refresh spends a call even though nothing changed', async () => {
    vi.mocked(hasApiKey).mockResolvedValue(true);
    const localDate = localDateString();

    await getOrGenerateSuggestions({ localDate, mode: 'tonight' });
    expect(generateSuggestions).toHaveBeenCalledTimes(1);

    const refreshed = await getOrGenerateSuggestions({
      localDate,
      mode: 'tonight',
      forceRefresh: true,
    });
    expect(refreshed.status).toBe('ready');
    expect(generateSuggestions).toHaveBeenCalledTimes(2);
  });

  test('no key and no cache reports no_key without ever calling the model', async () => {
    vi.mocked(hasApiKey).mockResolvedValue(false);
    const localDate = localDateString();

    const result = await getOrGenerateSuggestions({ localDate, mode: 'tonight' });
    expect(result.status).toBe('no_key');
    expect(generateSuggestions).not.toHaveBeenCalled();
  });
});

describe('mealFromSuggestion — "I cooked this"', () => {
  let canonicals: Map<string, CanonicalItem>;

  beforeEach(async () => {
    canonicals = new Map((await getAllCanonicals()).map((c) => [c.id, c]));
  });

  test('unchanged servings makes no extra multiplier', () => {
    const meal = mealFromSuggestion({
      suggestion: FAKE_SUGGESTION,
      servingsMade: FAKE_SUGGESTION.servings,
      localDate: '2026-06-01',
      canonicals,
    });
    expect(meal.servingsMult).toBe(1);
    expect(meal.venue).toBe('home');
    expect(meal.source).toBe('suggestion');
  });

  test('a doubled batch feeds decision 10\'s multiplier', () => {
    const meal = mealFromSuggestion({
      suggestion: FAKE_SUGGESTION,
      servingsMade: FAKE_SUGGESTION.servings * 2,
      localDate: '2026-06-01',
      canonicals,
    });
    expect(meal.servingsMult).toBe(2);
  });

  test('carries the suggestion\'s amounts and canonical ids into the items', () => {
    const meal = mealFromSuggestion({
      suggestion: FAKE_SUGGESTION,
      servingsMade: FAKE_SUGGESTION.servings,
      localDate: '2026-06-01',
      canonicals,
    });
    const ingredientItems = meal.items.filter((item) => item.canonicalId);
    expect(ingredientItems).toEqual([
      expect.objectContaining({ canonicalId: 'soy-sauce-light', quantity: 10, unit: 'ml' }),
    ]);
    // Calories land on the dish item; ingredient items are not double-counted.
    const dishItem = meal.items.find((item) => !item.canonicalId);
    expect(dishItem?.calories).toBe(FAKE_SUGGESTION.kcalPerServing);
    expect(ingredientItems.every((item) => item.calories === 0)).toBe(true);
  });

  test('a cooked suggestion commits through the ordinary meal flow and debits by identity', async () => {
    const soySauce = await insertPantryItem({
      canonicalId: 'soy-sauce-light',
      locationId: 'pantry',
      qtyRemaining: 500,
      qtyUnit: 'ml',
    });

    const meal = mealFromSuggestion({
      suggestion: FAKE_SUGGESTION,
      servingsMade: FAKE_SUGGESTION.servings,
      localDate: '2026-06-01',
      canonicals,
    });
    const stored = await insertMeal(meal);
    const summary = await depleteForMeal(stored);

    expect(summary.uncatalogued).toBe(0);
    const item = await getPantryItem(soySauce.id);
    // Soy sauce is a condiment — uses-tracked, not mass-tracked.
    expect(item?.usesCount).toBe(1);
    expect(item?.qtyRemaining).toBe(500);
  });

  test('a doubled batch debits mass-tracked ingredients twofold', async () => {
    const chicken = await insertPantryItem({
      canonicalId: 'chicken-breast',
      locationId: 'fridge',
      qtyRemaining: 2000,
      qtyUnit: 'g',
    });
    const proteinSuggestion: Suggestion = {
      ...FAKE_SUGGESTION,
      uses: [{ canonicalId: 'chicken-breast', qty: 300, unit: 'g' }],
    };

    const meal = mealFromSuggestion({
      suggestion: proteinSuggestion,
      servingsMade: proteinSuggestion.servings * 2,
      localDate: '2026-06-01',
      canonicals,
    });
    const stored = await insertMeal(meal);
    await depleteForMeal(stored);

    // 300 g stated at the suggestion's own servings, doubled by the batch.
    expect((await getPantryItem(chicken.id))?.qtyRemaining).toBe(1400);
  });
});
