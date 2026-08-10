import { describe, expect, test } from 'vitest';

import { parseSuggestResponse } from '../src/api/suggest';
import { buildSuggestUserPrompt, SUGGEST_SYSTEM_PROMPT } from '../src/api/suggestPrompt';
import type { ExclusionSet } from '../src/logic/dietary';
import { KITCHENS } from '../src/logic/__fixtures__/kitchens';
import { bucketStock, shapeStockPayload, summarisePersonalisation } from '../src/logic/suggest';

/**
 * Shape assertions against the fixture kitchens' recorded responses — no
 * provider in the loop. This is the corpus the design calls for: the
 * honest risk here is boredom, not a crash, and nothing that only checks
 * for exceptions catches four days of stir fry.
 */

/** No dietary rules recorded — every test here is unaffected by `add-dietary-profile`. */
const EMPTY_EXCLUSION: ExclusionSet = { canonicalIds: new Set(), unresolvedText: new Set() };

function payloadFor(kitchen: (typeof KITCHENS)[number]) {
  const canonicals = new Map(kitchen.canonicals.map((c) => [c.id, c]));
  const bucketed = bucketStock(kitchen.items, canonicals, kitchen.today);
  const stock = shapeStockPayload(bucketed);
  const personalisation = summarisePersonalisation(kitchen.history, kitchen.today);
  const useFirstIds = new Set(bucketed.use_first.map((entry) => entry.canonical.id));
  return { bucketed, stock, personalisation, useFirstIds };
}

