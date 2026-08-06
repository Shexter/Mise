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
    droppedForConstraint: 0,
      droppedForDiet: 0,
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

  test('no rules recorded means no dietary behaviour anywhere (task 5.7/10.7)', async () => {
    vi.mocked(hasApiKey).mockResolvedValue(true);
    const localDate = localDateString();

    const result = await getOrGenerateSuggestions({ localDate, mode: 'tonight' });

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      // Nothing dropped and nothing down-ranked — the suggestion the model
      // returned is exactly what is displayed.
      expect(result.set.droppedForDiet).toBe(0);
      expect(result.set.suggestions.map((s) => s.dish)).toEqual(['Test stir-fry']);
    }
    // The request the engine sent reflects the absence too.
    expect(generateSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        dietaryRules: [],
        exclusionSet: { canonicalIds: new Set(), unresolvedText: new Set() },
        hasAllergenRules: false,
      }),
    );
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

describe('an emptied pool on fresh generation is a ready set, not an error (decision 178)', () => {
  test('everything dropped for diet reaches "ready" with the drop count, not "error"', async () => {
    vi.mocked(hasApiKey).mockResolvedValue(true);
    vi.mocked(generateSuggestions).mockResolvedValue({
      suggestions: [],
      shortfall: null,
      droppedForConstraint: 0,
      droppedForDiet: 3,
    });
    const localDate = localDateString();

    const result = await getOrGenerateSuggestions({ localDate, mode: 'tonight' });

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.set.suggestions).toHaveLength(0);
      expect(result.set.droppedForDiet).toBe(3);
    }
  });

  test('everything dropped for the use-first constraint reaches "ready" with the drop count, not "error"', async () => {
    vi.mocked(hasApiKey).mockResolvedValue(true);
    vi.mocked(generateSuggestions).mockResolvedValue({
      suggestions: [],
      shortfall: null,
      droppedForConstraint: 4,
      droppedForDiet: 0,
    });
    const localDate = localDateString();

    const result = await getOrGenerateSuggestions({ localDate, mode: 'tonight' });

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.set.suggestions).toHaveLength(0);
      expect(result.set.droppedForConstraint).toBe(4);
    }
  });
});

describe('getOrGenerateSuggestions — the pool re-selects for free (task 7.3/7.4)', () => {
  const POOL_A: Suggestion = {
    dish: 'Familiar Later',
    reasons: [{ kind: 'matches_history', label: 'uses what is on hand' }],
    kcalPerServing: 400,
    servings: 2,
    effortMinutes: 20,
    uses: [{ canonicalId: 'soy-sauce-light', qty: 1, unit: 'ml' }],
    missing: [],
    method: [],
  };
  const POOL_B: Suggestion = { ...POOL_A, dish: 'Generic Other' };

  test('a dish becoming frequent between two reads re-ranks the cache with no new request', async () => {
    vi.mocked(hasApiKey).mockResolvedValue(true);
    vi.mocked(generateSuggestions).mockResolvedValue({
      suggestions: [POOL_A, POOL_B],
      shortfall: null,
      droppedForConstraint: 0,
      droppedForDiet: 0,
    });
    const localDate = localDateString();

    const first = await getOrGenerateSuggestions({ localDate, mode: 'tonight' });
    expect(first.status).toBe('ready');
    if (first.status === 'ready') {
      // Tied on every term before either dish has any history behind it —
      // pool order breaks the tie.
      expect(first.set.suggestions.map((s) => s.dish)).toEqual(['Familiar Later', 'Generic Other']);
      expect(first.set.pool.map((s) => s.dish)).toEqual(['Familiar Later', 'Generic Other']);
    }
    expect(generateSuggestions).toHaveBeenCalledTimes(1);

    // "Generic Other" becomes a frequent dish — recorded well outside the
    // recently-eaten window, so the cache's fingerprint (which only reads
    // recentlyEaten) does not change.
    const tenDaysAgo = localDateString(new Date(Date.now() - 10 * 86_400_000));
    const twentyDaysAgo = localDateString(new Date(Date.now() - 20 * 86_400_000));
    for (const date of [tenDaysAgo, twentyDaysAgo]) {
      await insertMeal({
        loggedAt: `${date}T19:00:00.000Z`,
        localDate: date,
        mealType: 'dinner',
        name: 'Generic Other',
        photoUri: null,
        source: 'manual',
        confidence: null,
        venue: 'home',
        servingsMult: 1,
        items: [],
      });
    }

    const second = await getOrGenerateSuggestions({ localDate, mode: 'tonight' });
    expect(second.status).toBe('ready');
    if (second.status === 'ready') {
      expect(second.fromCache).toBe(true);
      // Re-selected from the same cached pool, now favouring the dish
      // that became frequent — order changed with no new request.
      expect(second.set.suggestions.map((s) => s.dish)).toEqual(['Generic Other', 'Familiar Later']);
    }
    // Still just the one call from the cold-cache read above.
    expect(generateSuggestions).toHaveBeenCalledTimes(1);
  });

  test('newly-urgent stock changes the fingerprint and forces regeneration, unlike a re-selection change', async () => {
    vi.mocked(hasApiKey).mockResolvedValue(true);
    vi.mocked(generateSuggestions).mockResolvedValue({
      suggestions: [POOL_A, POOL_B],
      shortfall: null,
      droppedForConstraint: 0,
      droppedForDiet: 0,
    });
    const localDate = localDateString();

    await getOrGenerateSuggestions({ localDate, mode: 'tonight' });
    expect(generateSuggestions).toHaveBeenCalledTimes(1);

    // Stock crossing into use_first changes `urgentStock`, one of
    // `computeFingerprint`'s inputs — unlike the frequent-dish change
    // above, this must not be satisfiable by re-selecting from the old pool.
    await insertPantryItem({
      canonicalId: 'chicken-breast',
      locationId: 'fridge',
      qtyRemaining: 300,
      qtyUnit: 'g',
      expiresAt: localDateString(new Date(Date.now() + 1 * 86_400_000)),
    });

    const second = await getOrGenerateSuggestions({ localDate, mode: 'tonight' });
    expect(second.status).toBe('ready');
    if (second.status === 'ready') {
      expect(second.fromCache).toBe(false);
    }
    expect(generateSuggestions).toHaveBeenCalledTimes(2);
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
