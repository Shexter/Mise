import { DatabaseSync } from 'node:sqlite';

import { describe, expect, test } from 'vitest';

import { DROP_ALL, LATEST_VERSION, MIGRATIONS } from '../src/db/schema';

/**
 * Mirrors `migrate` in `src/db/index.ts`: applies `MIGRATIONS[version]` until
 * the target version is reached.
 */
function migrate(db: DatabaseSync, from: number, to: number): void {
  for (let version = from; version < to; version += 1) {
    const statement = MIGRATIONS[version];
    if (!statement) break;
    db.exec(statement);
    db.exec(`PRAGMA user_version = ${version + 1}`);
  }
}

function tableNames(db: DatabaseSync): string[] {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all() as { name: string }[];
  return rows.map((row) => row.name);
}

const IDENTITY_TABLES = [
  'canonical_items',
  'item_aliases',
  'match_queue',
  'products',
];

const PANTRY_TABLES = ['locations', 'pantry_items'];

describe('migrations', () => {
  test('a fresh install reaches the latest version with every table', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, 0, LATEST_VERSION);

    const tables = tableNames(db);
    for (const table of [...IDENTITY_TABLES, ...PANTRY_TABLES]) {
      expect(tables).toContain(table);
    }
    expect(tables).toContain('meals');
    expect(tables).toContain('profile');
    expect(tables).toContain('dish_venue_defaults');
    expect(tables).toContain('body_measurements');
    expect(tables).toContain('barcode_misses');
    db.close();
  });

  test('a fresh install seeds the four default locations', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, 0, LATEST_VERSION);
    const rows = db
      .prepare('SELECT id, kind FROM locations ORDER BY sort_order')
      .all() as { id: string; kind: string }[];
    expect(rows).toEqual([
      { id: 'fridge', kind: 'fridge' },
      { id: 'freezer', kind: 'freezer' },
      { id: 'pantry', kind: 'ambient' },
      { id: 'counter', kind: 'counter' },
    ]);
    db.close();
  });

  test('an install at user_version 2 upgrades and gains the pantry tables', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, 0, 2);
    db.prepare(
      `INSERT INTO canonical_items (id, display_name, class, default_location, shelf_life_days, created_at)
       VALUES ('miso', 'Miso', 'condiment', 'fridge', '{"fridge":365}', '2026-01-01')`,
    ).run();

    migrate(db, 2, LATEST_VERSION);

    const kept = db.prepare("SELECT display_name FROM canonical_items WHERE id = 'miso'").get() as {
      display_name: string;
    };
    expect(kept.display_name).toBe('Miso');
    for (const table of PANTRY_TABLES) {
      expect(tableNames(db)).toContain(table);
    }
    db.close();
  });

  test('an install at user_version 1 upgrades without touching existing data', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, 0, 1);
    db.prepare(
      `INSERT INTO meals (id, logged_at, local_date, meal_type, name, source, created_at)
       VALUES ('m1', '2026-01-01T12:00:00Z', '2026-01-01', 'lunch', 'Noodles', 'manual', '2026-01-01T12:00:00Z')`,
    ).run();

    migrate(db, 1, LATEST_VERSION);

    const meal = db.prepare("SELECT name FROM meals WHERE id = 'm1'").get() as {
      name: string;
    };
    expect(meal.name).toBe('Noodles');
    for (const table of IDENTITY_TABLES) {
      expect(tableNames(db)).toContain(table);
    }
    db.close();
  });

  test('an install at user_version 3 gains the ledger and the drift columns', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, 0, 3);
    db.prepare(
      `INSERT INTO meals (id, logged_at, local_date, meal_type, name, source, created_at)
       VALUES ('m1', '2026-01-01T12:00:00Z', '2026-01-01', 'dinner', 'Curry', 'manual', '2026-01-01T12:00:00Z')`,
    ).run();

    migrate(db, 3, LATEST_VERSION);

    expect(tableNames(db)).toContain('consumption_events');
    // Existing meals default to home — the assumption they were logged under,
    // and safe because depletion is never retroactive.
    const meal = db
      .prepare("SELECT venue, servings_mult FROM meals WHERE id = 'm1'")
      .get() as { venue: string; servings_mult: number };
    expect(meal.venue).toBe('home');
    expect(meal.servings_mult).toBe(1);

    const columns = (
      db.prepare('PRAGMA table_info(pantry_items)').all() as { name: string }[]
    ).map((row) => row.name);
    expect(columns).toContain('estimated_decrements_since_anchor');
    expect(columns).toContain('last_anchor_at');
    db.close();
  });

  test('an install at user_version 4 gains canonical_id on meal_items and the suggestion cache', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, 0, 4);
    db.prepare(
      `INSERT INTO meals (id, logged_at, local_date, meal_type, name, source, created_at)
       VALUES ('m1', '2026-01-01T12:00:00Z', '2026-01-01', 'dinner', 'Curry', 'manual', '2026-01-01T12:00:00Z')`,
    ).run();
    db.prepare(
      `INSERT INTO meal_items (id, meal_id, name, quantity, unit, calories)
       VALUES ('i1', 'm1', 'Rice', 200, 'g', 260)`,
    ).run();

    migrate(db, 4, LATEST_VERSION);

    expect(tableNames(db)).toContain('suggestion_cache');
    // A pre-existing item has no carried identity — null means resolve by
    // name, which is exactly its behaviour before this migration existed.
    const item = db
      .prepare("SELECT canonical_id FROM meal_items WHERE id = 'i1'")
      .get() as { canonical_id: string | null };
    expect(item.canonical_id).toBeNull();
    db.close();
  });

  test('an install at user_version 5 gains receipts, receipt_lines, and the replacement flag', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, 0, 5);
    db.prepare(
      `INSERT INTO canonical_items
         (id, display_name, class, default_location, shelf_life_days, is_seed, created_at)
       VALUES ('soy-sauce-light', 'Light soy sauce', 'condiment', 'pantry', '{}', 1, '2026-01-01T00:00:00Z')`,
    ).run();
    db.prepare(
      `INSERT INTO pantry_items
         (id, canonical_id, location_id, purchased_at, status, created_at, updated_at)
       VALUES ('p1', 'soy-sauce-light', 'pantry', '2026-01-01', 'in_stock', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
    ).run();

    migrate(db, 5, LATEST_VERSION);

    expect(tableNames(db)).toContain('receipts');
    expect(tableNames(db)).toContain('receipt_lines');
    const item = db
      .prepare('SELECT replacement_asked FROM pantry_items WHERE id = ?')
      .get('p1') as { replacement_asked: number };
    // A pre-existing item has never been asked — the flag starts unset.
    expect(item.replacement_asked).toBe(0);
    db.close();
  });

  test('an install at user_version 6 gains money and quantity fields on receipts', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, 0, 6);
    db.prepare(
      `INSERT INTO canonical_items
         (id, display_name, class, default_location, shelf_life_days, is_seed, created_at)
       VALUES ('soy-sauce-light', 'Light soy sauce', 'condiment', 'pantry', '{}', 1, '2026-01-01T00:00:00Z')`,
    ).run();
    db.prepare(
      `INSERT INTO pantry_items
         (id, canonical_id, location_id, purchased_at, status, created_at, updated_at)
       VALUES ('p1', 'soy-sauce-light', 'pantry', '2026-01-01', 'in_stock', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
    ).run();
    db.prepare(
      `INSERT INTO receipts (id, type, store, purchased_at, total_cents, image_uri, status, created_at)
       VALUES ('r1', 'grocery', 'Test Store', '2026-01-01', 500, 'file://r1.jpg', 'pending', '2026-01-01T00:00:00Z')`,
    ).run();
    db.prepare(
      `INSERT INTO receipt_lines
         (id, receipt_id, raw_text, kind, qty, unit, line_total_cents, unit_price_cents,
          canonical_id, pantry_item_id, excluded, created_at)
       VALUES ('l1', 'r1', 'SOY SAUCE', 'food', 500, 'ml', 389, NULL, NULL, NULL, 0, '2026-01-01T00:00:00Z')`,
    ).run();

    migrate(db, 6, LATEST_VERSION);

    const receiptColumns = (
      db.prepare('PRAGMA table_info(receipts)').all() as { name: string }[]
    ).map((row) => row.name);
    expect(receiptColumns).toContain('subtotal_cents');
    expect(receiptColumns).toContain('tax_cents');

    const lineColumns = (
      db.prepare('PRAGMA table_info(receipt_lines)').all() as { name: string }[]
    ).map((row) => row.name);
    expect(lineColumns).toContain('quantity_kind');
    expect(lineColumns).toContain('applies_to_line_id');

    const pantryColumns = (
      db.prepare('PRAGMA table_info(pantry_items)').all() as { name: string }[]
    ).map((row) => row.name);
    expect(pantryColumns).toContain('receipt_line_id');

    // Pre-existing rows: the new fields are unknown, not guessed at zero.
    const line = db
      .prepare('SELECT quantity_kind, applies_to_line_id FROM receipt_lines WHERE id = ?')
      .get('l1') as { quantity_kind: string | null; applies_to_line_id: string | null };
    expect(line.quantity_kind).toBeNull();
    expect(line.applies_to_line_id).toBeNull();
    const item = db
      .prepare('SELECT receipt_line_id FROM pantry_items WHERE id = ?')
      .get('p1') as { receipt_line_id: string | null };
    expect(item.receipt_line_id).toBeNull();
    db.close();
  });

  test('an install at user_version 7 gains dietary_rules and canonical_derivatives', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, 0, 7);
    db.prepare(
      `INSERT INTO canonical_items
         (id, display_name, class, default_location, shelf_life_days, is_seed, created_at)
       VALUES ('milk', 'Milk', 'dairy', 'fridge', '{}', 1, '2026-01-01T00:00:00Z')`,
    ).run();
    db.prepare(
      `INSERT INTO canonical_items
         (id, display_name, class, default_location, shelf_life_days, is_seed, created_at)
       VALUES ('butter', 'Butter', 'dairy', 'fridge', '{}', 1, '2026-01-01T00:00:00Z')`,
    ).run();

    migrate(db, 7, LATEST_VERSION);

    const tables = tableNames(db);
    expect(tables).toContain('dietary_rules');
    expect(tables).toContain('canonical_derivatives');

    db.prepare(
      `INSERT INTO dietary_rules (id, kind, canonical_id, text, normalised_text, created_at)
       VALUES ('r1', 'allergen', 'milk', 'Milk', 'milk', '2026-01-01T00:00:00Z')`,
    ).run();
    db.prepare(
      `INSERT INTO canonical_derivatives (parent_id, child_id) VALUES ('milk', 'butter')`,
    ).run();

    const rule = db
      .prepare('SELECT kind, canonical_id FROM dietary_rules WHERE id = ?')
      .get('r1') as { kind: string; canonical_id: string };
    expect(rule.kind).toBe('allergen');
    expect(rule.canonical_id).toBe('milk');

    const edge = db
      .prepare('SELECT parent_id, child_id FROM canonical_derivatives WHERE parent_id = ?')
      .get('milk') as { parent_id: string; child_id: string };
    expect(edge.child_id).toBe('butter');

    // The uniqueness constraint on the pair.
    expect(() =>
      db
        .prepare(`INSERT INTO canonical_derivatives (parent_id, child_id) VALUES ('milk', 'butter')`)
        .run(),
    ).toThrow();
    db.close();
  });

  test('an install at user_version 8 gains alias_bigrams, backfilled for non-Latin aliases only', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, 0, 8);
    db.prepare(
      `INSERT INTO canonical_items
         (id, display_name, class, default_location, shelf_life_days, is_seed, created_at)
       VALUES ('oyster-sauce', 'Oyster sauce', 'condiment', 'pantry', '{}', 1, '2026-01-01T00:00:00Z')`,
    ).run();
    db.prepare(
      `INSERT INTO item_aliases (id, alias_norm, alias_raw, canonical_id, source, created_at)
       VALUES ('a1', '蠔油', '蠔油', 'oyster-sauce', 'seed', '2026-01-01T00:00:00Z')`,
    ).run();
    db.prepare(
      `INSERT INTO item_aliases (id, alias_norm, alias_raw, canonical_id, source, created_at)
       VALUES ('a2', 'oyster sauce', 'Oyster sauce', 'oyster-sauce', 'seed', '2026-01-01T00:00:00Z')`,
    ).run();

    migrate(db, 8, LATEST_VERSION);

    expect(tableNames(db)).toContain('alias_bigrams');

    // Backfilled for the pre-existing non-Latin alias: padded bigrams of
    // "蠔油" are " 蠔", "蠔油", "油 ".
    const cjkGrams = (
      db.prepare('SELECT bigram FROM alias_bigrams WHERE alias_id = ? ORDER BY bigram').all('a1')
    ).map((row) => (row as { bigram: string }).bigram);
    expect(cjkGrams).toEqual([' 蠔', '油 ', '蠔油']);

    // Never backfilled for a Latin alias — the Latin prefilter already
    // covers it, and giving it rows here would be dead weight.
    const latinGrams = db
      .prepare('SELECT COUNT(*) AS n FROM alias_bigrams WHERE alias_id = ?')
      .get('a2') as { n: number };
    expect(latinGrams.n).toBe(0);
    db.close();
  });

  test('an install at user_version 9 gains open-data catalogue fields without inventing values', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, 0, 9);
    db.prepare(
      `INSERT INTO canonical_items
         (id, display_name, class, default_location, shelf_life_days,
          open_life_days, is_seed, created_at)
       VALUES ('miso', 'Miso', 'condiment', 'fridge', '{"fridge":365}',
               90, 1, '2026-01-01T00:00:00Z')`,
    ).run();

    migrate(db, 9, LATEST_VERSION);

    const row = db
      .prepare(
        `SELECT early_warning_days, sources, kcal_per_100,
                protein_per_100, carbs_per_100, fat_per_100
         FROM canonical_items WHERE id = 'miso'`,
      )
      .get() as {
      early_warning_days: number | null;
      sources: string;
      kcal_per_100: number | null;
      protein_per_100: number | null;
      carbs_per_100: number | null;
      fat_per_100: number | null;
    };

    expect(row.early_warning_days).toBeNull();
    expect(JSON.parse(row.sources)).toMatchObject({
      shelfLifeDays: 'hand-authored',
      openLifeDays: 'hand-authored',
    });
    expect(row.kcal_per_100).toBeNull();
    expect(row.protein_per_100).toBeNull();
    expect(row.carbs_per_100).toBeNull();
    expect(row.fat_per_100).toBeNull();
    db.close();
  });

  test('an install at user_version 10 gains learned venue defaults without touching meals', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, 0, 10);
    db.prepare(
      `INSERT INTO meals
         (id, logged_at, local_date, meal_type, name, source, venue, servings_mult, created_at)
       VALUES ('m1', '2026-08-09T18:00:00Z', '2026-08-09', 'dinner',
               'Curry', 'manual', 'home', 1, '2026-08-09T18:00:00Z')`,
    ).run();

    migrate(db, 10, LATEST_VERSION);

    expect(tableNames(db)).toContain('dish_venue_defaults');
    expect(db.prepare("SELECT name FROM meals WHERE id = 'm1'").get()).toMatchObject({
      name: 'Curry',
    });
    db.close();
  });

  test('a populated profile upgrades to nullable source fields without changing its target', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, 0, 11);
    db.prepare(`INSERT INTO profile (id, sex, age, height_cm, weight_kg, activity_level, goal, target_calories, onboarded_at)
      VALUES (1, 'female', 30, 170, 70, 'moderate', 'maintain', 2000, '2026-08-09')`).run();
    migrate(db, 11, LATEST_VERSION);
    expect(db.prepare('SELECT target_source, target_calories FROM profile WHERE id = 1').get()).toMatchObject({ target_source: 'estimated', target_calories: 2000 });
    const columns = (db.prepare('PRAGMA table_info(profile)').all() as { name: string; notnull: number }[]);
    expect(columns.find((column) => column.name === 'sex')?.notnull).toBe(0);
    db.close();
  });

  test('DROP_ALL removes every table including the identity layer', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, 0, LATEST_VERSION);
    db.exec(DROP_ALL);
    expect(tableNames(db)).toEqual([]);
    db.close();
  });

  test('the identity tables enforce their key constraints', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    migrate(db, 0, LATEST_VERSION);

    db.prepare(
      `INSERT INTO canonical_items (id, display_name, class, default_location, shelf_life_days, created_at)
       VALUES ('soy-sauce-light', 'Light soy sauce', 'condiment', 'pantry', '{"pantry":730}', '2026-01-01')`,
    ).run();
    const insertAlias = db.prepare(
      `INSERT INTO item_aliases (id, alias_norm, alias_raw, canonical_id, source, created_at)
       VALUES (?, ?, ?, ?, 'seed', '2026-01-01')`,
    );
    insertAlias.run('a1', 'soy sauce', 'Soy sauce', 'soy-sauce-light');

    // The (alias_norm, canonical_id) pair is unique.
    expect(() =>
      insertAlias.run('a2', 'soy sauce', 'SOY SAUCE', 'soy-sauce-light'),
    ).toThrow();

    // An alias cannot point at a canonical that does not exist.
    expect(() => insertAlias.run('a3', 'x', 'x', 'missing')).toThrow();

    // Deleting a canonical cascades to its aliases.
    db.prepare("DELETE FROM canonical_items WHERE id = 'soy-sauce-light'").run();
    const count = db
      .prepare('SELECT COUNT(*) AS n FROM item_aliases')
      .get() as { n: number };
    expect(count.n).toBe(0);
    db.close();
  });
});
