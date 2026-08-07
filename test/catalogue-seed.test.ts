import { beforeEach, describe, expect, test } from 'vitest';

import {
  getCanonicalById,
  loadSeedData,
} from '@/db/queries';
import { db, openTestDatabase } from './stubs/db';

describe('catalogue seed hydration', () => {
  beforeEach(() => {
    openTestDatabase();
  });

  test('loads nullable nutrition and per-field provenance from the generated asset', async () => {
    await loadSeedData();
    const ginger = await getCanonicalById('ginger');
    expect(ginger).toMatchObject({
      earlyWarningDays: 2,
      kcalPer100: 80,
      proteinPer100: 1.82,
      carbsPer100: 17.77,
      fatPer100: 0.75,
    });
    expect(ginger?.sources).toMatchObject({
      'shelfLifeDays.pantry': 'foodkeeper',
      earlyWarningDays: 'foodkeeper',
      kcalPer100: 'food-data-central',
    });
  });

  test('refreshes existing shipped seed rows but preserves a colliding user row', async () => {
    await db().runAsync(
      `INSERT INTO canonical_items
         (id, display_name, class, default_location, shelf_life_days,
          sources, is_seed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'ginger',
        'Old ginger',
        'produce',
        'counter',
        '{}',
        '{}',
        1,
        '2026-01-01',
      ],
    );
    await db().runAsync(
      `INSERT INTO canonical_items
         (id, display_name, class, default_location, shelf_life_days,
          sources, is_seed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'banana',
        'My banana',
        'produce',
        'counter',
        '{"counter":99}',
        '{}',
        0,
        '2026-01-01',
      ],
    );

    await loadSeedData();

    expect(await getCanonicalById('ginger')).toMatchObject({
      displayName: 'Ginger',
      earlyWarningDays: 2,
      kcalPer100: 80,
    });
    expect(await getCanonicalById('banana')).toMatchObject({
      displayName: 'My banana',
      shelfLifeDays: { counter: 99 },
      isSeed: false,
    });
  });
});
