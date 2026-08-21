import { describe, expect, test } from 'vitest';

import { canonical, item, KITCHENS } from '@/logic/__fixtures__/kitchens';
import {
  bucketFor,
  bucketStock,
  DEFAULT_VALUE_CENTS,
  FREEZABLE_DISCOUNT,
  HISTORY_WINDOW_DAYS,
  RECENTLY_EATEN_DAYS,
  REPEAT_THRESHOLD,
  shapeStockPayload,
  summarisePersonalisation,
  urgency,
  USE_FIRST_DAYS,
  USE_SOON_DAYS,
  evaluateMealBudget,
  nutritionProvenanceForSuggestion,
  sortSuggestionsByBudget,
} from '@/logic/suggest';
import type { Suggestion } from '@/types';

const TODAY = '2026-06-10';

function suggestion(dish: string, kcalPerServing: number): Suggestion {
  return { dish, kcalPerServing, servings: 1, effortMinutes: 20, reasons: [], uses: [], missing: [], method: [] };
}

describe('swipe deck budget evaluation', () => {
  test('calculates remaining calories and all three classifications at the inclusive boundary', () => {
    expect(evaluateMealBudget(2_000, 1_400, 675)).toMatchObject({ remainingCalories: 600, deltaCalories: 75, classification: 'exact-fit' });
    expect(evaluateMealBudget(2_000, 1_400, 300)?.classification).toBe('fits-budget');
    expect(evaluateMealBudget(2_000, 1_400, 700)?.classification).toBe('over-budget');
  });

  test('a negative remaining budget does not disguise a positive meal as an exact fit', () => {
    expect(evaluateMealBudget(1_800, 2_000, 100)?.classification).toBe('over-budget');
  });

  test('rejects non-finite input instead of manufacturing a classification', () => {
    expect(evaluateMealBudget(2_000, Number.NaN, 500)).toBeNull();
  });

  test('sorts exact fits before fits-budget and over-budget, stably within ties', () => {
    const meals = [suggestion('over', 800), suggestion('low', 300), suggestion('exact', 625), suggestion('low tie', 300)];
    expect(sortSuggestionsByBudget(meals, 2_000, 1_400).map((meal) => meal.dish))
      .toEqual(['exact', 'low', 'low tie', 'over']);
  });
});

describe('suggestion nutrition provenance', () => {
  const complete = canonical({ id: 'complete', displayName: 'Complete', kcalPer100: 100, proteinPer100: 10, carbsPer100: 10, fatPer100: 2 });
  const incomplete = canonical({ id: 'incomplete', displayName: 'Incomplete', kcalPer100: null });

  test('marks fully catalogued ingredients as catalogue nutrition', () => {
    const meal = { ...suggestion('Known', 400), uses: [{ canonicalId: 'complete', qty: 100, unit: 'g' as const }] };
    expect(nutritionProvenanceForSuggestion(meal, new Map([['complete', complete]]))).toEqual({ provenance: 'catalogue', estimated: false, missingCatalogueCanonicalIds: [] });
  });

  test('flags provider fallback when an ingredient lacks catalogue nutrition', () => {
    const meal = { ...suggestion('Estimated', 400), uses: [{ canonicalId: 'incomplete', qty: 100, unit: 'g' as const }], estimatedNutritionPerServing: { calories: 400, proteinG: 20, carbsG: 30, fatG: 10, source: 'provider' as const } };
    expect(nutritionProvenanceForSuggestion(meal, new Map([['incomplete', incomplete]]))).toEqual({ provenance: 'provider-estimate', estimated: true, missingCatalogueCanonicalIds: ['incomplete'] });
  });

  test('missing recipe items stay incomplete without inventing a provider source', () => {
    const meal = { ...suggestion('Gap', 400), missing: [{ canonicalId: null, name: 'Herbs', note: null }] };
    expect(nutritionProvenanceForSuggestion(meal, new Map()).provenance).toBe('incomplete');
  });
});

