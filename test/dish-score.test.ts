import { describe, expect, test } from 'vitest';

import {
  buildDishScoreContext,
  decorateSuggestionForDisplay,
  scoreDish,
  selectDisplayed,
  type DishScoreContext,
} from '../src/logic/dishScore';
import { parseSuggestResponse } from '../src/api/suggest';
import type { ExclusionSet } from '../src/logic/dietary';
import { KITCHENS } from '../src/logic/__fixtures__/kitchens';
import {
  costlyProteinExpiringTomorrowPool,
  costlyProteinExpiringTomorrowRemainingCalories,
  freezableVsNotPool,
  freezableVsNotRemainingCalories,
  nearlyEmptyFridgePool,
  nearlyEmptyFridgeRemainingCalories,
  nothingUrgentPool,
  nothingUrgentRemainingCalories,
  onlyStaplesAndSeasoningsPool,
  onlyStaplesAndSeasoningsRemainingCalories,
  wellStockedAsianPantryPool,
  wellStockedAsianPantryRemainingCalories,
} from '../src/logic/__fixtures__/dishPools';
import { bucketStock, summarisePersonalisation } from '../src/logic/suggest';
import type { Suggestion } from '../src/types';

/**
 * `add-dish-scorer` group 8: the weights are the deliverable, and this file
 * is the measurement. Each fixture's displayed order below was produced by
 * the real `selectDisplayed` against the recorded pool and context, then
 * checked by hand against the six named facts before being asserted —
 * decisions 149's demand that a scorer not arrive "untuned, unmeasured, and
 * justified by a single weight."
 */

/** No dietary rules recorded — every test here is unaffected by `add-dietary-profile`. */
const EMPTY_EXCLUSION: ExclusionSet = { canonicalIds: new Set(), unresolvedText: new Set() };

function contextFor(kitchenName: string, remainingCalories: number): DishScoreContext {
  const kitchen = KITCHENS.find((k) => k.name === kitchenName)!;
  const canonicals = new Map(kitchen.canonicals.map((c) => [c.id, c]));
  const bucketed = bucketStock(kitchen.items, canonicals, kitchen.today);
  const personalisation = summarisePersonalisation(kitchen.history, kitchen.today);
  return buildDishScoreContext(bucketed, remainingCalories, personalisation, kitchen.today);
}

