import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { planDepletion, type PlanInput } from '@/logic/deplete';
import {
  createMealModifierState,
  pantryDepletionEnabled,
  transitionMealType,
  transitionMealVenue,
  transitionServingsMultiplier,
} from '@/logic/mealModifiers';

describe('meal modifier state transitions', () => {
  test('meal type changes without disturbing venue or batch size', () => {
    const state = createMealModifierState('breakfast', 'home', 4);

    expect(transitionMealType(state, 'dinner')).toEqual({
      mealType: 'dinner',
      venue: 'home',
      servingsMult: 4,
    });
  });

  test.each(['out', 'leftovers'] as const)(
    '%s locks servings to 1x and rejects later batch changes',
    (venue) => {
      const homeBatch = createMealModifierState('dinner', 'home', 4);
      const nonHome = transitionMealVenue(homeBatch, venue);

      expect(nonHome.servingsMult).toBe(1);
      expect(transitionServingsMultiplier(nonHome, 4).servingsMult).toBe(1);
      expect(transitionMealVenue(nonHome, 'home').servingsMult).toBe(1);
    },
  );

  test('home meals accept only the visible 1x, 2x, and 4x choices', () => {
    const state = createMealModifierState('lunch');

    expect(transitionServingsMultiplier(state, 2).servingsMult).toBe(2);
    expect(transitionServingsMultiplier(state, 4).servingsMult).toBe(4);
    expect(transitionServingsMultiplier(state, 3).servingsMult).toBe(1);
  });
});

describe('venue depletion semantics', () => {
  const input: Omit<PlanInput, 'venue'> = {
    servingsMult: 4,
    ingredients: [
      { canonicalId: 'jasmine-rice', quantity: 200, unit: 'g', kind: 'meal_item' },
    ],
    catalogue: [],
    canonicals: new Map(),
  };

  test('home enables depletion and preserves the batch multiplier', () => {
    expect(pantryDepletionEnabled('home')).toBe(true);
    expect(planDepletion({ ...input, venue: 'home' })).toHaveLength(1);
  });

  test.each(['out', 'leftovers'] as const)(
    '%s disables depletion regardless of a corrupt incoming multiplier',
    (venue) => {
      expect(pantryDepletionEnabled(venue)).toBe(false);
      expect(planDepletion({ ...input, venue })).toEqual([]);
    },
  );
});

describe('review disclosure contract', () => {
  const review = readFileSync('app/review.tsx', 'utf8');

  test('inferred hidden ingredients start collapsed and do not gate saving', () => {
    expect(review).toContain('const [hiddenSuggestionsOpen, setHiddenSuggestionsOpen] = useState(false)');
    expect(review).toContain('accessibilityState={{ expanded: hiddenSuggestionsOpen }}');
    expect(review).toContain('{hiddenSuggestionsOpen ? (');
    expect(review).toContain('disabled={items.length === 0}');
  });
});
