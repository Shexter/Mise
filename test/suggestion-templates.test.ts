import { describe, expect, test } from 'vitest';

import {
  SUGGESTION_INTENT_POLICIES,
  SUGGESTION_SPEED_POLICIES,
  defaultBaseIntent,
  resolveTonightPreference,
  scoreMultipliersFor,
} from '../src/logic/suggestionTemplates';
import { scoreDish, selectDisplayed, type DishScoreContext } from '../src/logic/dishScore';
import { SUGGESTION_BASE_INTENTS, SUGGESTION_PREP_SPEEDS, type Suggestion } from '../src/types';

function candidate(overrides: Partial<Suggestion> & Pick<Suggestion, 'dish' | 'uses'>): Suggestion {
  return {
    reasons: [], kcalPerServing: 600, servings: 1, effortMinutes: 30, missing: [], method: [], ...overrides,
  };
}

function context(baseIntent: import('../src/types').SuggestionBaseIntent, prepSpeed: import('../src/types').SuggestionPrepSpeed): DishScoreContext {
  return {
    stockIndex: new Map([
      ['slow', { urgencyScore: 600, daysLeft: 0 }],
      ['fast', { urgencyScore: 500, daysLeft: 1 }],
      ['protein', { urgencyScore: 400, daysLeft: 2 }],
      ['familiar', { urgencyScore: 400, daysLeft: 2 }],
    ]),
    remainingCalories: 600,
    personalisation: {
      cuisineLean: null, topCuisine: null, frequentDishes: ['Familiar dinner'], recentlyEaten: [],
    },
    dislikedCanonicalIds: new Set(),
    tonightPreference: { baseIntent, prepSpeed, source: 'saved' },
  };
}

describe('suggestion templates', () => {
  test('every fixed id has a stable policy and every policy multiplier is positive or neutral', () => {
    for (const id of SUGGESTION_BASE_INTENTS) {
      const policy = SUGGESTION_INTENT_POLICIES[id];
      expect(policy.id).toBe(id);
      expect(policy.label).not.toHaveLength(0);
      expect(policy.description).not.toHaveLength(0);
      for (const value of Object.values(policy.multipliers)) expect(value).toBeGreaterThanOrEqual(0);
    }
    for (const id of SUGGESTION_PREP_SPEEDS) {
      expect(SUGGESTION_SPEED_POLICIES[id].effortMultiplier).toBeGreaterThan(0);
    }
  });

  test('profile goals provide total recommendations and a saved choice wins until reset', () => {
    expect(defaultBaseIntent('lose')).toBe('lighter_portions');
    expect(defaultBaseIntent('gain')).toBe('protein_forward');
    expect(defaultBaseIntent('maintain')).toBe('balanced');
    expect(resolveTonightPreference('gain', null)).toEqual({
      baseIntent: 'protein_forward', prepSpeed: 'standard', source: 'profile_default',
    });
    expect(resolveTonightPreference('lose', {
      baseIntent: 'use_it_up', prepSpeed: 'quick', updatedAt: '2026-08-10T00:00:00.000Z',
    })).toEqual({ baseIntent: 'use_it_up', prepSpeed: 'quick', source: 'saved' });
  });

  test('quick composes with a base policy while changing only the effort multiplier', () => {
    const standard = scoreMultipliersFor({
      baseIntent: 'protein_forward', prepSpeed: 'standard', source: 'saved',
    });
    const quick = scoreMultipliersFor({
      baseIntent: 'protein_forward', prepSpeed: 'quick', source: 'saved',
    });
    expect(quick.effort).toBeGreaterThan(standard.effort);
    expect(quick.proteinDensity).toBe(standard.proteinDensity);
  });

  test('the fixed policies produce deterministic, evidence-bound selection changes', () => {
    const slow = candidate({ dish: 'Slow urgent dinner', uses: [{ canonicalId: 'slow', qty: 1, unit: 'g' }], effortMinutes: 60 });
    const fast = candidate({ dish: 'Fast dinner', uses: [{ canonicalId: 'fast', qty: 1, unit: 'g' }], effortMinutes: 10 });
    const protein = candidate({
      dish: 'Measured protein dinner', uses: [{ canonicalId: 'protein', qty: 1, unit: 'g' }],
      estimatedNutritionPerServing: { calories: 400, proteinG: 45, carbsG: 20, fatG: 10, source: 'provider' },
    });
    const familiar = candidate({ dish: 'Familiar dinner', uses: [{ canonicalId: 'familiar', qty: 1, unit: 'g' }] });
    const pool = [slow, fast, protein, familiar];
    const balanced = context('balanced', 'standard');

    expect(scoreDish(slow, context('use_it_up', 'standard'))).toBeGreaterThan(scoreDish(slow, balanced));
    expect(scoreDish(protein, context('protein_forward', 'standard'))).toBeGreaterThan(scoreDish(protein, balanced));
    expect(scoreDish(familiar, context('familiar_favourites', 'standard'))).toBeGreaterThan(scoreDish(familiar, balanced));
    expect(scoreDish(fast, context('balanced', 'quick'))).toBeGreaterThan(scoreDish(fast, balanced));
    const standard = selectDisplayed(pool, balanced, 1);
    const quick = selectDisplayed(pool, context('balanced', 'quick'), 1);
    expect(standard[0]?.dish).toBe('Slow urgent dinner');
    expect(quick[0]?.dish).toBe('Fast dinner');
    expect(quick.reduce((sum, dish) => sum + dish.effortMinutes, 0) / quick.length).toBeLessThan(
      standard.reduce((sum, dish) => sum + dish.effortMinutes, 0) / standard.length,
    );
  });

  test('missing nutrition is neutral, not a hidden zero or eligibility gate', () => {
    const unknown = candidate({ dish: 'Unknown nutrition dinner', uses: [{ canonicalId: 'protein', qty: 1, unit: 'g' }] });
    expect(scoreDish(unknown, context('protein_forward', 'standard'))).toBe(
      scoreDish(unknown, context('balanced', 'standard')),
    );
    expect(selectDisplayed([unknown], context('protein_forward', 'quick'), 1)).toEqual([unknown]);
  });

  test('policy strings describe suggestion behaviour without outcome claims', () => {
    const forbidden = /fat loss|weight loss|muscle gain|build muscle|medical/i;
    for (const policy of Object.values(SUGGESTION_INTENT_POLICIES)) {
      expect(`${policy.label} ${policy.description} ${policy.promptFraming}`).not.toMatch(forbidden);
    }
    for (const policy of Object.values(SUGGESTION_SPEED_POLICIES)) {
      expect(`${policy.label} ${policy.description} ${policy.promptFraming ?? ''}`).not.toMatch(forbidden);
    }
  });
});
