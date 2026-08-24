import { describe, expect, test } from 'vitest';

import {
  buildRefreshPlan,
  canAutoMatchReceipt,
  closedShoppingItems,
  groupShoppingItems,
  manualEntryDraft,
  mergeShoppingSources,
  orphanedOpenItemIds,
  planCanonicalReassignment,
  quantityLabel,
  sourceExplanations,
  undoReceiptMatch,
  validateShoppingQuantity,
} from '@/logic/shoppingList';
import type { CanonicalItem, PantryItem, ShoppingListItem, ShoppingListSource } from '@/types';

const canonical = (id: string, foodClass: CanonicalItem['foodClass'] = 'staple'): CanonicalItem => ({
  id, displayName: `${id.slice(0, 1).toUpperCase()}${id.slice(1)}`, foodClass, defaultLocation: 'pantry',
  shelfLifeDays: {}, earlyWarningDays: null, openLifeDays: null, sources: {},
  kcalPer100: null, proteinPer100: null, carbsPer100: null, fatPer100: null,
  fibrePer100: null, vitaminCMgPer100: null, ironMgPer100: null, vitaminB12McgPer100: null,
  calciumMgPer100: null, folateMcgPer100: null, vitaminAMcgPer100: null, potassiumMgPer100: null,
  vitaminDMcgPer100: null, magnesiumMgPer100: null, zincMgPer100: null, sodiumMgPer100: null, vitaminEMgPer100: null, vitaminKMcgPer100: null, thiaminMgPer100: null, riboflavinMgPer100: null,
  typicalUseQty: null, typicalUseUnit: null, typicalPkgQty: null, typicalPkgUnit: null,
  densityGPerMl: null, isSeed: true, createdAt: '2026-01-01',
});

const pantry = (canonicalId: string, status: PantryItem['status'], id = `${canonicalId}-pantry`): PantryItem => ({
  id, canonicalId, productId: null, locationId: 'pantry',
  qtyRemaining: null, qtyUnit: null, qtySource: null, fullness: null, usesCount: 0,
  purchasedAt: '2026-01-01', openedAt: null, expiresAt: null, expirySource: null,
  priceCents: null, photoUri: null, status, estimatedDecrementsSinceAnchor: 0,
  lastAnchorAt: null, replacementAsked: false, createdAt: '2026-01-01', updatedAt: '2026-01-01',
});

