import { beforeEach, describe, expect, test } from 'vitest';

import {
  getAllCanonicals,
  getCanonicalById,
  insertCanonicalItem,
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

  test('round-trips all twenty nutrients through the database', async () => {
    const written = await insertCanonicalItem({
      id: 'spinach-raw',
      displayName: 'Spinach',
      foodClass: 'produce',
      defaultLocation: 'fridge',
      shelfLifeDays: { fridge: 7 },
      kcalPer100: 23,
      proteinPer100: 2.86,
      carbsPer100: 3.63,
      fatPer100: 0.39,
      fibrePer100: 2.2,
      vitaminCMgPer100: 28.1,
      ironMgPer100: 2.71,
      vitaminB12McgPer100: 0,
      calciumMgPer100: 99,
      folateMcgPer100: 194,
      vitaminAMcgPer100: 469,
      potassiumMgPer100: 558,
      vitaminDMcgPer100: 0.2,
      magnesiumMgPer100: 79,
      zincMgPer100: 0.53,
      sodiumMgPer100: 79,
      vitaminEMgPer100: 2.03,
      vitaminKMcgPer100: 482.9,
      thiaminMgPer100: 0.078,
      riboflavinMgPer100: 0.189,
    });

    const nutrition = {
      kcalPer100: written.kcalPer100,
      proteinPer100: written.proteinPer100,
      carbsPer100: written.carbsPer100,
      fatPer100: written.fatPer100,
      fibrePer100: written.fibrePer100,
      vitaminCMgPer100: written.vitaminCMgPer100,
      ironMgPer100: written.ironMgPer100,
      vitaminB12McgPer100: written.vitaminB12McgPer100,
      calciumMgPer100: written.calciumMgPer100,
      folateMcgPer100: written.folateMcgPer100,
      vitaminAMcgPer100: written.vitaminAMcgPer100,
      potassiumMgPer100: written.potassiumMgPer100,
      vitaminDMcgPer100: written.vitaminDMcgPer100,
      magnesiumMgPer100: written.magnesiumMgPer100,
      zincMgPer100: written.zincMgPer100,
      sodiumMgPer100: written.sodiumMgPer100,
      vitaminEMgPer100: written.vitaminEMgPer100,
      vitaminKMcgPer100: written.vitaminKMcgPer100,
      thiaminMgPer100: written.thiaminMgPer100,
      riboflavinMgPer100: written.riboflavinMgPer100,
    };
    // What the insert claims to have written is what a read actually returns
    // — the two used to disagree, because the last eight had no column.
    expect(await getCanonicalById('spinach-raw')).toMatchObject(nutrition);
    expect(nutrition).toEqual({
      kcalPer100: 23,
      proteinPer100: 2.86,
      carbsPer100: 3.63,
      fatPer100: 0.39,
      fibrePer100: 2.2,
      vitaminCMgPer100: 28.1,
      ironMgPer100: 2.71,
      vitaminB12McgPer100: 0,
      calciumMgPer100: 99,
      folateMcgPer100: 194,
      vitaminAMcgPer100: 469,
      potassiumMgPer100: 558,
      vitaminDMcgPer100: 0.2,
      magnesiumMgPer100: 79,
      zincMgPer100: 0.53,
      sodiumMgPer100: 79,
      vitaminEMgPer100: 2.03,
      vitaminKMcgPer100: 482.9,
      thiaminMgPer100: 0.078,
      riboflavinMgPer100: 0.189,
    });
  });

  test('an omitted extended nutrient reads back null, never zero', async () => {
    await insertCanonicalItem({
      id: 'mystery-sauce',
      displayName: 'Mystery sauce',
      foodClass: 'condiment',
      defaultLocation: 'pantry',
      shelfLifeDays: { pantry: 365 },
      sodiumMgPer100: 0,
    });

    const stored = await getCanonicalById('mystery-sauce');
    // A measured zero survives as zero; the seven unstated ones stay unknown.
    expect(stored?.sodiumMgPer100).toBe(0);
    expect(stored?.vitaminDMcgPer100).toBeNull();
    expect(stored?.magnesiumMgPer100).toBeNull();
    expect(stored?.zincMgPer100).toBeNull();
    expect(stored?.vitaminEMgPer100).toBeNull();
    expect(stored?.vitaminKMcgPer100).toBeNull();
    expect(stored?.thiaminMgPer100).toBeNull();
    expect(stored?.riboflavinMgPer100).toBeNull();
  });

  test('the shipped seed loads and reports every extended nutrient as a number or null', async () => {
    await loadSeedData();
    const canonicals = await getAllCanonicals();
    expect(canonicals.length).toBeGreaterThan(0);

    for (const canonical of canonicals) {
      for (const field of [
        'vitaminDMcgPer100',
        'magnesiumMgPer100',
        'zincMgPer100',
        'sodiumMgPer100',
        'vitaminEMgPer100',
        'vitaminKMcgPer100',
        'thiaminMgPer100',
        'riboflavinMgPer100',
      ] as const) {
        const value = canonical[field];
        // The generated asset carries no extended nutrients yet, so today
        // every one of these is null. What matters is that a value which
        // does appear survives the column round trip rather than being
        // silently dropped, and that `undefined` never reaches the app.
        expect(value === null || typeof value === 'number').toBe(true);
      }
    }
  });
});