describe('parseSuggestResponse, against every fixture kitchen', () => {
  test('every recorded response parses into at least one usable suggestion', () => {
    for (const kitchen of KITCHENS) {
      const { stock, useFirstIds } = payloadFor(kitchen);
      const candidateIds = new Set(
        [...stock.full, ...stock.compressed].map((line) => line.canonicalId),
      );
      const result = parseSuggestResponse(kitchen.recordedResponse, candidateIds, useFirstIds, EMPTY_EXCLUSION, false);
      expect(result.suggestions.length, kitchen.name).toBeGreaterThan(0);
    }
  });

  test('every suggestion in every kitchen uses at least one urgent item, where one exists', () => {
    for (const kitchen of KITCHENS) {
      const { bucketed, stock, useFirstIds } = payloadFor(kitchen);
      if (bucketed.use_first.length === 0) continue; // covered separately below

      const candidateIds = new Set(
        [...stock.full, ...stock.compressed].map((line) => line.canonicalId),
      );
      const result = parseSuggestResponse(kitchen.recordedResponse, candidateIds, useFirstIds, EMPTY_EXCLUSION, false);

      for (const suggestion of result.suggestions) {
        const usesUrgent = suggestion.uses.some((use) => useFirstIds.has(use.canonicalId));
        expect(usesUrgent, `${kitchen.name}: "${suggestion.dish}"`).toBe(true);
      }
    }
  });

  test('the nothing-urgent kitchen still yields suggestions with no use_first constraint to satisfy', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'nothing urgent')!;
    const { bucketed, stock, useFirstIds } = payloadFor(kitchen);
    expect(bucketed.use_first).toEqual([]);

    const candidateIds = new Set(
      [...stock.full, ...stock.compressed].map((line) => line.canonicalId),
    );
    const result = parseSuggestResponse(kitchen.recordedResponse, candidateIds, useFirstIds, EMPTY_EXCLUSION, false);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  test('no suggestion repeats a recently-eaten dish', () => {
    for (const kitchen of KITCHENS) {
      const { stock, personalisation, useFirstIds } = payloadFor(kitchen);
      const candidateIds = new Set(
        [...stock.full, ...stock.compressed].map((line) => line.canonicalId),
      );
      const result = parseSuggestResponse(kitchen.recordedResponse, candidateIds, useFirstIds, EMPTY_EXCLUSION, false);
      const recentlyEaten = new Set(personalisation.recentlyEaten);

      for (const suggestion of result.suggestions) {
        expect(recentlyEaten.has(suggestion.dish), kitchen.name).toBe(false);
      }
    }
  });

  test('the set mixes familiar with unfamiliar in the personalised kitchen', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'well-stocked Asian pantry')!;
    const { stock, useFirstIds } = payloadFor(kitchen);
    const candidateIds = new Set(
      [...stock.full, ...stock.compressed].map((line) => line.canonicalId),
    );
    const result = parseSuggestResponse(kitchen.recordedResponse, candidateIds, useFirstIds, EMPTY_EXCLUSION, false);

    // At least one dish resembles the frequent "Gochujang pork stir-fry",
    // and at least one departs from it — asserted on the reason tags,
    // which the fixture wrote to say so honestly.
    const familiar = result.suggestions.some((s) =>
      s.reasons.some((r) => r.label.toLowerCase().includes('make this a lot')),
    );
    const unfamiliar = result.suggestions.some((s) =>
      s.reasons.some((r) => r.label.toLowerCase().includes('stretch')),
    );
    expect(familiar).toBe(true);
    expect(unfamiliar).toBe(true);
  });

  test('every suggestion carries at least one reason grounded in a real fact', () => {
    for (const kitchen of KITCHENS) {
      const { stock, useFirstIds } = payloadFor(kitchen);
      const candidateIds = new Set(
        [...stock.full, ...stock.compressed].map((line) => line.canonicalId),
      );
      const result = parseSuggestResponse(kitchen.recordedResponse, candidateIds, useFirstIds, EMPTY_EXCLUSION, false);
      for (const suggestion of result.suggestions) {
        expect(suggestion.reasons.length, `${kitchen.name}: ${suggestion.dish}`).toBeGreaterThan(0);
      }
    }
  });

  test('the prompt states the use_first constraint as a rule, not an ordering', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'costly protein expiring tomorrow')!;
    const { stock, personalisation } = payloadFor(kitchen);
    const prompt = buildSuggestUserPrompt({
      mode: 'tonight',
      stock,
      personalisation,
      remainingCalories: 800,
      macroGap: { calories: 0, proteinG: 30, carbsG: 0, fatG: 0 },
      dietaryRules: [],
    });
    const parsed = JSON.parse(prompt) as { use_first: unknown[] };
    expect(parsed.use_first.length).toBeGreaterThan(0);
  });

  test('only tonight carries typed template framing', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'costly protein expiring tomorrow')!;
    const { stock, personalisation } = payloadFor(kitchen);
    const tonight = JSON.parse(buildSuggestUserPrompt({
      mode: 'tonight', stock, personalisation, remainingCalories: 800,
      macroGap: { calories: 0, proteinG: 30, carbsG: 0, fatG: 0 }, dietaryRules: [],
      tonightPreference: { baseIntent: 'protein_forward', prepSpeed: 'quick', source: 'saved' },
    }));
    const macro = JSON.parse(buildSuggestUserPrompt({
      mode: 'macro_gap', targetMacro: 'protein', stock, personalisation,
      remainingCalories: 800, macroGap: { calories: 0, proteinG: 30, carbsG: 0, fatG: 0 },
      macroGapContext: { shortfallG: 30, bestAchievableG: 12, partialCoverage: true }, dietaryRules: [],
      tonightPreference: null,
    }));
    expect(tonight.tonight_preference).toMatchObject({
      base_intent: 'protein_forward', prep_speed: 'quick',
    });
    expect(macro.tonight_preference).toBeNull();
  });

  test('a macro-gap prompt carries the measurable shortfall and qualification', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'costly protein expiring tomorrow')!;
    const { stock, personalisation } = payloadFor(kitchen);
    const prompt = buildSuggestUserPrompt({
      mode: 'macro_gap', targetMacro: 'protein', stock, personalisation,
      remainingCalories: 800, macroGap: { calories: 0, proteinG: 30, carbsG: 0, fatG: 0 },
      macroGapContext: { shortfallG: 30, bestAchievableG: 12, partialCoverage: true }, dietaryRules: [],
    });
    expect(JSON.parse(prompt).macro_gap_request).toEqual({
      shortfall_g: 30, best_measurable_pantry_contribution_g: 12, catalogue_coverage_is_partial: true,
    });
  });

  test('the provider contract asks for an explicit whole-dish estimate', () => {
    expect(SUGGEST_SYSTEM_PROMPT).toContain('estimated_nutrition_per_serving');
  });
});

