import { beforeEach, describe, expect, test } from 'vitest';

import {
  applyShoppingRestock,
  getAllCanonicals,
  getLocations,
  getPantryItem,
  insertPantryItem,
  insertShoppingListItem,
  listPantryItems,
  listShoppingItems,
  loadSeedData,
  markItemUsedUp,
  undoShoppingRestock,
  updateShoppingListItem,
} from '@/db/queries';
import { restockFromShoppingItem } from '@/logic/stockRestock';
import type { CanonicalItem, Location, PantryItem, ShoppingListItem } from '@/types';
import { openTestDatabase } from './stubs/db';

const canonical = {
  id: 'rice',
  defaultLocation: 'pantry',
  shelfLifeDays: { pantry: 365 },
  openLifeDays: null,
} as Pick<CanonicalItem, 'id' | 'defaultLocation' | 'shelfLifeDays' | 'openLifeDays'>;

const pantryLocation = {
  id: 'pantry',
  kind: 'ambient',
} as Pick<Location, 'id' | 'kind'>;

function shopping(canonicalId: string | null = 'rice', status: ShoppingListItem['status'] = 'purchased') {
  return { id: 'shopping-rice', canonicalId, status } as Pick<ShoppingListItem, 'id' | 'canonicalId' | 'status'>;
}

function pantryItem(id: string, status: PantryItem['status'], canonicalId = 'rice') {
  return { id, canonicalId, status } as Pick<PantryItem, 'id' | 'canonicalId' | 'status'>;
}

describe('shopping restock planning', () => {
  test('creates a distinct container with predicted expiry and no claimed quantity', () => {
    const plan = restockFromShoppingItem(
      shopping(),
      [pantryItem('existing', 'in_stock')],
      canonical,
      [pantryLocation],
      '2026-08-26',
    );

    expect(plan).toEqual({
      shoppingItemId: 'shopping-rice',
      item: {
        canonicalId: 'rice',
        locationId: 'pantry',
        purchasedAt: '2026-08-26',
        expiresAt: '2027-08-26',
      },
      replacedItemIds: [],
    });
    expect(plan?.item).not.toHaveProperty('qtyRemaining');
  });

  test('marks only matching out containers for replacement', () => {
    const plan = restockFromShoppingItem(
      shopping(),
      [
        pantryItem('out', 'out'),
        pantryItem('low', 'running_low'),
        pantryItem('stocked', 'in_stock'),
        pantryItem('other', 'out', 'milk'),
      ],
      canonical,
      [pantryLocation],
      '2026-08-26',
    );

    expect(plan?.replacedItemIds).toEqual(['out']);
  });

  test('falls back to the first configured location when the canonical default id is absent', () => {
    const fallback = { id: 'cupboard', kind: 'ambient' } as Pick<Location, 'id' | 'kind'>;
    const plan = restockFromShoppingItem(shopping(), [], canonical, [fallback], '2026-08-26');

    expect(plan?.item.locationId).toBe('cupboard');
    expect(plan?.item.expiresAt).toBe('2027-08-26');
  });

  test('refuses unresolved identities and missing locations', () => {
    expect(restockFromShoppingItem(shopping(null), [], null, [pantryLocation], '2026-08-26')).toBeNull();
    expect(restockFromShoppingItem(shopping(), [], canonical, [], '2026-08-26')).toBeNull();
    expect(restockFromShoppingItem(shopping('rice', 'open'), [], canonical, [pantryLocation], '2026-08-26')).toBeNull();
  });
});

describe('shopping restock persistence', () => {
  beforeEach(async () => {
    openTestDatabase();
    await loadSeedData();
  });

  test('applies and undoes the pantry and shopping changes together', async () => {
    const allCanonicals = await getAllCanonicals();
    const rice = allCanonicals.find((item) => item.id === 'jasmine-rice');
    expect(rice).toBeDefined();
    const locations = await getLocations();
    const old = await insertPantryItem({ canonicalId: 'jasmine-rice', locationId: 'pantry' });
    await markItemUsedUp(old.id);
    const shoppingItem = await insertShoppingListItem({
      canonicalId: 'jasmine-rice',
      displayName: 'Rice',
      normalizedName: 'rice',
      status: 'purchased',
    });
    const plan = restockFromShoppingItem(
      shoppingItem,
      await listPantryItems(),
      rice ?? null,
      locations,
      '2026-08-26',
    );
    expect(plan).not.toBeNull();

    const undo = await applyShoppingRestock(plan!);
    expect((await getPantryItem(old.id))?.status).toBe('replaced');
    expect((await getPantryItem(undo.createdItemId))?.status).toBe('in_stock');

    await undoShoppingRestock(undo, shoppingItem.id, 'open');
    expect(await getPantryItem(undo.createdItemId)).toBeNull();
    expect((await getPantryItem(old.id))?.status).toBe('out');
    expect((await listShoppingItems(true)).find((item) => item.id === shoppingItem.id)?.status).toBe('open');
  });

  test('rejects a stale restock after the purchase has already been restored', async () => {
    const rice = (await getAllCanonicals()).find((item) => item.id === 'jasmine-rice');
    const shoppingItem = await insertShoppingListItem({
      canonicalId: 'jasmine-rice',
      displayName: 'Rice',
      normalizedName: 'rice',
      status: 'purchased',
    });
    const plan = restockFromShoppingItem(
      shoppingItem,
      [],
      rice ?? null,
      await getLocations(),
      '2026-08-26',
    );
    expect(plan).not.toBeNull();
    await updateShoppingListItem(shoppingItem.id, { status: 'open' });

    await expect(applyShoppingRestock(plan!)).rejects.toThrow('no longer marked purchased');
    expect(await listPantryItems()).toEqual([]);
  });
});
