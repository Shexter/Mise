import { beforeEach, describe, expect, test } from 'vitest';

import {
  createDietaryRule,
  deleteDietaryRule,
  expandDerivatives,
  insertCanonicalItem,
  listDerivativeEdges,
  listDietaryRules,
  loadSeedData,
  updateDietaryRuleKind,
} from '../src/db/queries';
import { applyDietary, expandRules } from '../src/logic/dietary';
import { DIETARY_SUGGESTIONS, RULE_SETS } from '../src/logic/__fixtures__/dietary';
import { openTestDatabase, type TestDatabase } from './stubs/db';

/**
 * `add-dietary-profile` groups 3 (the derivative relation) and 4 (rule CRUD).
 */

let testDb: TestDatabase;

beforeEach(async () => {
  testDb = openTestDatabase();
  await loadSeedData();
});

describe('rule CRUD', () => {
  test('a rule round-trips through create, list, update, and delete', async () => {
    const created = await createDietaryRule({
      kind: 'allergen',
      canonicalId: 'milk',
      text: 'Milk',
      normalisedText: 'milk',
    });
    expect(created.kind).toBe('allergen');
    expect(created.canonicalId).toBe('milk');

    let rules = await listDietaryRules();
    expect(rules).toHaveLength(1);
    expect(rules[0]?.id).toBe(created.id);

    // Changing kind is enforcement policy only — text and resolution stand.
    await updateDietaryRuleKind(created.id, 'dislike');
    rules = await listDietaryRules();
    expect(rules[0]?.kind).toBe('dislike');
    expect(rules[0]?.canonicalId).toBe('milk');

    await deleteDietaryRule(created.id);
    rules = await listDietaryRules();
    expect(rules).toHaveLength(0);
  });

  test('a rule that resolved to nothing is still accepted and retains its text', async () => {
    const created = await createDietaryRule({
      kind: 'allergen',
      canonicalId: null,
      text: 'Mongongo nut',
      normalisedText: 'mongongo nut',
    });
    expect(created.canonicalId).toBeNull();
    const rules = await listDietaryRules();
    expect(rules[0]?.text).toBe('Mongongo nut');
    expect(rules[0]?.normalisedText).toBe('mongongo nut');
  });

  test('rules list oldest first', async () => {
    const first = await createDietaryRule({
      kind: 'allergen',
      canonicalId: 'milk',
      text: 'Milk',
      normalisedText: 'milk',
    });
    const second = await createDietaryRule({
      kind: 'dislike',
      canonicalId: null,
      text: 'Coriander',
      normalisedText: 'coriander',
    });
    const rules = await listDietaryRules();
    expect(rules.map((r) => r.id)).toEqual([first.id, second.id]);
  });
});