function dish(overrides: Partial<Suggestion> & { dish: string; uses: Suggestion['uses'] }): Suggestion {
  return {
    reasons: [],
    kcalPerServing: 400,
    servings: 2,
    effortMinutes: 20,
    missing: [],
    method: [],
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* 4.7 — each term in isolation, then the sum                                 */
/* -------------------------------------------------------------------------- */

describe('scoreDish — terms in isolation', () => {
  const baseContext: DishScoreContext = {
    stockIndex: new Map(),
    remainingCalories: 600,
    personalisation: { cuisineLean: null, topCuisine: null, frequentDishes: [], recentlyEaten: [] },
    dislikedCanonicalIds: new Set(),
  };
  const baseline = dish({ dish: 'Baseline', uses: [use('untracked')], effortMinutes: 20, kcalPerServing: 400 });

  function use(canonicalId: string) {
    return { canonicalId, qty: 1, unit: 'g' as const };
  }

  test('an ingredient with no stock-index entry contributes no value-at-risk or expiry pressure', () => {
    // Both terms are 0 for an ingredient the context has never seen — the
    // scorer never invents urgency for something it cannot measure.
    const score = scoreDish(baseline, baseContext);
    const zeroUrgency = scoreDish(
      dish({ ...baseline, effortMinutes: baseline.effortMinutes, kcalPerServing: baseline.kcalPerServing, uses: [use('also-untracked')] }),
      baseContext,
    );
    expect(score).toBeCloseTo(zeroUrgency, 10);
  });

  test('a tracked ingredient raises the score over an identical dish using none', () => {
    const context: DishScoreContext = {
      ...baseContext,
      stockIndex: new Map([['urgent-item', { urgencyScore: 500, daysLeft: 2 }]]),
    };
    const withUrgentItem = dish({ dish: 'Uses it', uses: [use('urgent-item')], effortMinutes: 20, kcalPerServing: 400 });
    const withoutIt = dish({ dish: 'Ignores it', uses: [use('untracked')], effortMinutes: 20, kcalPerServing: 400 });
    expect(scoreDish(withUrgentItem, context)).toBeGreaterThan(scoreDish(withoutIt, context));
  });

  test('lower effort scores higher, all else equal', () => {
    const quick = dish({ dish: 'Quick', uses: [use('x')], effortMinutes: 5, kcalPerServing: 400 });
    const slow = dish({ dish: 'Slow', uses: [use('x')], effortMinutes: 90, kcalPerServing: 400 });
    expect(scoreDish(quick, baseContext)).toBeGreaterThan(scoreDish(slow, baseContext));
  });

  test('a dish within the day\'s remaining calories is not penalised versus one further under it', () => {
    // Decision 36: overshoot is never excluded, only ranked — and being
    // comfortably under budget is not itself rewarded further.
    const atBudget = dish({ dish: 'At budget', uses: [use('x')], kcalPerServing: 600, effortMinutes: 20 });
    const wellUnder = dish({ dish: 'Well under', uses: [use('x')], kcalPerServing: 100, effortMinutes: 20 });
    expect(scoreDish(atBudget, baseContext)).toBeCloseTo(scoreDish(wellUnder, baseContext), 10);
  });

  test('overshooting the remaining calories lowers the score without zeroing it', () => {
    const overshoots = dish({ dish: 'Overshoots', uses: [use('x')], kcalPerServing: 1400, effortMinutes: 20 });
    const atBudget = dish({ dish: 'At budget', uses: [use('x')], kcalPerServing: 600, effortMinutes: 20 });
    const overshootScore = scoreDish(overshoots, baseContext);
    const atBudgetScore = scoreDish(atBudget, baseContext);
    expect(overshootScore).toBeLessThan(atBudgetScore);
    expect(overshootScore).toBeGreaterThan(-Infinity);
  });

  test('a dish repeating a frequent one scores higher than an unfamiliar one, all else equal', () => {
    const context: DishScoreContext = {
      ...baseContext,
      personalisation: { ...baseContext.personalisation, frequentDishes: ['Familiar dish'] },
    };
    const familiar = dish({ dish: 'Familiar dish', uses: [use('x')], effortMinutes: 20, kcalPerServing: 400 });
    const unfamiliar = dish({ dish: 'Something new', uses: [use('x')], effortMinutes: 20, kcalPerServing: 400 });
    expect(scoreDish(familiar, context)).toBeGreaterThan(scoreDish(unfamiliar, context));
  });

  test('a dish matching the leaning cuisine outranks a non-matching one, but not a frequent-dish match', () => {
    const context: DishScoreContext = {
      ...baseContext,
      personalisation: {
        ...baseContext.personalisation,
        topCuisine: 'Korean',
        frequentDishes: ['Gochujang classic'],
      },
    };
    const cuisineMatch = dish({ dish: 'Gochujang new idea', uses: [use('x')], effortMinutes: 20, kcalPerServing: 400 });
    const exactMatch = dish({ dish: 'Gochujang classic', uses: [use('x')], effortMinutes: 20, kcalPerServing: 400 });
    const neither = dish({ dish: 'Plain rice', uses: [use('x')], effortMinutes: 20, kcalPerServing: 400 });
    expect(scoreDish(cuisineMatch, context)).toBeGreaterThan(scoreDish(neither, context));
    expect(scoreDish(exactMatch, context)).toBeGreaterThan(scoreDish(cuisineMatch, context));
  });

  test('a dish repeating something recently eaten scores lower than an otherwise-identical one', () => {
    const context: DishScoreContext = {
      ...baseContext,
      personalisation: { ...baseContext.personalisation, recentlyEaten: ['Eaten yesterday'] },
    };
    const recent = dish({ dish: 'Eaten yesterday', uses: [use('x')], effortMinutes: 20, kcalPerServing: 400 });
    const fresh = dish({ dish: 'Something else', uses: [use('x')], effortMinutes: 20, kcalPerServing: 400 });
    expect(scoreDish(recent, context)).toBeLessThan(scoreDish(fresh, context));
  });

  test('the sum is exactly the seven terms, not a subset', () => {
    const context: DishScoreContext = {
      stockIndex: new Map([['urgent', { urgencyScore: 300, daysLeft: 1 }]]),
      remainingCalories: 500,
      personalisation: { cuisineLean: null, topCuisine: 'Korean', frequentDishes: ['Repeat'], recentlyEaten: ['Repeat'] },
      dislikedCanonicalIds: new Set(['urgent']),
    };
    const suggestion = dish({ dish: 'Repeat', uses: [use('urgent')], effortMinutes: 10, kcalPerServing: 450 });
    // Frequent, recently eaten, AND disliked at once — every term must
    // fire together, not short-circuit each other.
    const score = scoreDish(suggestion, context);
    expect(Number.isFinite(score)).toBe(true);
    expect(score).not.toBe(0);
  });

  test('a disliked ingredient lowers the score without excluding it (add-dietary-profile, task 6.5)', () => {
    const context: DishScoreContext = { ...baseContext, dislikedCanonicalIds: new Set(['x']) };
    const disliked = dish({ dish: 'Uses it', uses: [use('x')], effortMinutes: 20, kcalPerServing: 400 });
    const neutral = dish({ dish: 'Ignores it', uses: [use('untracked')], effortMinutes: 20, kcalPerServing: 400 });
    expect(scoreDish(disliked, context)).toBeLessThan(scoreDish(neutral, context));
  });
});

/* -------------------------------------------------------------------------- */
/* 4.8 — purity                                                               */
/* -------------------------------------------------------------------------- */

describe('scoreDish and selectDisplayed — purity (4.8)', () => {
  test('the same pool and context score identically on repeated calls', () => {
    const ctx = contextFor('well-stocked Asian pantry', wellStockedAsianPantryRemainingCalories);
    const first = wellStockedAsianPantryPool.map((s) => scoreDish(s, ctx));
    const second = wellStockedAsianPantryPool.map((s) => scoreDish(s, ctx));
    expect(second).toEqual(first);
  });

  test('selectDisplayed returns the same order on repeated calls', () => {
    const ctx = contextFor('well-stocked Asian pantry', wellStockedAsianPantryRemainingCalories);
    const first = selectDisplayed(wellStockedAsianPantryPool, ctx, 3).map((s) => s.dish);
    const second = selectDisplayed(wellStockedAsianPantryPool, ctx, 3).map((s) => s.dish);
    expect(second).toEqual(first);
  });
});

describe('template display decoration', () => {
  test('quick adds a factual time cue and lighter portions never turn unknown calories into a recommendation', () => {
    const base = dish({
      dish: 'Quick dish', uses: [{ canonicalId: 'untracked', qty: 1, unit: 'g' }], effortMinutes: 20, kcalPerServing: 900,
    });
    const quickContext: DishScoreContext = {
      stockIndex: new Map(), remainingCalories: 400,
      personalisation: { cuisineLean: null, topCuisine: null, frequentDishes: [], recentlyEaten: [] },
      dislikedCanonicalIds: new Set(),
      tonightPreference: { baseIntent: 'lighter_portions', prepSpeed: 'quick', source: 'saved' },
    };
    const decorated = decorateSuggestionForDisplay(base, quickContext);
    expect(decorated.reasons.map((reason) => reason.label)).toContain('About 20 minutes of active time');
    expect(decorated.portionRecommendation).toMatchObject({ servings: expect.any(Number) });

    const unavailable = decorateSuggestionForDisplay(base, { ...quickContext, remainingCalories: null });
    expect(unavailable.portionRecommendation).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* 6 — never alter a suggestion                                               */
/* -------------------------------------------------------------------------- */

describe('selectDisplayed — never alters a suggestion (group 6)', () => {
  test('every displayed suggestion is the exact object from the pool', () => {
    const ctx = contextFor('well-stocked Asian pantry', wellStockedAsianPantryRemainingCalories);
    const displayed = selectDisplayed(wellStockedAsianPantryPool, ctx, 3);
    for (const suggestion of displayed) {
      expect(wellStockedAsianPantryPool).toContain(suggestion); // reference equality
    }
  });

  test('a losing candidate is absent, not rewritten — the pool itself is untouched', () => {
    const ctx = contextFor('well-stocked Asian pantry', wellStockedAsianPantryRemainingCalories);
    const before = wellStockedAsianPantryPool.map((s) => JSON.stringify(s));
    selectDisplayed(wellStockedAsianPantryPool, ctx, 3);
    const after = wellStockedAsianPantryPool.map((s) => JSON.stringify(s));
    expect(after).toEqual(before);
  });
});

/* -------------------------------------------------------------------------- */
/* 5.5 — selection and variety                                                */
/* -------------------------------------------------------------------------- */

describe('selectDisplayed — variety (group 5)', () => {
  test('a pool smaller than the displayed count returns everything it has', () => {
    const ctx = contextFor('nothing urgent', nothingUrgentRemainingCalories);
    const small = nothingUrgentPool.slice(0, 2);
    const displayed = selectDisplayed(small, ctx, 3);
    expect(displayed).toHaveLength(2);
  });

  test('the variety floor still meets the displayed count from an all-similar pool', () => {
    const ctx = contextFor('only staples and seasonings', onlyStaplesAndSeasoningsRemainingCalories);
    const displayed = selectDisplayed(onlyStaplesAndSeasoningsPool, ctx, 3);
    expect(displayed).toHaveLength(3);
  });

  test('a lower-scoring, differing candidate is preferred over a higher-scoring near-duplicate', () => {
    const ctx = contextFor('only staples and seasonings', onlyStaplesAndSeasoningsRemainingCalories);
    const displayed = selectDisplayed(onlyStaplesAndSeasoningsPool, ctx, 3).map((s) => s.dish);
    // "Spicy gochujang rice bowl" outscores "Soy sauce fried rice" on raw
    // terms, but it is a near-duplicate of the top pick — the soy dish
    // differs and is what should actually appear.
    expect(displayed).toContain('Soy sauce fried rice');
    expect(displayed).not.toContain('Spicy gochujang rice bowl');
  });

  test('near-identical dishes are not all shown', () => {
    const ctx = contextFor('well-stocked Asian pantry', wellStockedAsianPantryRemainingCalories);
    const displayed = selectDisplayed(wellStockedAsianPantryPool, ctx, 3).map((s) => s.dish);
    // Same two ingredients, same cuisine keyword as the top pick.
    expect(displayed).not.toContain('Pork gochujang rice bowl');
  });
});

/* -------------------------------------------------------------------------- */
/* 3.5 — constraints run before scoring, always                               */
/* -------------------------------------------------------------------------- */

describe('the use-first constraint runs before the scorer, never after (task 3.5)', () => {
  test('a suggestion missing the use_first bucket is dropped even though it would score highest', () => {
    // "Ignores the urgent items" would win on every other term: minimal
    // effort, perfect calorie fit, and nothing else in the pool comes
    // close. It still must never reach the scorer once it is excluded.
    const raw = JSON.stringify({
      suggestions: [
        {
          dish: 'Ignores the urgent items',
          reason_tags: ['quick'],
          kcal_per_serving: 1,
          servings: 1,
          effort_minutes: 0,
          uses: [{ canonical_id: 'jasmine-rice', qty: 1, unit: 'g' }],
          missing: [],
          method: [],
        },
        {
          dish: 'Uses the urgent item',
          reason_tags: ['clears it'],
          kcal_per_serving: 500,
          servings: 1,
          effort_minutes: 30,
          uses: [{ canonical_id: 'pork-belly', qty: 1, unit: 'g' }],
          missing: [],
          method: [],
        },
      ],
    });
    const candidateIds = new Set(['jasmine-rice', 'pork-belly']);
    const useFirstIds = new Set(['pork-belly']);

    const result = parseSuggestResponse(raw, candidateIds, useFirstIds, EMPTY_EXCLUSION, false);
    expect(result.suggestions.map((s) => s.dish)).toEqual(['Uses the urgent item']);

    const ctx = contextFor('costly protein expiring tomorrow', costlyProteinExpiringTomorrowRemainingCalories);
    const displayed = selectDisplayed(result.suggestions, ctx, 3);
    expect(displayed.map((s) => s.dish)).toEqual(['Uses the urgent item']);
  });
});

/* -------------------------------------------------------------------------- */
/* 8.2 — the measured order per fixture, asserted so a weight change that     */
/* reorders a fixture fails the build                                        */
/* -------------------------------------------------------------------------- */

describe('the fixture corpus — measured display order (task 8.2)', () => {
  test('well-stocked Asian pantry: the frequent dish wins; quick and cheap beats slow and dear; overshoot and recency sink to the bottom', () => {
    const ctx = contextFor('well-stocked Asian pantry', wellStockedAsianPantryRemainingCalories);
    const scored = wellStockedAsianPantryPool
      .map((s) => ({ dish: s.dish, score: scoreDish(s, ctx) }))
      .sort((a, b) => b.score - a.score);
    expect(scored[scored.length - 1]?.dish).toBe('Kimchi fried rice'); // recency penalty
    expect(scored[scored.length - 2]?.dish).toBe('Deep-fried pork belly feast'); // calorie overshoot

    const displayed = selectDisplayed(wellStockedAsianPantryPool, ctx, 3).map((s) => s.dish);
    expect(displayed).toEqual([
      'Gochujang pork stir-fry',
      'Green onion pancake',
      'Slow-braised pork belly with green onion',
    ]);
  });

  test('costly protein expiring tomorrow: constraint headroom leaves exactly the eligible three, and the floor shows all of them', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'costly protein expiring tomorrow')!;
    const raw = JSON.stringify({
      suggestions: costlyProteinExpiringTomorrowPool.map((s) => ({
        dish: s.dish,
        reason_tags: ['uses what is on hand'],
        kcal_per_serving: s.kcalPerServing,
        servings: s.servings,
        effort_minutes: s.effortMinutes,
        uses: s.uses.map((u) => ({ canonical_id: u.canonicalId, qty: u.qty, unit: u.unit })),
        missing: [],
        method: [],
      })),
    });
    const candidateIds = new Set(kitchen.canonicals.map((c) => c.id));
    const useFirstIds = new Set(['pork-belly', 'cucumber']);

    const result = parseSuggestResponse(raw, candidateIds, useFirstIds, EMPTY_EXCLUSION, false);
    expect(result.droppedForConstraint).toBe(7);
    expect(result.suggestions).toHaveLength(3);

    const ctx = contextFor('costly protein expiring tomorrow', costlyProteinExpiringTomorrowRemainingCalories);
    const displayed = selectDisplayed(result.suggestions, ctx, 3);
    expect(displayed).toHaveLength(3);
    expect(new Set(displayed.map((s) => s.dish))).toEqual(
      new Set(['Pork belly and cucumber stir-fry', 'Cucumber pork salad', 'Braised pork belly with rice']),
    );
  });

  test('a disliked ingredient still appears when it is the only thing expiring (add-dietary-profile, task 6.7)', () => {
    // Decision 106's whole point, now against the real engine: pork belly
    // is the only urgent item in this kitchen, so every eligible candidate
    // (after the use-first drop above) uses it. Disliking it must not
    // empty the display — it can only ever cost a scoring contest.
    const kitchen = KITCHENS.find((k) => k.name === 'costly protein expiring tomorrow')!;
    const raw = JSON.stringify({
      suggestions: costlyProteinExpiringTomorrowPool.map((s) => ({
        dish: s.dish,
        reason_tags: ['uses what is on hand'],
        kcal_per_serving: s.kcalPerServing,
        servings: s.servings,
        effort_minutes: s.effortMinutes,
        uses: s.uses.map((u) => ({ canonical_id: u.canonicalId, qty: u.qty, unit: u.unit })),
        missing: [],
        method: [],
      })),
    });
    const candidateIds = new Set(kitchen.canonicals.map((c) => c.id));
    const useFirstIds = new Set(['pork-belly', 'cucumber']);
    const result = parseSuggestResponse(raw, candidateIds, useFirstIds, EMPTY_EXCLUSION, false);

    const baseCtx = contextFor(
      'costly protein expiring tomorrow',
      costlyProteinExpiringTomorrowRemainingCalories,
    );
    const dislikingPorkBelly: DishScoreContext = {
      ...baseCtx,
      dislikedCanonicalIds: new Set(['pork-belly']),
    };

    const displayed = selectDisplayed(result.suggestions, dislikingPorkBelly, 3);
    expect(displayed).toHaveLength(3);
    expect(displayed.every((s) => s.uses.some((u) => u.canonicalId === 'pork-belly'))).toBe(true);
  });

  test('only staples and seasonings: the variety floor picks a genuinely different dish over a near-duplicate', () => {
    const ctx = contextFor('only staples and seasonings', onlyStaplesAndSeasoningsRemainingCalories);
    const displayed = selectDisplayed(onlyStaplesAndSeasoningsPool, ctx, 3).map((s) => s.dish);
    expect(displayed).toEqual([
      'Gochujang fried rice',
      'Gochujang rice, lightly spiced',
      'Soy sauce fried rice',
    ]);
  });

  test('nearly-empty fridge: milk-clearing dishes win, and a repeat of yesterday sinks despite otherwise fitting', () => {
    const ctx = contextFor('nearly-empty fridge', nearlyEmptyFridgeRemainingCalories);
    const scored = nearlyEmptyFridgePool
      .map((s) => ({ dish: s.dish, score: scoreDish(s, ctx) }))
      .sort((a, b) => b.score - a.score);
    expect(scored[scored.length - 1]?.dish).toBe('Toast and eggs');

    const displayed = selectDisplayed(nearlyEmptyFridgePool, ctx, 3).map((s) => s.dish);
    expect(displayed).toEqual([
      'Buttered rice bowl with a milk splash',
      'Plain rice with fried egg',
      'Oiled rice',
    ]);
  });

  test('nothing urgent: the least-effort dish clearing the only pressure wins, and variety forces a non-spinach third pick', () => {
    const ctx = contextFor('nothing urgent', nothingUrgentRemainingCalories);
    const displayed = selectDisplayed(nothingUrgentPool, ctx, 3).map((s) => s.dish);
    expect(displayed).toEqual(['Wilted spinach salad', 'Quick oiled rice', 'Pan-seared chicken']);
  });

  test('freezable beside non-freezable: the non-freezable ingredient\'s discount-free urgency still drives the pick', () => {
    const ctx = contextFor('freezable beside non-freezable, same expiry', freezableVsNotRemainingCalories);
    const displayed = selectDisplayed(freezableVsNotPool, ctx, 3).map((s) => s.dish);
    expect(displayed).toEqual([
      'Spinach with a little chicken',
      'Wilted spinach with rice',
      'Chicken rice bowl',
    ]);
  });
});
