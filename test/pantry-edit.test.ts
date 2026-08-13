import { beforeEach, describe, expect, test } from 'vitest';

import {
  getPantryItem,
  insertPantryItem,
  loadSeedData,
  exportEverything,
  updatePantryItem,
} from '@/db/queries';
import { openTestDatabase } from './stubs/db';

describe('pantry editing', () => {
  beforeEach(async () => {
    openTestDatabase();
    await loadSeedData();
  });

  test('updates user-owned fields without creating a duplicate', async () => {
    const original = await insertPantryItem({
      canonicalId: 'jasmine-rice',
      locationId: 'pantry',
      purchasedAt: '2026-08-01',
      qtyRemaining: 500,
      qtyUnit: 'g',
    });
    const updated = await updatePantryItem(original.id, {
      canonicalId: 'oats',
      locationId: 'fridge',
      purchasedAt: '2026-08-03',
      qtyRemaining: 750,
      qtyUnit: 'g',
      expiresAt: null,
    });
    expect(updated.id).toBe(original.id);
    expect(updated.canonicalId).toBe('oats');
    expect(updated.locationId).toBe('fridge');
    expect(updated.qtyRemaining).toBe(750);
    expect(updated.qtySource).toBe('user');
  });

  test('preserves a user-supplied expiry date while editing other fields', async () => {
    const original = await insertPantryItem({
      canonicalId: 'milk',
      locationId: 'fridge',
      purchasedAt: '2026-08-01',
      expiresAt: '2026-08-20',
      expirySource: 'label',
    });
    const updated = await updatePantryItem(original.id, {
      canonicalId: original.canonicalId,
      locationId: 'counter',
      purchasedAt: '2026-08-02',
      qtyRemaining: null,
      qtyUnit: null,
      expiresAt: original.expiresAt,
    });
    expect(updated.expiresAt).toBe('2026-08-20');
    expect(updated.expirySource).toBe('label');
    expect((await getPantryItem(original.id))?.locationId).toBe('counter');
  });

  test('exports the corrected pantry record', async () => {
    const original = await insertPantryItem({ canonicalId: 'milk', locationId: 'fridge', qtyRemaining: 1000, qtyUnit: 'ml' });
    await updatePantryItem(original.id, { canonicalId: 'milk', locationId: 'counter', purchasedAt: original.purchasedAt, qtyRemaining: 2, qtyUnit: 'ml', expiresAt: null });
    const exported = await exportEverything(1);
    expect(exported.pantryItems.find((item) => item.id === original.id)?.locationId).toBe('counter');
  });
});
