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
  getProfile,
  getPantryItem,
  insertMeal,
  insertPantryItem,
  loadSeedData,
  clearSuggestionPreference,
  saveSuggestionPreference,
  saveProfile,
} from '../src/db/queries';
import { depleteForMeal } from '../src/logic/depletionService';
import {
  getOrGenerateSuggestions,
  mealFromSuggestion,
  nutritionFromSuggestion,
} from '../src/logic/suggestionService';
import { localDateString } from '../src/logic/dates';
import type { CanonicalItem, Profile, Suggestion } from '../src/types';
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
    const profile: Profile = {
      sex: 'female', age: 30, heightCm: 170, weightKg: 65, activityLevel: 'moderate',
      goal: 'maintain', targetCalories: 2000, targetSource: 'estimated', statedCalories: null,
      statedFigureKind: null, proteinPct: 0.3, carbsPct: 0.4, fatPct: 0.3,
      fibreTargetG: 30, units: 'metric', onboardedAt: '2026-01-01',
      targetWeightKg: null, weightGoalRateKgPerWeek: null,
    };
    await saveProfile(profile);

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

  test('a saved intent and speed have their own cache identity, without changing the profile', async () => {
    vi.mocked(hasApiKey).mockResolvedValue(true);
    const localDate = localDateString();
    const profile: Profile = {
      sex: 'female', age: 30, heightCm: 170, weightKg: 65, activityLevel: 'moderate',
      goal: 'maintain', targetCalories: 2000, targetSource: 'estimated', statedCalories: null,
      statedFigureKind: null, proteinPct: 0.3, carbsPct: 0.4, fatPct: 0.3,
      fibreTargetG: 30, units: 'metric', onboardedAt: '2026-01-01',
      targetWeightKg: null, weightGoalRateKgPerWeek: null,
    };
    await saveProfile(profile);

    await getOrGenerateSuggestions({ localDate, mode: 'tonight' });
    await saveSuggestionPreference('protein_forward', 'quick');
    const tuned = await getOrGenerateSuggestions({ localDate, mode: 'tonight' });
    const reopened = await getOrGenerateSuggestions({ localDate, mode: 'tonight' });

    expect(tuned).toMatchObject({ status: 'ready', fromCache: false });
    expect(reopened).toMatchObject({ status: 'ready', fromCache: true });
    expect(generateSuggestions).toHaveBeenCalledTimes(2);
    expect(vi.mocked(generateSuggestions).mock.calls[1]?.[0]).toMatchObject({
      mode: 'tonight',
      tonightPreference: { baseIntent: 'protein_forward', prepSpeed: 'quick', source: 'saved' },
    });
    expect(await getProfile()).toEqual(profile);

    await saveProfile({ ...profile, goal: 'lose' });
    const stillSaved = await getOrGenerateSuggestions({ localDate, mode: 'tonight' });
    expect(stillSaved).toMatchObject({
      status: 'ready', fromCache: true,
      set: { tonightPreference: { baseIntent: 'protein_forward', prepSpeed: 'quick', source: 'saved' } },
    });

    await clearSuggestionPreference();
    const reset = await getOrGenerateSuggestions({ localDate, mode: 'tonight' });
    expect(reset).toMatchObject({
      status: 'ready', fromCache: false,
      set: { tonightPreference: { baseIntent: 'lighter_portions', prepSpeed: 'standard', source: 'profile_default' } },
    });
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

  test('a macro-gap target has a cache entry distinct from tonight and reopens without a call', async () => {
    vi.mocked(hasApiKey).mockResolvedValue(true);
    const localDate = localDateString();
    await saveProfile({
      sex: 'female', age: 30, heightCm: 170, weightKg: 65, activityLevel: 'moderate',
      goal: 'maintain', targetCalories: 2000, targetSource: 'estimated', statedCalories: null,
      statedFigureKind: null, proteinPct: 0.3, carbsPct: 0.4, fatPct: 0.3,
      fibreTargetG: 30, units: 'metric', onboardedAt: '2026-01-01',
      targetWeightKg: null, weightGoalRateKgPerWeek: null,
    });
    await insertPantryItem({
      canonicalId: 'chicken-breast', locationId: 'fridge', qtyRemaining: 500, qtyUnit: 'g',
    });

    await getOrGenerateSuggestions({ localDate, mode: 'tonight' });
    const first = await getOrGenerateSuggestions({
      localDate, mode: 'macro_gap', targetMacro: 'protein',
    });
    const second = await getOrGenerateSuggestions({
      localDate, mode: 'macro_gap', targetMacro: 'protein',
    });

    expect(first.status).toBe('ready');
    expect(second).toMatchObject({ status: 'ready', fromCache: true });
    expect(generateSuggestions).toHaveBeenCalledTimes(2);
    expect(vi.mocked(generateSuggestions).mock.calls[1]?.[0]).toMatchObject({
      mode: 'macro_gap', targetMacro: 'protein',
      tonightPreference: null,
    });
  });

  test('stretch does not carry a tonight preference', async () => {
    vi.mocked(hasApiKey).mockResolvedValue(true);
    const localDate = localDateString();
    const result = await getOrGenerateSuggestions({
      localDate, mode: 'stretch', untilDate: localDate,
    });
    expect(result.status).toBe('ready');
    expect(vi.mocked(generateSuggestions).mock.calls[0]?.[0]).toMatchObject({
      mode: 'stretch', tonightPreference: null,
    });
  });

  test('does not invent a macro gap when an earlier meal has an unknown target macro', async () => {
    vi.mocked(hasApiKey).mockResolvedValue(true);
    const localDate = localDateString();
    await saveProfile({
      sex: 'female', age: 30, heightCm: 170, weightKg: 65, activityLevel: 'moderate',
      goal: 'maintain', targetCalories: 2000, targetSource: 'estimated', statedCalories: null,
      statedFigureKind: null, proteinPct: 0.3, carbsPct: 0.4, fatPct: 0.3,
      fibreTargetG: 30, units: 'metric', onboardedAt: '2026-01-01',
      targetWeightKg: null, weightGoalRateKgPerWeek: null,
    });
    await insertMeal({
      loggedAt: `${localDate}T12:00:00.000Z`, localDate, mealType: 'lunch', name: 'Unknown meal',
      photoUri: null, source: 'suggestion', confidence: null,
      items: [{
        name: 'Unknown sauce', quantity: 1, unit: 'serving', calories: 100,
        proteinG: null, carbsG: 0, fatG: 0, isManualAddition: false,
      }],
    });

    const result = await getOrGenerateSuggestions({
      localDate, mode: 'macro_gap', targetMacro: 'protein',
    });
    expect(result).toEqual({
      status: 'insufficient_data', targetMacro: 'protein', reason: 'consumed_total_unknown',
    });
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
    // Nutrition lands on the dish item; ingredient items are not double-counted.
    const dishItem = meal.items.find((item) => !item.canonicalId);
    expect(dishItem?.calories).toBe(nutritionFromSuggestion(FAKE_SUGGESTION, canonicals).calories);
    expect(ingredientItems.every((item) => item.calories === 0)).toBe(true);
  });

  test('uses a whole-dish provider estimate only when local recipe nutrition is unresolved', () => {
    const suggestion: Suggestion = {
      ...FAKE_SUGGESTION,
      uses: [{ canonicalId: 'unknown-ingredient', qty: 100, unit: 'g' }],
      estimatedNutritionPerServing: {
        calories: 320, proteinG: 24, carbsG: 16, fatG: 12, source: 'provider',
      },
    };
    const nutrition = nutritionFromSuggestion(suggestion, canonicals);
    expect(nutrition).toMatchObject({ calories: 320, proteinG: 24, carbsG: 16, fatG: 12 });
  });

  test('keeps complete local recipe nutrition ahead of a conflicting provider estimate', () => {
    const suggestion: Suggestion = {
      ...FAKE_SUGGESTION,
      estimatedNutritionPerServing: {
        calories: 999, proteinG: 999, carbsG: 999, fatG: 999, source: 'provider',
      },
    };
    expect(nutritionFromSuggestion(suggestion, canonicals)).toEqual(
      nutritionFromSuggestion(FAKE_SUGGESTION, canonicals),
    );
  });

  test('stores unresolved recipe nutrients as null while keeping the meal loggable', () => {
    const suggestion: Suggestion = {
      ...FAKE_SUGGESTION,
      uses: [{ canonicalId: 'unknown-ingredient', qty: 100, unit: 'g' }],
      estimatedNutritionPerServing: null,
    };
    const meal = mealFromSuggestion({
      suggestion, servingsMade: suggestion.servings, localDate: '2026-06-01', canonicals,
    });
    const dishItem = meal.items.find((item) => !item.canonicalId);
    expect(dishItem).toMatchObject({ calories: null, proteinG: null, carbsG: null, fatG: null });
    expect(meal.items.find((item) => item.canonicalId)?.canonicalId).toBe('unknown-ingredient');
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
