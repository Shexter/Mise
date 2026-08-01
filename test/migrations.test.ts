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

describe('migrations', () => {
  test('a fresh install reaches the latest version with every table', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, 0, LATEST_VERSION);

    const tables = tableNames(db);
    for (const table of IDENTITY_TABLES) {
      expect(tables).toContain(table);
    }
    expect(tables).toContain('meals');
    expect(tables).toContain('profile');
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