describe('the derivative closure (group 3)', () => {
  test('a seed catalogue derivative resolves through the shipped seed data', async () => {
    const closure = await expandDerivatives(['milk']);
    expect(closure.has('milk')).toBe(true);
    expect(closure.has('butter')).toBe(true);
    expect(closure.has('ghee')).toBe(true);
  });

  test('an Asian derivative edge resolves: oyster sauce from shellfish', async () => {
    const closure = await expandDerivatives(['shellfish']);
    expect(closure.has('oyster-sauce')).toBe(true);
    expect(closure.has('shrimp')).toBe(true);
  });

  test('a fish allergen excludes fish sauce and salmon through the derivative edge', async () => {
    const closure = await expandDerivatives(['fish']);
    expect(closure.has('fish-sauce')).toBe(true);
    expect(closure.has('salmon')).toBe(true);
  });

  test('closure to depth three terminates and includes every level', async () => {
    // grandparent -> parent -> child -> grandchild, none in the shipped seed.
    await insertCanonicalItem({
      id: 'grandparent',
      displayName: 'Grandparent',
      foodClass: 'staple',
      defaultLocation: 'pantry',
      shelfLifeDays: { pantry: 365 },
      openLifeDays: null,
      typicalUseQty: null,
      typicalUseUnit: null,
    });
    await insertCanonicalItem({
      id: 'parent',
      displayName: 'Parent',
      foodClass: 'staple',
      defaultLocation: 'pantry',
      shelfLifeDays: { pantry: 365 },
      openLifeDays: null,
      typicalUseQty: null,
      typicalUseUnit: null,
    });
    await insertCanonicalItem({
      id: 'child',
      displayName: 'Child',
      foodClass: 'staple',
      defaultLocation: 'pantry',
      shelfLifeDays: { pantry: 365 },
      openLifeDays: null,
      typicalUseQty: null,
      typicalUseUnit: null,
    });
    await insertCanonicalItem({
      id: 'grandchild',
      displayName: 'Grandchild',
      foodClass: 'staple',
      defaultLocation: 'pantry',
      shelfLifeDays: { pantry: 365 },
      openLifeDays: null,
      typicalUseQty: null,
      typicalUseUnit: null,
    });
    await testDb.runAsync(
      'INSERT INTO canonical_derivatives (parent_id, child_id) VALUES (?, ?)',
      ['grandparent', 'parent'],
    );
    await testDb.runAsync(
      'INSERT INTO canonical_derivatives (parent_id, child_id) VALUES (?, ?)',
      ['parent', 'child'],
    );
    await testDb.runAsync(
      'INSERT INTO canonical_derivatives (parent_id, child_id) VALUES (?, ?)',
      ['child', 'grandchild'],
    );

    const closure = await expandDerivatives(['grandparent']);
    expect(closure).toEqual(new Set(['grandparent', 'parent', 'child', 'grandchild']));
  });

  test('a cycle in the catalogue terminates rather than hanging', async () => {
    await insertCanonicalItem({
      id: 'loop-a',
      displayName: 'Loop A',
      foodClass: 'staple',
      defaultLocation: 'pantry',
      shelfLifeDays: { pantry: 365 },
      openLifeDays: null,
      typicalUseQty: null,
      typicalUseUnit: null,
    });
    await insertCanonicalItem({
      id: 'loop-b',
      displayName: 'Loop B',
      foodClass: 'staple',
      defaultLocation: 'pantry',
      shelfLifeDays: { pantry: 365 },
      openLifeDays: null,
      typicalUseQty: null,
      typicalUseUnit: null,
    });
    await testDb.runAsync(
      'INSERT INTO canonical_derivatives (parent_id, child_id) VALUES (?, ?)',
      ['loop-a', 'loop-b'],
    );
    await testDb.runAsync(
      'INSERT INTO canonical_derivatives (parent_id, child_id) VALUES (?, ?)',
      ['loop-b', 'loop-a'],
    );

    const closure = await expandDerivatives(['loop-a']);
    expect(closure).toEqual(new Set(['loop-a', 'loop-b']));
  });

  test('task 3.7 — a rule against a derivative does not exclude its parent', async () => {
    // Butter derives from milk. The closure of "butter" must not include
    // "milk" — getting this backwards would exclude half the catalogue.
    const closure = await expandDerivatives(['butter']);
    expect(closure.has('butter')).toBe(true);
    expect(closure.has('milk')).toBe(false);
  });
});

