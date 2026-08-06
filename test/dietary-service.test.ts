import { beforeEach, describe, expect, test } from 'vitest';

import { getBestAliasByNorm, insertMeal, loadSeedData } from '../src/db/queries';
import {
  addDietaryRule,
  addDietaryRuleAsText,
  confirmDietaryRule,
  dislikedCanonicalIds,
  getExclusionSet,
  listDietaryRules,
} from '../src/logic/dietaryService';
import { openTestDatabase } from './stubs/db';

/**
 * `add-dietary-profile` task 4.2 ("resolve through the existing matcher, no
 * second path") and 4.5 (a confirmed ask-band outcome is learned as an
 * alias, same as everywhere else confirmation happens).
 */

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
});

describe('addDietaryRule — resolving through the one matcher', () => {
  test('a rule matching a seeded alias exactly resolves to its canonical id', async () => {
    const result = await addDietaryRule('Milk', 'allergen');
    expect(result.status).toBe('added');
    if (result.status === 'added') {
      expect(result.rule.canonicalId).toBe('milk');
      expect(result.rule.kind).toBe('allergen');
    }
  });

  test('a rule matching nothing is still recorded, by normalised text only', async () => {
    const result = await addDietaryRule('Zzqxvythingredient', 'allergen');
    expect(result.status).toBe('added');
    if (result.status === 'added') {
      expect(result.rule.canonicalId).toBeNull();
      expect(result.rule.text).toBe('Zzqxvythingredient');
    }
  });
});

describe('confirming an ask-band outcome (task 4.5)', () => {
  test('confirming learns the alias, so the same text resolves directly next time', async () => {
    const rule = await confirmDietaryRule('Moo juice', 'allergen', 'milk');
    expect(rule.canonicalId).toBe('milk');

    // The confirmation wrote an alias — a fresh rule with the same raw text
    // now resolves on its own, with no confirmation step.
    const alias = await getBestAliasByNorm('moo juice');
    expect(alias?.canonicalId).toBe('milk');

    const second = await addDietaryRule('Moo juice', 'restriction');
    expect(second.status).toBe('added');
    if (second.status === 'added') {
      expect(second.rule.canonicalId).toBe('milk');
    }
  });

  test('rejecting keeps the rule text-only, same as an unresolved match', async () => {
    const rule = await addDietaryRuleAsText('Some odd name', 'dislike');
    expect(rule.canonicalId).toBeNull();
    expect(rule.text).toBe('Some odd name');
  });
});

describe('getExclusionSet and dislikedCanonicalIds', () => {
  test('only allergen and restriction rules seed exclusion, expanded through derivatives', async () => {
    await addDietaryRule('Milk', 'allergen');
    await addDietaryRule('Cilantro', 'dislike'); // unrelated to milk, and a dislike never excludes

    const excluded = (await getExclusionSet(await listDietaryRules())).canonicalIds;
    expect(excluded.has('milk')).toBe(true);
    expect(excluded.has('butter')).toBe(true); // derivative
    expect(excluded.has('cilantro')).toBe(false); // that rule was a dislike
  });

  test('only dislike rules seed the dislike set, expanded through derivatives', async () => {
    await addDietaryRule('Milk', 'allergen');
    await addDietaryRule('Sesame seeds', 'dislike');

    const disliked = await dislikedCanonicalIds(await listDietaryRules());
    expect(disliked.has('sesame')).toBe(true);
    expect(disliked.has('sesame-oil')).toBe(true); // derivative
    expect(disliked.has('milk')).toBe(false); // that rule was an allergen
  });

  test('no rules means no exclusion and no dislikes', async () => {
    const excluded = await getExclusionSet([]);
    const disliked = await dislikedCanonicalIds([]);
    expect(excluded.canonicalIds.size).toBe(0);
    expect(excluded.unresolvedText.size).toBe(0);
    expect(disliked.size).toBe(0);
  });

  test('an unresolved allergen still contributes its normalised text to the exclusion set', async () => {
    await addDietaryRule('Zzqxvythingredient', 'allergen');
    const excluded = await getExclusionSet(await listDietaryRules());
    expect(excluded.unresolvedText.has('zzqxvythingredient')).toBe(true);
  });
});

describe('logging stays untouched, even with rules recorded (task 9.1/10.6)', () => {
  test('a meal containing an allergen still saves, unchanged', async () => {
    await addDietaryRule('Milk', 'allergen');

    const meal = await insertMeal({
      loggedAt: '2026-06-01T19:00:00.000Z',
      localDate: '2026-06-01',
      mealType: 'dinner',
      name: 'Buttered toast',
      photoUri: null,
      source: 'manual',
      confidence: null,
      venue: 'home',
      servingsMult: 1,
      items: [
        {
          name: 'Butter',
          quantity: 10,
          unit: 'g',
          calories: 70,
          proteinG: 0,
          carbsG: 0,
          fatG: 8,
          isManualAddition: true,
          canonicalId: 'butter',
        },
      ],
    });

    // No block, no alteration — the meal is exactly what was logged.
    expect(meal.name).toBe('Buttered toast');
    expect(meal.items).toHaveLength(1);
    expect(meal.items[0]?.canonicalId).toBe('butter');
  });
});
