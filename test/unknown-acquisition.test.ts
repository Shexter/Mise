import { beforeEach, describe, expect, test } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

import {
  canPredictFrom,
  knownAcquisition,
  predictExpiryFromAcquisition,
  unknownAcquisition,
} from '../src/logic/acquisition';
import {
  MAX_ROWS_PER_PROPOSAL,
  UNKNOWN_QUANTITY,
  materialise,
  rowCount,
} from '../src/logic/materialisation';
import { LATEST_VERSION, MIGRATIONS } from '../src/db/schema';
import {
  getPantryItem,
  insertPantryItem,
  loadSeedData,
  updateItemLocation,
} from '../src/db/queries';
import { openTestDatabase } from './stubs/db';

const CHICKEN = { shelfLifeDays: { fridge: 2, freezer: 270 }, openLifeDays: 3 };

describe('an unknown acquisition date predicts nothing', () => {
  test('a known date still predicts as it always did', () => {
    expect(
      predictExpiryFromAcquisition(
        CHICKEN,
        'fridge',
        knownAcquisition('2026-08-01'),
        null,
      ),
    ).toBe('2026-08-03');
  });

  test('an unknown date produces no expiry at all', () => {
    expect(
      predictExpiryFromAcquisition(
        CHICKEN,
        'fridge',
        unknownAcquisition('2026-08-01'),
        null,
      ),
    ).toBeNull();
  });

  test('the capture date does not leak in as a purchase date', () => {
    // The bug this guards: writing today's date and predicting from it gives
    // a confident freshness claim for food of unknown age.
    const unknown = predictExpiryFromAcquisition(
      CHICKEN,
      'freezer',
      unknownAcquisition('2026-08-01'),
      null,
    );
    const known = predictExpiryFromAcquisition(
      CHICKEN,
      'freezer',
      knownAcquisition('2026-08-01'),
      null,
    );
    expect(known).not.toBeNull();
    expect(unknown).toBeNull();
  });

  test('an opened date the user gave still counts, from the opened life only', () => {
    // Opening is the user's own evidence even when the purchase date is not.
    expect(
      predictExpiryFromAcquisition(
        CHICKEN,
        'fridge',
        unknownAcquisition('2026-08-01'),
        '2026-08-10',
      ),
    ).toBe('2026-08-13');
  });

  test('recompute is refused for unknown acquisition', () => {
    expect(canPredictFrom(unknownAcquisition('2026-08-01'))).toBe(false);
    expect(canPredictFrom(knownAcquisition('2026-08-01'))).toBe(true);
  });
});

describe('the pantry stores the distinction', () => {
  beforeEach(async () => {
    openTestDatabase();
    await loadSeedData();
  });

  test('an ordinary insert is known and predicts', async () => {
    const item = await insertPantryItem({
      canonicalId: 'chicken-breast',
      locationId: 'fridge',
      purchasedAt: '2026-08-01',
    });
    expect(item.acquiredAtKnown).toBe(true);
    expect(item.expiresAt).not.toBeNull();
  });

  test('a first-inventory insert is unknown and predicts nothing', async () => {
    const item = await insertPantryItem({
      canonicalId: 'chicken-breast',
      locationId: 'fridge',
      purchasedAt: '2026-08-01',
      acquiredAtKnown: false,
    });
    expect(item.acquiredAtKnown).toBe(false);
    expect(item.expiresAt).toBeNull();
    expect(item.expirySource).toBeNull();
  });

  test('moving an unknown item between locations still predicts nothing', async () => {
    const item = await insertPantryItem({
      canonicalId: 'chicken-breast',
      locationId: 'fridge',
      acquiredAtKnown: false,
    });
    await updateItemLocation(item.id, 'freezer');
    const moved = await getPantryItem(item.id);
    // A freezer move is exactly where a fabricated purchase date would produce
    // a nine-month claim about food of unknown age.
    expect(moved?.expiresAt).toBeNull();
    expect(moved?.acquiredAtKnown).toBe(false);
  });
});

