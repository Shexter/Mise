import { describe, expect, test } from 'vitest';

import {
  buildRefreshPlan,
  canAutoMatchReceipt,
  groupShoppingItems,
  mergeShoppingSources,
  quantityLabel,
  undoReceiptMatch,
} from '@/logic/shoppingList';
import type { CanonicalItem, PantryItem, ShoppingListItem } from '@/types';

const canonical = (id: string, foodClass: CanonicalItem['foodClass'] = 'staple'): CanonicalItem => ({
  id, displayName: `${id.slice(0, 1).toUpperCase()}${id.slice(1)}`, foodClass, defaultLocation: 'pantry',
  shelfLifeDays: {}, earlyWarningDays: null, openLifeDays: null, sources: {},
  kcalPer100: null, proteinPer100: null, carbsPer100: null, fatPer100: null,
  typicalUseQty: null, typicalUseUnit: null, typicalPkgQty: null, typicalPkgUnit: null,
  densityGPerMl: null, isSeed: true, createdAt: '2026-01-01',
});

const pantry = (canonicalId: string, status: PantryItem['status']): PantryItem => ({
  id: `${canonicalId}-pantry`, canonicalId, productId: null, locationId: 'pantry',
  qtyRemaining: null, qtyUnit: null, qtySource: null, fullness: null, usesCount: 0,
  purchasedAt: '2026-01-01', openedAt: null, expiresAt: null, expirySource: null,
  priceCents: null, photoUri: null, status, estimatedDecrementsSinceAnchor: 0,
  lastAnchorAt: null, replacementAsked: false, createdAt: '2026-01-01', updatedAt: '2026-01-01',
});

describe('shopping list logic', () => {
  test('adds low/out pantry sources and recipe gaps but not covered ingredients', () => {
    const plan = buildRefreshPlan({
      pantry: [pantry('rice', 'out'), pantry('beans', 'in_stock')],
      recipes: [{ id: 'r1', ingredients: [
        { id: 'i1', recipeId: 'r1', name: 'Rice', quantity: 200, unit: 'g', canonicalId: 'rice', sortOrder: 0 },
        { id: 'i2', recipeId: 'r1', name: 'Beans', quantity: null, unit: null, canonicalId: 'beans', sortOrder: 1 },
        { id: 'i3', recipeId: 'r1', name: 'Lime', quantity: null, unit: null, canonicalId: null, sortOrder: 2 },
      ] }], suggestions: [], canonicals: new Map([['rice', canonical('rice')], ['beans', canonical('beans', 'protein')]]),
    });
    expect(plan.additions.map((item) => item.kind)).toEqual(['pantry_out', 'recipe_missing', 'recipe_missing']);
    expect(plan.additions[2]?.displayName).toBe('Lime');
  });

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

  test('undo is one-shot and restores the prior status', () => {
    expect(undoReceiptMatch({ previousStatus: 'open', undoneAt: null }, 'now')).toEqual({ status: 'open', undoneAt: 'now' });
    expect(undoReceiptMatch({ previousStatus: 'open', undoneAt: 'earlier' }, 'now')).toBeNull();
  });
});