describe('the fixture corpus, against the real seeded derivative edges (task 1.2-1.4)', () => {
  async function derivatives(): Promise<Map<string, string[]>> {
    const edges = await listDerivativeEdges();
    const map = new Map<string, string[]>();
    for (const edge of edges) {
      const children = map.get(edge.parentId);
      if (children) children.push(edge.childId);
      else map.set(edge.parentId, [edge.childId]);
    }
    return map;
  }

  async function excludedUnder(
    ruleSetName: keyof typeof RULE_SETS,
    dishName: keyof typeof DIETARY_SUGGESTIONS,
  ): Promise<boolean> {
    const rules = RULE_SETS[ruleSetName]!;
    const set = expandRules(rules, await derivatives(), ['allergen', 'restriction']);
    const hasAllergen = rules.some((r) => r.kind === 'allergen');
    return applyDietary(DIETARY_SUGGESTIONS[dishName]!, set, hasAllergen).excluded;
  }

  test('a dish naming butter, ghee, or cheddar — never milk — is excluded under a milk allergen', async () => {
    expect(await excludedUnder('singleAllergen', 'butterNotMilk')).toBe(true);
    expect(await excludedUnder('singleAllergen', 'gheeNotMilk')).toBe(true);
    expect(await excludedUnder('singleAllergen', 'cheddarNotMilk')).toBe(true);
  });

  test('a dish naming fish sauce, not fish, is excluded under a fish allergen — and so is the fish itself', async () => {
    expect(await excludedUnder('fishAllergen', 'fishSauceNotFish')).toBe(true);
    expect(await excludedUnder('fishAllergen', 'salmonIsFish')).toBe(true);
  });

  test('mayonnaise is excluded under an egg allergen without ever naming eggs', async () => {
    expect(await excludedUnder('eggAllergen', 'mayonnaiseNotEgg')).toBe(true);
  });

  test('a dish with no derivative relationship to any rule is never excluded', async () => {
    expect(await excludedUnder('heavilyRestricted', 'noDerivativeInvolved')).toBe(false);
  });

  test('tamari is deliberately not linked to wheat — the wheat-free alternative stays available', async () => {
    expect(await excludedUnder('wheatAllergen', 'tamariIsNotWheat')).toBe(false);
  });

  describe('Asian derivatives (decision 4\'s audience — task 1.4)', () => {
    test('oyster sauce, shrimp, belacan, and XO sauce all resolve to shellfish', async () => {
      expect(await excludedUnder('severalAllergens', 'oysterSauceNotShellfish')).toBe(true);
      expect(await excludedUnder('severalAllergens', 'shrimpIsShellfish')).toBe(true);
      expect(await excludedUnder('severalAllergens', 'belacanIsShellfish')).toBe(true);
      expect(await excludedUnder('severalAllergens', 'xoSauceIsShellfish')).toBe(true);
    });

    test('hoisin and gochujang resolve to both soy and wheat', async () => {
      expect(await excludedUnder('soyAllergen', 'hoisinIsSoyAndWheat')).toBe(true);
      expect(await excludedUnder('wheatAllergen', 'hoisinIsSoyAndWheat')).toBe(true);
      expect(await excludedUnder('soyAllergen', 'gochujangIsSoyAndWheat')).toBe(true);
      expect(await excludedUnder('wheatAllergen', 'gochujangIsSoyAndWheat')).toBe(true);
    });

    test('tahini resolves to sesame without naming it, and so does the direct ingredient', async () => {
      expect(await excludedUnder('sesameAllergen', 'tahiniNotSesame')).toBe(true);
      expect(await excludedUnder('sesameAllergen', 'sesameOilNotSesame')).toBe(true);
      expect(await excludedUnder('sesameAllergen', 'sesameSeedDirect')).toBe(true);
    });

    test('soy sauce and miso resolve to soy without naming it', async () => {
      expect(await excludedUnder('soyAllergen', 'soySauceNotSoy')).toBe(true);
      expect(await excludedUnder('soyAllergen', 'misoNotSoy')).toBe(true);
    });
  });

  describe('oblique names — the honest test of the unknown rule (task 1.3)', () => {
    test('an obliquely-named ingredient excludes when an allergen rule exists', async () => {
      expect(await excludedUnder('singleAllergen', 'seafoodStockOblique')).toBe(true);
      expect(await excludedUnder('singleAllergen', 'mixedNutsOblique')).toBe(true);
      expect(await excludedUnder('singleAllergen', 'vegetableOilBlendOblique')).toBe(true);
      expect(await excludedUnder('singleAllergen', 'unnamedSpiceBlendOblique')).toBe(true);
    });

    test('the same obliquely-named ingredient does not exclude under a restriction-only profile', async () => {
      expect(await excludedUnder('restrictionAlone', 'seafoodStockOblique')).toBe(false);
    });

    test('the same obliquely-named ingredient does not exclude under a dislike-only profile', async () => {
      expect(await excludedUnder('dislikeAlone', 'mixedNutsOblique')).toBe(false);
    });
  });

  test('the heavily-restricted profile (11 rules) still resolves and excludes correctly', async () => {
    expect(RULE_SETS.heavilyRestricted!.length).toBeGreaterThan(10);
    expect(await excludedUnder('heavilyRestricted', 'butterNotMilk')).toBe(true);
    expect(await excludedUnder('heavilyRestricted', 'peanutButterNotPeanut')).toBe(true);
    // No soy or wheat rule in this set — excluded via the pork-belly
    // restriction it shares the dish with, not via a derivative match.
    expect(await excludedUnder('heavilyRestricted', 'hoisinIsSoyAndWheat')).toBe(true);
    expect(await excludedUnder('heavilyRestricted', 'noDerivativeInvolved')).toBe(false);
  });
});