const source = (overrides: Partial<ShoppingListSource> = {}): ShoppingListSource => ({
  id: 'source-1', shoppingItemId: 'item-1', kind: 'manual', sourceId: null,
  recipeId: null, suggestionId: null, createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const item = (overrides: Partial<ShoppingListItem> = {}): ShoppingListItem => ({
  id: 'item-1', canonicalId: null, displayName: 'Item', normalizedName: 'item',
  status: 'open', requestedQty: null, requestedUnit: null, note: null,
  category: 'other', sortOrder: 0, createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z', completedAt: null, sources: [source()],
  ...overrides,
});

describe('shopping list refresh planning', () => {
  test('adds low/out pantry sources and recipe gaps but not covered ingredients', () => {
    const plan = buildRefreshPlan({
      existingItems: [],
      pantry: [pantry('rice', 'out'), pantry('beans', 'in_stock')],
      recipes: [{ id: 'r1', ingredients: [
        { id: 'i1', recipeId: 'r1', name: 'Rice', quantity: 200, unit: 'g', canonicalId: 'rice', sortOrder: 0 },
        { id: 'i2', recipeId: 'r1', name: 'Beans', quantity: null, unit: null, canonicalId: 'beans', sortOrder: 1 },
        { id: 'i3', recipeId: 'r1', name: 'Lime', quantity: null, unit: null, canonicalId: null, sortOrder: 2 },
      ] }], suggestions: [], canonicals: new Map([['rice', canonical('rice')], ['beans', canonical('beans', 'protein')]]),
    });
    expect(plan.additions.map((entry) => entry.kind)).toEqual(['pantry_out', 'recipe_missing', 'recipe_missing']);
    expect(plan.additions[2]?.displayName).toBe('Lime');
  });

  test('marks a pantry_low/pantry_out source stale once the pantry row is no longer out/low', () => {
    const existing = item({
      sources: [source({ kind: 'pantry_out', sourceId: 'rice-pantry' })],
    });
    const plan = buildRefreshPlan({
      existingItems: [existing],
      pantry: [pantry('rice', 'in_stock')],
      recipes: [], suggestions: [], canonicals: new Map([['rice', canonical('rice')]]),
    });
    expect(plan.staleAutomaticSources).toEqual([
      { shoppingItemId: 'item-1', kind: 'pantry_out', sourceId: 'rice-pantry', recipeId: null, suggestionId: null },
    ]);
  });

  test('marks a recipe_missing source stale once the ingredient is covered or the recipe is gone', () => {
    const existing = item({
      sources: [source({ kind: 'recipe_missing', sourceId: 'i1', recipeId: 'r1' })],
    });
    const plan = buildRefreshPlan({
      existingItems: [existing],
      pantry: [pantry('rice', 'in_stock')],
      recipes: [], // the recipe that used to need rice no longer requests it
      suggestions: [], canonicals: new Map([['rice', canonical('rice')]]),
    });
    expect(plan.staleAutomaticSources).toEqual([
      { shoppingItemId: 'item-1', kind: 'recipe_missing', sourceId: 'i1', recipeId: 'r1', suggestionId: null },
    ]);
  });

  test('never marks manual sources stale, and never marks suggestion_missing stale from an empty (non-authoritative) suggestions input', () => {
    const existing = item({
      sources: [
        source({ id: 's1', kind: 'manual' }),
        source({ id: 's2', kind: 'suggestion_missing', suggestionId: 'sugg-1' }),
      ],
    });
    const plan = buildRefreshPlan({
      existingItems: [existing],
      pantry: [], recipes: [], suggestions: [], // suggestions: [] must not be read as "no suggestion is active"
      canonicals: new Map(),
    });
    expect(plan.staleAutomaticSources).toEqual([]);
  });

  test('a still-valid pantry_low source is not flagged stale', () => {
    const existing = item({
      canonicalId: 'rice',
      sources: [source({ kind: 'pantry_low', sourceId: 'rice-pantry' })],
    });
    const plan = buildRefreshPlan({
      existingItems: [existing],
      pantry: [pantry('rice', 'running_low', 'rice-pantry')],
      recipes: [], suggestions: [], canonicals: new Map([['rice', canonical('rice')]]),
    });
    expect(plan.staleAutomaticSources).toEqual([]);
  });
});

describe('orphaned item cleanup', () => {
  test('an open item left with zero sources is orphaned', () => {
    const items = [item({ id: 'a', status: 'open', sources: [] })];
    expect(orphanedOpenItemIds(items)).toEqual(['a']);
  });

  test('a closed item with zero sources is preserved as history, not orphaned', () => {
    const items = [
      item({ id: 'a', status: 'purchased', sources: [] }),
      item({ id: 'b', status: 'snoozed', sources: [] }),
      item({ id: 'c', status: 'dismissed', sources: [] }),
    ];
    expect(orphanedOpenItemIds(items)).toEqual([]);
  });

  test('an open item with a remaining source is not orphaned', () => {
    const items = [item({ id: 'a', status: 'open', sources: [source()] })];
    expect(orphanedOpenItemIds(items)).toEqual([]);
  });
});

describe('shopping list merging, grouping, and receipt matching', () => {
  test('merges sources by canonical identity and keeps explicit quantities', () => {
    const merged = mergeShoppingSources([], [
      { kind: 'pantry_low', sourceId: 'p1', canonicalId: 'rice', displayName: 'Rice' },
      { kind: 'recipe_missing', sourceId: 'i1', recipeId: 'r1', canonicalId: 'rice', displayName: 'rice', requestedQty: 2, requestedUnit: 'piece' },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.sources).toHaveLength(2);
    expect(quantityLabel(merged[0]!)).toBe('2 piece');
  });

  test('groups only open items and rejects fuzzy receipt matches', () => {
    const items = mergeShoppingSources([], [
      { kind: 'manual', canonicalId: null, displayName: 'Oat milk' },
      { kind: 'pantry_out', canonicalId: 'rice', displayName: 'Rice', category: 'staple' },
    ]);
    items[0]!.status = 'purchased';
    expect(groupShoppingItems(items)).toHaveLength(1);
    expect(canAutoMatchReceipt(items[1]!, 'rice')).toBe(true);
    expect(canAutoMatchReceipt(items[1]!, 'brown-rice')).toBe(false);
  });

  test('groups a persisted unknown category under Other instead of crashing', () => {
    const legacy = item({ category: 'bakery' as ShoppingListItem['category'] });

    expect(groupShoppingItems([legacy])).toMatchObject([
      { category: 'other', label: 'Other', items: [legacy] },
    ]);
  });

  test('undo is one-shot and restores the prior status', () => {
    expect(undoReceiptMatch({ previousStatus: 'open', undoneAt: null }, 'now')).toEqual({ status: 'open', undoneAt: 'now' });
    expect(undoReceiptMatch({ previousStatus: 'open', undoneAt: 'earlier' }, 'now')).toBeNull();
  });

  test('closed items exclude open ones and sort most-recently-updated first', () => {
    const items = mergeShoppingSources([], [
      { kind: 'manual', canonicalId: null, displayName: 'Oat milk' },
      { kind: 'pantry_out', canonicalId: 'rice', displayName: 'Rice', category: 'staple' },
      { kind: 'manual', canonicalId: null, displayName: 'Lime' },
    ]);
    items[0]!.status = 'purchased';
    items[0]!.updatedAt = '2026-01-01T00:00:00.000Z';
    items[2]!.status = 'dismissed';
    items[2]!.updatedAt = '2026-01-02T00:00:00.000Z';
    const closed = closedShoppingItems(items);
    expect(closed.map((entry) => entry.displayName)).toEqual(['Lime', 'Oat milk']);
  });
});

describe('source explanations', () => {
  test('non-recipe sources are human-readable and deduplicated', () => {
    expect(sourceExplanations([{ kind: 'pantry_low' }])).toEqual(['Running low in your pantry']);
    expect(sourceExplanations([{ kind: 'manual' }, { kind: 'manual' }])).toEqual(['Added manually']);
  });

  test('two recipes needing the same ingredient produce two distinct explanations, not one generic label', () => {
    const titles = new Map([['r1', 'Chicken Stir-fry'], ['r2', 'Fried Rice']]);
    expect(sourceExplanations([
      { kind: 'recipe_missing', recipeId: 'r1' },
      { kind: 'recipe_missing', recipeId: 'r2' },
    ], titles)).toEqual(['Missing for Chicken Stir-fry', 'Missing for Fried Rice']);
  });

  test('the same recipe cited twice collapses to one explanation', () => {
    const titles = new Map([['r1', 'Chicken Stir-fry']]);
    expect(sourceExplanations([
      { kind: 'recipe_missing', recipeId: 'r1' },
      { kind: 'recipe_missing', recipeId: 'r1' },
    ], titles)).toEqual(['Missing for Chicken Stir-fry']);
  });

  test('falls back to a generic label when no title is known for the recipe', () => {
    expect(sourceExplanations([{ kind: 'recipe_missing', recipeId: 'unknown-recipe' }]))
      .toEqual(['Missing for a saved recipe']);
  });
});

describe('quantity validation', () => {
  test('blank is valid and means unspecified', () => {
    expect(validateShoppingQuantity('')).toEqual({ quantity: null, error: null });
    expect(validateShoppingQuantity('   ')).toEqual({ quantity: null, error: null });
  });

  test('a positive number is valid', () => {
    expect(validateShoppingQuantity('2.5')).toEqual({ quantity: 2.5, error: null });
  });

  test('zero is valid (non-negative)', () => {
    expect(validateShoppingQuantity('0')).toEqual({ quantity: 0, error: null });
  });

  test('a negative number is rejected with a visible error', () => {
    const result = validateShoppingQuantity('-3');
    expect(result.quantity).toBeNull();
    expect(result.error).toBeTruthy();
  });

  test('a non-numeric entry is rejected with a visible error', () => {
    const result = validateShoppingQuantity('abc');
    expect(result.quantity).toBeNull();
    expect(result.error).toBeTruthy();
  });

  test('Infinity is rejected as non-finite', () => {
    const result = validateShoppingQuantity('Infinity');
    expect(result.quantity).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

describe('manual entry drafting', () => {
  test('a canonical selection derives display name and category, ignoring typed text', () => {
    const draft = manualEntryDraft('whatever the user typed', canonical('rice', 'staple'), 'other');
    expect(draft).toEqual({ canonicalId: 'rice', displayName: 'Rice', normalizedName: 'rice', category: 'staple' });
  });

  test('without a canonical, the typed name and chosen category are kept as entered', () => {
    const draft = manualEntryDraft('  Scallions  ', null, 'produce');
    expect(draft).toEqual({ canonicalId: null, displayName: 'Scallions', normalizedName: 'scallions', category: 'produce' });
  });
});

describe('canonical reassignment planning', () => {
  test('no collision: updates the edited item in place', () => {
    const items = [item({ id: 'a', canonicalId: null, status: 'open' })];
    expect(planCanonicalReassignment(items, 'a', 'rice')).toEqual({ kind: 'update', targetItemId: 'a' });
  });

  test('collision with another open item sharing the canonical: merges into it', () => {
    const items = [
      item({ id: 'a', canonicalId: null, status: 'open' }),
      item({ id: 'b', canonicalId: 'rice', status: 'open' }),
    ];
    expect(planCanonicalReassignment(items, 'a', 'rice')).toEqual({ kind: 'merge', targetItemId: 'b' });
  });

  test('a closed item sharing the canonical is history, not a collision', () => {
    const items = [
      item({ id: 'a', canonicalId: null, status: 'open' }),
      item({ id: 'b', canonicalId: 'rice', status: 'purchased' }),
    ];
    expect(planCanonicalReassignment(items, 'a', 'rice')).toEqual({ kind: 'update', targetItemId: 'a' });
  });

  test('re-picking the same canonical the item already has is not a self-collision', () => {
    const items = [item({ id: 'a', canonicalId: 'rice', status: 'open' })];
    expect(planCanonicalReassignment(items, 'a', 'rice')).toEqual({ kind: 'update', targetItemId: 'a' });
  });

  test('clearing a canonical (setting null) never merges', () => {
    const items = [
      item({ id: 'a', canonicalId: 'rice', status: 'open' }),
      item({ id: 'b', canonicalId: null, status: 'open' }),
    ];
    expect(planCanonicalReassignment(items, 'a', null)).toEqual({ kind: 'update', targetItemId: 'a' });
  });
});