describe('the migration', () => {
  test('existing rows default to a known date and are otherwise untouched', () => {
    const db = new DatabaseSync(':memory:');
    const index = MIGRATIONS.findIndex((statement) =>
      statement.includes('ADD COLUMN acquired_at_known'),
    );
    expect(index).toBeGreaterThan(0);
    for (let version = 0; version < index; version += 1) db.exec(MIGRATIONS[version]!);

    db.prepare(
      `INSERT INTO canonical_items
         (id, display_name, class, default_location, shelf_life_days, is_seed, created_at)
       VALUES ('milk', 'Milk', 'dairy', 'fridge', '{"fridge":7}', 1, '2026-01-01T00:00:00Z')`,
    ).run();
    db.prepare(
      `INSERT INTO pantry_items
         (id, canonical_id, location_id, purchased_at, status, created_at, updated_at)
       VALUES ('p1', 'milk', 'fridge', '2026-07-01', 'in_stock', '2026-07-01T00:00:00Z', '2026-07-01T00:00:00Z')`,
    ).run();

    for (let version = index; version < LATEST_VERSION; version += 1) {
      db.exec(MIGRATIONS[version]!);
    }

    expect(
      db.prepare('SELECT purchased_at, acquired_at_known FROM pantry_items WHERE id = ?').get('p1'),
    ).toEqual({ purchased_at: '2026-07-01', acquired_at_known: 1 });

    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]
    ).map((row) => row.name);
    expect(tables).toContain('pantry_intake_batches');
    expect(tables).toContain('pantry_intake_batch_items');
    db.close();
  });

  test('a draft id can only produce one batch', () => {
    const db = new DatabaseSync(':memory:');
    for (let version = 0; version < LATEST_VERSION; version += 1) db.exec(MIGRATIONS[version]!);
    const insert = db.prepare(
      `INSERT INTO pantry_intake_batches (id, draft_id, source, item_count, created_at)
       VALUES (?, ?, 'voice', 1, '2026-08-31T00:00:00Z')`,
    );
    insert.run('b1', 'draft-1');
    expect(() => insert.run('b2', 'draft-1')).toThrow();
    db.close();
  });
});

describe('a container makes a row; a loose count makes an amount', () => {
  test('two cans of tomatoes are two rows, each carrying its own amount', () => {
    const plan = materialise({
      containerCount: 2,
      amount: 400,
      unit: 'g',
      approximate: false,
    });
    expect(plan.rows).toEqual([
      { qtyRemaining: 400, qtyUnit: 'g' },
      { qtyRemaining: 400, qtyUnit: 'g' },
    ]);
  });

  test('three carrots are one row of three pieces, not three rows', () => {
    const plan = materialise({
      containerCount: null,
      amount: 3,
      unit: 'piece',
      approximate: false,
    });
    expect(plan.rows).toEqual([{ qtyRemaining: 3, qtyUnit: 'piece' }]);
  });

  test('a pack of six chicken breasts is one row holding six pieces', () => {
    const plan = materialise({
      containerCount: 1,
      amount: 6,
      unit: 'piece',
      approximate: false,
    });
    expect(plan.rows).toEqual([{ qtyRemaining: 6, qtyUnit: 'piece' }]);
  });

  test('an unknown quantity is still one present row, holding no figure', () => {
    expect(materialise(UNKNOWN_QUANTITY).rows).toEqual([
      { qtyRemaining: null, qtyUnit: null },
    ]);
  });

  test('an approximate amount is not stored as a number', () => {
    const plan = materialise({
      containerCount: 1,
      amount: 0.5,
      unit: 'ml',
      approximate: true,
    });
    // "About half a carton" must not become a quantity the UI can echo back.
    expect(plan.rows).toEqual([{ qtyRemaining: null, qtyUnit: null }]);
  });

  test('an implausible container count is held for review rather than written', () => {
    const plan = materialise({
      containerCount: MAX_ROWS_PER_PROPOSAL + 1,
      amount: null,
      unit: null,
      approximate: false,
    });
    expect(plan.rows).toEqual([]);
    expect(plan.blocked).toBe('too_many_containers');
  });

  test('row count matches what will be written', () => {
    expect(rowCount({ containerCount: 3, amount: null, unit: null, approximate: false })).toBe(3);
    expect(rowCount(UNKNOWN_QUANTITY)).toBe(1);
  });
});
