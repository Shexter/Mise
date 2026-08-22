import { beforeEach, describe, expect, test } from 'vitest';

import { populateDemoData } from '@/db/demoData';
import {
  getLoggedDates,
  getMealsForDate,
  getProfile,
  listPantryItems,
  listRecentScannedProducts,
  listRecipes,
  loadSeedData,
} from '@/db/queries';
import { openTestDatabase } from './stubs/db';

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
});

describe('development demo data', () => {
  test('creates a profile, history, rich pantry, recipes, barcode recents, and shopping items', async () => {
    const now = new Date('2026-08-11T18:00:00.000Z');
    const summary = await populateDemoData(now);

    expect(summary.meals).toBe(57);
    expect(summary.pantryItems).toBe(24);
    expect(summary.barcodeScans).toBe(5);
    expect(summary.recipes).toBe(4);
    expect(summary.shoppingItems).toBe(5);

    expect(await getProfile()).toMatchObject({ targetCalories: 2250, fibreTargetG: 32 });
    expect((await getLoggedDates()).length).toBeGreaterThanOrEqual(18);
    expect(await getMealsForDate('2026-08-11')).toHaveLength(3);
    expect(await listPantryItems()).toHaveLength(24);
    expect(await listRecipes()).toHaveLength(4);

    const scans = await listRecentScannedProducts();
    expect(scans).toHaveLength(5);
  });
});