describe('parseSuggestResponse — the refusal to invent an id', () => {
  test('keeps a complete provider estimate labelled and rejects a partial one', () => {
    const candidateIds = new Set(['real-id']);
    const suggestion = {
      dish: 'Test dish', reason_tags: ['uses what is on hand'], kcal_per_serving: 400,
      servings: 1, effort_minutes: 10,
      uses: [{ canonical_id: 'real-id', qty: 1, unit: 'g' }], missing: [], method: [],
    };
    const raw = JSON.stringify({ suggestions: [
      {
        ...suggestion,
        estimated_nutrition_per_serving: {
          calories: 420, protein_g: 33, carbs_g: 12, fat_g: 20,
        },
      },
      {
        ...suggestion,
        dish: 'Partial estimate',
        estimated_nutrition_per_serving: { calories: 420, protein_g: 33 },
      },
    ] });

    const result = parseSuggestResponse(raw, candidateIds, new Set(), EMPTY_EXCLUSION, false);
    expect(result.suggestions[0]?.estimatedNutritionPerServing).toEqual({
      calories: 420, proteinG: 33, carbsG: 12, fatG: 20, source: 'provider',
    });
    expect(result.suggestions[1]?.estimatedNutritionPerServing).toBeNull();
  });

  test('a uses entry citing an unknown canonical id is dropped, not the suggestion', () => {
    const candidateIds = new Set(['real-id']);
    const raw = JSON.stringify({
      suggestions: [
        {
          dish: 'Test dish',
          reason_tags: ['uses what is on hand'],
          kcal_per_serving: 400,
          servings: 1,
          effort_minutes: 10,
          uses: [
            { canonical_id: 'real-id', qty: 1, unit: 'g' },
            { canonical_id: 'invented-id', qty: 1, unit: 'g' },
          ],
          missing: [],
          method: [],
        },
      ],
    });
    const result = parseSuggestResponse(raw, candidateIds, new Set(), EMPTY_EXCLUSION, false);
    expect(result.suggestions.length).toBe(1);
    expect(result.suggestions[0]?.uses).toEqual([{ canonicalId: 'real-id', qty: 1, unit: 'g' }]);
  });

  test('a suggestion left with no valid uses is dropped entirely', () => {
    const candidateIds = new Set(['real-id']);
    const raw = JSON.stringify({
      suggestions: [
        {
          dish: 'All invented',
          reason_tags: ['uses what is on hand'],
          kcal_per_serving: 400,
          servings: 1,
          effort_minutes: 10,
          uses: [{ canonical_id: 'invented-id', qty: 1, unit: 'g' }],
          missing: [],
          method: [],
        },
        {
          dish: 'Real dish',
          reason_tags: ['uses what is on hand'],
          kcal_per_serving: 400,
          servings: 1,
          effort_minutes: 10,
          uses: [{ canonical_id: 'real-id', qty: 1, unit: 'g' }],
          missing: [],
          method: [],
        },
      ],
    });
    const result = parseSuggestResponse(raw, candidateIds, new Set(), EMPTY_EXCLUSION, false);
    expect(result.suggestions.map((s) => s.dish)).toEqual(['Real dish']);
  });

  test('a missing entry with an invented id keeps the name but nulls the id', () => {
    const candidateIds = new Set(['real-id']);
    const raw = JSON.stringify({
      suggestions: [
        {
          dish: 'Test dish',
          reason_tags: ['uses what is on hand'],
          kcal_per_serving: 400,
          servings: 1,
          effort_minutes: 10,
          uses: [{ canonical_id: 'real-id', qty: 1, unit: 'g' }],
          missing: [{ canonical_id: 'invented-id', name: 'egg', note: null }],
          method: [],
        },
      ],
    });
    const result = parseSuggestResponse(raw, candidateIds, new Set(), EMPTY_EXCLUSION, false);
    expect(result.suggestions[0]?.missing).toEqual([
      { canonicalId: null, name: 'egg', note: null },
    ]);
  });

  test('prose instead of JSON throws so the caller can fail the batch, not the app', () => {
    expect(() => parseSuggestResponse('Sorry, I cannot help.', new Set(), new Set(), EMPTY_EXCLUSION, false)).toThrow();
  });
});

