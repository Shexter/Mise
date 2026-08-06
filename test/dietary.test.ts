import { describe, expect, test } from 'vitest';

import { applyDietary, expandRules, type ExclusionSet } from '../src/logic/dietary';
import type { DietaryRule, Suggestion } from '../src/types';

/**
 * `add-dietary-profile` group 5: the pure exclusion logic. No database, no
 * network — `expandRules` and `applyDietary` are exercised directly against
 * hand-built rules and suggestions.
 */

function rule(overrides: Partial<DietaryRule> & Pick<DietaryRule, 'kind'>): DietaryRule {
  return {
    id: 'rule-1',
    canonicalId: null,
    text: 'Test rule',
    normalisedText: 'test rule',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function suggestion(
  overrides: Partial<Pick<Suggestion, 'uses' | 'missing'>> = {},
): Pick<Suggestion, 'uses' | 'missing'> {
  return {
    uses: [],
    missing: [],
    ...overrides,
  };
}

describe('expandRules', () => {
  test('a rule with no derivatives excludes just itself', () => {
    const set = expandRules(
      [rule({ kind: 'allergen', canonicalId: 'peanut' })],
      new Map(),
      ['allergen', 'restriction'],
    );
    expect(set.canonicalIds).toEqual(new Set(['peanut']));
  });

  test('a rule expands through one level of derivatives', () => {
    const derivatives = new Map([['milk', ['butter', 'ghee']]]);
    const set = expandRules(
      [rule({ kind: 'allergen', canonicalId: 'milk' })],
      derivatives,
      ['allergen', 'restriction'],
    );
    expect(set.canonicalIds).toEqual(new Set(['milk', 'butter', 'ghee']));
  });

  test('a rule expands through a transitive (grandchild) derivative', () => {
    const derivatives = new Map([
      ['a', ['b']],
      ['b', ['c']],
    ]);
    const set = expandRules([rule({ kind: 'allergen', canonicalId: 'a' })], derivatives, [
      'allergen',
      'restriction',
    ]);
    expect(set.canonicalIds).toEqual(new Set(['a', 'b', 'c']));
  });

  test('a cyclical derivative graph terminates', () => {
    const derivatives = new Map([
      ['a', ['b']],
      ['b', ['a']],
    ]);
    const set = expandRules([rule({ kind: 'allergen', canonicalId: 'a' })], derivatives, [
      'allergen',
      'restriction',
    ]);
    expect(set.canonicalIds).toEqual(new Set(['a', 'b']));
  });

  test('an unresolved rule contributes its normalised text, not a canonical id', () => {
    const set = expandRules(
      [rule({ kind: 'allergen', canonicalId: null, normalisedText: 'durian' })],
      new Map(),
      ['allergen', 'restriction'],
    );
    expect(set.canonicalIds.size).toBe(0);
    expect(set.unresolvedText).toEqual(new Set(['durian']));
  });

  test('a kind not requested is not expanded', () => {
    const set = expandRules(
      [rule({ kind: 'dislike', canonicalId: 'mushroom' })],
      new Map(),
      ['allergen', 'restriction'],
    );
    expect(set.canonicalIds.size).toBe(0);
  });

  test('no rules produces an empty set', () => {
    const set = expandRules([], new Map(), ['allergen', 'restriction']);
    expect(set.canonicalIds.size).toBe(0);
    expect(set.unresolvedText.size).toBe(0);
  });

  test('allergen and restriction rules are both expanded when both are requested', () => {
    const set = expandRules(
      [
        rule({ kind: 'allergen', canonicalId: 'peanut' }),
        rule({ kind: 'restriction', canonicalId: 'pork-belly' }),
      ],
      new Map(),
      ['allergen', 'restriction'],
    );
    expect(set.canonicalIds).toEqual(new Set(['peanut', 'pork-belly']));
  });
});

describe('applyDietary', () => {
  const emptySet: ExclusionSet = { canonicalIds: new Set(), unresolvedText: new Set() };

  test('a suggestion using no excluded ingredient is not excluded', () => {
    const set: ExclusionSet = { canonicalIds: new Set(['peanut']), unresolvedText: new Set() };
    const verdict = applyDietary(
      suggestion({ uses: [{ canonicalId: 'jasmine-rice', qty: 1, unit: 'g' }] }),
      set,
      false,
    );
    expect(verdict.excluded).toBe(false);
  });

  test('a suggestion using an excluded ingredient by exact canonical id is excluded', () => {
    const set: ExclusionSet = { canonicalIds: new Set(['peanut']), unresolvedText: new Set() };
    const verdict = applyDietary(
      suggestion({ uses: [{ canonicalId: 'peanut', qty: 1, unit: 'g' }] }),
      set,
      false,
    );
    expect(verdict.excluded).toBe(true);
    expect(verdict.reason).toBe('peanut');
  });

  test('a suggestion using a derivative already folded into the exclusion set is excluded', () => {
    const set: ExclusionSet = {
      canonicalIds: new Set(['milk', 'butter']),
      unresolvedText: new Set(),
    };
    const verdict = applyDietary(
      suggestion({ uses: [{ canonicalId: 'butter', qty: 1, unit: 'g' }] }),
      set,
      false,
    );
    expect(verdict.excluded).toBe(true);
  });

  test('an excluded ingredient reached through `missing` (with a canonical id) is excluded', () => {
    const set: ExclusionSet = { canonicalIds: new Set(['peanut']), unresolvedText: new Set() };
    const verdict = applyDietary(
      suggestion({ missing: [{ canonicalId: 'peanut', name: 'peanuts', note: null }] }),
      set,
      false,
    );
    expect(verdict.excluded).toBe(true);
  });

  test('a text-fallback rule matches a missing ingredient by normalised name', () => {
    const set: ExclusionSet = { canonicalIds: new Set(), unresolvedText: new Set(['durian']) };
    const verdict = applyDietary(
      suggestion({ missing: [{ canonicalId: null, name: 'Durian', note: null }] }),
      set,
      false,
    );
    expect(verdict.excluded).toBe(true);
    expect(verdict.reason).toBe('Durian');
  });

  test('allergen with an unknown ingredient: an unresolved missing ingredient excludes when an allergen rule exists', () => {
    const verdict = applyDietary(
      suggestion({ missing: [{ canonicalId: null, name: 'seafood stock', note: null }] }),
      emptySet,
      true, // hasAllergenRules
    );
    expect(verdict.excluded).toBe(true);
  });

  test('restriction with an unknown ingredient: unresolved does not exclude without an allergen rule', () => {
    const verdict = applyDietary(
      suggestion({ missing: [{ canonicalId: null, name: 'seafood stock', note: null }] }),
      emptySet,
      false, // no allergen rules — only a restriction, say
    );
    expect(verdict.excluded).toBe(false);
  });

  test('no rules at all: nothing is ever excluded', () => {
    const verdict = applyDietary(
      suggestion({
        uses: [{ canonicalId: 'peanut', qty: 1, unit: 'g' }],
        missing: [{ canonicalId: null, name: 'anything', note: null }],
      }),
      emptySet,
      false,
    );
    expect(verdict.excluded).toBe(false);
  });
});
