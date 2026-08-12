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
  test('creates a profile, history, rich pantry, recipes, and barcode recents', async () => {
    const now = new Date('2026-08-11T18:00:00.000Z');
    const summary = await populateDemoData(now);

    expect(summary).toEqual({ meals: 14, pantryItems: 18, barcodeScans: 4, recipes: 2 });
    expect(await getProfile()).toMatchObject({ targetCalories: 2250, fibreTargetG: 30 });
    expect(await getLoggedDates()).toHaveLength(8);
    expect(await getMealsForDate('2026-08-11')).toHaveLength(2);
    expect(await listPantryItems()).toHaveLength(18);
    expect(await listRecipes()).toHaveLength(2);

    const scans = await listRecentScannedProducts();
    expect(scans).toHaveLength(4);
    expect(scans.map((product) => product.gtin)).toEqual([
      '0000000001014',
      '0000000001021',
      '0000000001038',
      '0000000001045',
    ]);
  });
});