describe('parseSuggestResponse — dietary exclusion runs after use-first (add-dietary-profile task 6.2/6.3)', () => {
  function suggestionOf(dish: string, canonicalId: string) {
    return {
      dish,
      reason_tags: ['uses what is on hand'],
      kcal_per_serving: 400,
      servings: 1,
      effort_minutes: 10,
      uses: [{ canonical_id: canonicalId, qty: 1, unit: 'g' }],
      missing: [],
      method: [],
    };
  }

  test('an allergen match is dropped and counted separately from a use-first drop', () => {
    const candidateIds = new Set(['urgent-id', 'allergen-id', 'other-id']);
    const useFirstIds = new Set(['urgent-id']);
    const exclusionSet: ExclusionSet = {
      canonicalIds: new Set(['allergen-id']),
      unresolvedText: new Set(),
    };
    // The third suggestion clears use-first (so it survives the first
    // drop) and also contains the allergen (so the second drop catches it).
    const raw = JSON.stringify({
      suggestions: [
        suggestionOf('Uses the urgent item', 'urgent-id'),
        suggestionOf('Ignores the urgent item', 'other-id'),
        {
          dish: 'Contains the allergen and the urgent item',
          reason_tags: ['uses what is on hand'],
          kcal_per_serving: 400,
          servings: 1,
          effort_minutes: 10,
          uses: [
            { canonical_id: 'urgent-id', qty: 1, unit: 'g' },
            { canonical_id: 'allergen-id', qty: 1, unit: 'g' },
          ],
          missing: [],
          method: [],
        },
      ],
    });

    const result = parseSuggestResponse(raw, candidateIds, useFirstIds, exclusionSet, false);

    expect(result.suggestions.map((s) => s.dish)).toEqual(['Uses the urgent item']);
    expect(result.droppedForConstraint).toBe(1); // "Ignores the urgent item"
    expect(result.droppedForDiet).toBe(1); // "Contains the allergen..."
  });

  test('an unresolved missing ingredient excludes only when an allergen rule is recorded', () => {
    const candidateIds = new Set(['real-id']);
    const raw = JSON.stringify({
      suggestions: [
        {
          dish: 'Names an uncatalogued ingredient',
          reason_tags: ['uses what is on hand'],
          kcal_per_serving: 400,
          servings: 1,
          effort_minutes: 10,
          uses: [{ canonical_id: 'real-id', qty: 1, unit: 'g' }],
          missing: [{ canonical_id: null, name: 'seafood stock', note: null }],
          method: [],
        },
      ],
    });

    // With an allergen rule recorded, the one suggestion is excluded and
    // nothing survives — a rule doing its job, not a provider failure
    // (decision 178). The empty result is returned, not thrown.
    const withAllergen = parseSuggestResponse(
      raw,
      candidateIds,
      new Set(),
      EMPTY_EXCLUSION,
      true,
    );
    expect(withAllergen.suggestions).toHaveLength(0);
    expect(withAllergen.droppedForDiet).toBe(1);

    // With no allergen rule, the same unresolved ingredient is not treated
    // as unsafe, and the suggestion survives.
    const withoutAllergen = parseSuggestResponse(
      raw,
      candidateIds,
      new Set(),
      EMPTY_EXCLUSION,
      false,
    );
    expect(withoutAllergen.suggestions).toHaveLength(1);
  });
});

describe('parseSuggestResponse — the use-first constraint is enforced locally (task 11)', () => {
  function suggestionOf(dish: string, canonicalId: string) {
    return {
      dish,
      reason_tags: ['uses what is on hand'],
      kcal_per_serving: 400,
      servings: 1,
      effort_minutes: 10,
      uses: [{ canonical_id: canonicalId, qty: 1, unit: 'g' }],
      missing: [],
      method: [],
    };
  }

  test('a suggestion that ignores a non-empty use_first bucket is dropped, not repaired', () => {
    const candidateIds = new Set(['urgent-id', 'other-id']);
    const useFirstIds = new Set(['urgent-id']);
    const raw = JSON.stringify({
      suggestions: [
        suggestionOf('Uses the urgent item', 'urgent-id'),
        suggestionOf('Ignores it entirely', 'other-id'),
      ],
    });

    const result = parseSuggestResponse(raw, candidateIds, useFirstIds, EMPTY_EXCLUSION, false);

    expect(result.suggestions.map((s) => s.dish)).toEqual(['Uses the urgent item']);
    expect(result.droppedForConstraint).toBe(1);
  });

  test('an empty use_first bucket applies no constraint', () => {
    const candidateIds = new Set(['other-id']);
    const raw = JSON.stringify({
      suggestions: [suggestionOf('Anything goes', 'other-id')],
    });

    const result = parseSuggestResponse(raw, candidateIds, new Set(), EMPTY_EXCLUSION, false);

    expect(result.suggestions.map((s) => s.dish)).toEqual(['Anything goes']);
    expect(result.droppedForConstraint).toBe(0);
  });

  test('every suggestion ignoring the constraint leaves an empty result, not a thrown failure (decision 178)', () => {
    const candidateIds = new Set(['other-id']);
    const useFirstIds = new Set(['urgent-id']);
    const raw = JSON.stringify({
      suggestions: [suggestionOf('Ignores it entirely', 'other-id')],
    });

    const result = parseSuggestResponse(raw, candidateIds, useFirstIds, EMPTY_EXCLUSION, false);
    expect(result.suggestions).toHaveLength(0);
    expect(result.droppedForConstraint).toBe(1);
  });

  test('nothing parseable at all is still a thrown failure — malformed means unreadable, not empty', () => {
    const candidateIds = new Set(['other-id']);
    const raw = JSON.stringify({ suggestions: [{ dish: '' }] }); // fails toSuggestion entirely
    expect(() =>
      parseSuggestResponse(raw, candidateIds, new Set(), EMPTY_EXCLUSION, false),
    ).toThrow();
  });
});