describe('bucketFor', () => {
  test('follows decision 34\'s table', () => {
    expect(bucketFor(0)).toBe('use_first');
    expect(bucketFor(USE_FIRST_DAYS)).toBe('use_first');
    expect(bucketFor(USE_FIRST_DAYS + 1)).toBe('use_soon');
    expect(bucketFor(USE_SOON_DAYS)).toBe('use_soon');
    expect(bucketFor(USE_SOON_DAYS + 1)).toBe('available');
    expect(bucketFor(null)).toBe('available');
  });

  test('an already-expired item still lands in use_first', () => {
    expect(bucketFor(-3)).toBe('use_first');
  });

  test('uses a catalogue warning threshold without weakening use_first', () => {
    expect(bucketFor(8, 5)).toBe('available');
    expect(bucketFor(5, 5)).toBe('use_soon');
    expect(bucketFor(USE_FIRST_DAYS, 1)).toBe('use_first');
  });
});

describe('urgency', () => {
  const rice = canonical({ id: 'x', displayName: 'x', shelfLifeDays: { pantry: 100 } });

  test('value at risk separates equally-dated items', () => {
    const expensive = item({ canonicalId: 'x', priceCents: 800, expiresAt: '2026-06-11' });
    const cheap = item({ canonicalId: 'x', priceCents: 40, expiresAt: '2026-06-11' });
    expect(urgency(expensive, rice, TODAY)).toBeGreaterThan(
      urgency(cheap, rice, TODAY),
    );
  });

  test('freezable stock ranks less urgent than non-freezable, same date', () => {
    const freezable = canonical({
      id: 'f',
      displayName: 'f',
      shelfLifeDays: { fridge: 5, freezer: 200 },
    });
    const notFreezable = canonical({
      id: 'nf',
      displayName: 'nf',
      shelfLifeDays: { fridge: 5 },
    });
    const a = item({ canonicalId: 'f', priceCents: 500, expiresAt: '2026-06-12' });
    const b = item({ canonicalId: 'nf', priceCents: 500, expiresAt: '2026-06-12' });
    expect(urgency(a, freezable, TODAY)).toBeCloseTo(
      urgency(b, notFreezable, TODAY) * FREEZABLE_DISCOUNT,
    );
    expect(urgency(a, freezable, TODAY)).toBeLessThan(
      urgency(b, notFreezable, TODAY),
    );
  });

  test('an unpriced item still contributes via the default value', () => {
    const unpriced = item({ canonicalId: 'x', priceCents: null, expiresAt: '2026-06-11' });
    const priced = item({
      canonicalId: 'x',
      priceCents: DEFAULT_VALUE_CENTS,
      expiresAt: '2026-06-11',
    });
    expect(urgency(unpriced, rice, TODAY)).toBeCloseTo(urgency(priced, rice, TODAY));
  });

  test('no expiry date means no urgency', () => {
    const undated = item({ canonicalId: 'x', priceCents: 999 });
    expect(urgency(undated, rice, TODAY)).toBe(0);
  });

  test('urgency decreases as the date recedes', () => {
    const soon = item({ canonicalId: 'x', priceCents: 500, expiresAt: '2026-06-11' });
    const later = item({ canonicalId: 'x', priceCents: 500, expiresAt: '2026-07-11' });
    expect(urgency(soon, rice, TODAY)).toBeGreaterThan(urgency(later, rice, TODAY));
  });
});

describe('bucketStock, against the fixture kitchens', () => {
  test('every suggestion-eligible kitchen has a non-empty use_first bucket except where nothing is urgent', () => {
    for (const kitchen of KITCHENS) {
      const canonicals = new Map(kitchen.canonicals.map((c) => [c.id, c]));
      const bucketed = bucketStock(kitchen.items, canonicals, kitchen.today);
      const total =
        bucketed.use_first.length + bucketed.use_soon.length + bucketed.available.length;
      expect(total, kitchen.name).toBe(kitchen.items.length);
    }
  });

  test('the costly-protein kitchen ranks the pork belly above the cucumber', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'costly protein expiring tomorrow')!;
    const canonicals = new Map(kitchen.canonicals.map((c) => [c.id, c]));
    const bucketed = bucketStock(kitchen.items, canonicals, kitchen.today);
    const ranked = bucketed.use_first.map((entry) => entry.canonical.id);
    expect(ranked.indexOf('pork-belly')).toBeLessThan(ranked.indexOf('cucumber'));
  });

  test('the freezable-vs-not kitchen ranks the non-freezable item first', () => {
    const kitchen = KITCHENS.find(
      (k) => k.name === 'freezable beside non-freezable, same expiry',
    )!;
    const canonicals = new Map(kitchen.canonicals.map((c) => [c.id, c]));
    const bucketed = bucketStock(kitchen.items, canonicals, kitchen.today);
    const ranked = bucketed.use_first.map((entry) => entry.canonical.id);
    expect(ranked.indexOf('spinach-fresh')).toBeLessThan(
      ranked.indexOf('chicken-breast'),
    );
  });

  test('the nothing-urgent kitchen has an empty use_first bucket', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'nothing urgent')!;
    const canonicals = new Map(kitchen.canonicals.map((c) => [c.id, c]));
    const bucketed = bucketStock(kitchen.items, canonicals, kitchen.today);
    expect(bucketed.use_first).toEqual([]);
  });

  test('passes each canonical warning threshold into bucketing', () => {
    const warningCanonical = canonical({
      id: 'warning-window',
      displayName: 'Warning window',
      earlyWarningDays: 5,
    });
    const warningItem = item({
      canonicalId: warningCanonical.id,
      expiresAt: '2026-06-18',
    });
    const bucketed = bucketStock(
      [warningItem],
      new Map([[warningCanonical.id, warningCanonical]]),
      TODAY,
    );
    expect(bucketed.available).toHaveLength(1);
    expect(bucketed.use_soon).toHaveLength(0);
  });
});

describe('shapeStockPayload', () => {
  test('staples-and-seasonings-only kitchen compresses to summary lines', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'only staples and seasonings')!;
    const canonicals = new Map(kitchen.canonicals.map((c) => [c.id, c]));
    const bucketed = bucketStock(kitchen.items, canonicals, kitchen.today);
    const payload = shapeStockPayload(bucketed);

    expect(payload.full).toEqual([]);
    expect(payload.staplesSummary).toContain('Jasmine rice');
    expect(payload.staplesSummary).toContain('Vegetable oil');
    expect(payload.seasoningsSummary).toContain('Light soy sauce');
    expect(payload.seasoningsSummary).toContain('Gochujang');
  });

  test('urgent and protein/produce items are always sent in full', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'costly protein expiring tomorrow')!;
    const canonicals = new Map(kitchen.canonicals.map((c) => [c.id, c]));
    const bucketed = bucketStock(kitchen.items, canonicals, kitchen.today);
    const payload = shapeStockPayload(bucketed);

    const fullIds = payload.full.map((line) => line.canonicalId);
    expect(fullIds).toContain('pork-belly');
    expect(fullIds).toContain('cucumber');
    // Rice (a staple, available bucket) compresses instead of appearing in full.
    expect(fullIds).not.toContain('jasmine-rice');
    expect(payload.staplesSummary).toContain('Jasmine rice');
  });
});

describe('summarisePersonalisation', () => {
  test('detects a cuisine lean from dish-name keywords', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'well-stocked Asian pantry')!;
    const summary = summarisePersonalisation(kitchen.history, TODAY);
    expect(summary.cuisineLean).not.toBeNull();
    expect(summary.cuisineLean).toMatch(/Korean|Asian/);
  });

  test('a dish cooked twice or more is a repeat', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'well-stocked Asian pantry')!;
    const summary = summarisePersonalisation(kitchen.history, TODAY);
    expect(summary.frequentDishes).toContain('Gochujang pork stir-fry');
  });

  test('a dish eaten within the window is suppressed for suggestion, not for tomorrow', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'well-stocked Asian pantry')!;
    const summary = summarisePersonalisation(kitchen.history, TODAY);
    expect(summary.recentlyEaten).toContain('Kimchi fried rice');
  });

  test('a dish outside the recently-eaten window is not suppressed', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'well-stocked Asian pantry')!;
    const summary = summarisePersonalisation(kitchen.history, TODAY);
    // Cooked 2026-05-20, well outside RECENTLY_EATEN_DAYS of 2026-06-10.
    expect(summary.recentlyEaten).not.toContain('Gochujang pork stir-fry');
  });

  test('no history yields no cuisine lean and no frequent dishes', () => {
    const summary = summarisePersonalisation([], TODAY);
    expect(summary.cuisineLean).toBeNull();
    expect(summary.frequentDishes).toEqual([]);
    expect(summary.recentlyEaten).toEqual([]);
  });

  test('the constants documented in the module match what is asserted here', () => {
    expect(RECENTLY_EATEN_DAYS).toBe(7);
    expect(HISTORY_WINDOW_DAYS).toBe(60);
    expect(REPEAT_THRESHOLD).toBe(2);
  });
});
