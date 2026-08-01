import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { DROP_ALL, MIGRATIONS } from '../../src/db/schema';

/**
 * Node stand-in for `src/db/index.ts`, wired in via `vitest.config.ts`.
 *
 * Presents the slice of the `expo-sqlite` API that `src/db/queries.ts` uses,
 * backed by an in-memory `node:sqlite` database. Tests get the real SQL —
 * the real migrations, the real queries — without a device or a native module.
 */

type Params = readonly (string | number | null)[];

export interface TestDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: Params): Promise<void>;
  getFirstAsync<T>(sql: string, params?: Params): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: Params): Promise<T[]>;
  withExclusiveTransactionAsync(
    work: (txn: TestDatabase) => Promise<void>,
  ): Promise<void>;
}

let handle: DatabaseSync | null = null;

function toInput(params: Params | undefined): SQLInputValue[] {
  return (params ?? []).map((value) => value as SQLInputValue);
}

function wrap(db: DatabaseSync): TestDatabase {
  const wrapped: TestDatabase = {
    execAsync: (sql) => {
      db.exec(sql);
      return Promise.resolve();
    },
    runAsync: (sql, params) => {
      db.prepare(sql).run(...toInput(params));
      return Promise.resolve();
    },
    getFirstAsync: <T>(sql: string, params?: Params) => {
      const row = db.prepare(sql).get(...toInput(params));
      return Promise.resolve((row as T | undefined) ?? null);
    },
    getAllAsync: <T>(sql: string, params?: Params) => {
      const rows = db.prepare(sql).all(...toInput(params));
      return Promise.resolve(rows as T[]);
    },
    withExclusiveTransactionAsync: async (work) => {
      db.exec('BEGIN');
      try {
        await work(wrapped);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return wrapped;
}

/** Opens a fresh in-memory database at the latest schema version. */
export function openTestDatabase(): TestDatabase {
  handle = new DatabaseSync(':memory:');
  handle.exec('PRAGMA foreign_keys = ON;');
  for (const migration of MIGRATIONS) {
    handle.exec(migration);
  }
  return wrap(handle);
}

/** Mirrors `resetDatabase`: drops everything and re-runs the migrations. */
export function resetTestDatabase(): TestDatabase {
  if (!handle) return openTestDatabase();
  handle.exec(DROP_ALL);
  for (const migration of MIGRATIONS) {
    handle.exec(migration);
  }
  return wrap(handle);
}

export function closeTestDatabase(): void {
  handle?.close();
  handle = null;
}

/** The `db()` accessor `src/db/queries.ts` imports. */
export function db(): TestDatabase {
  if (!handle) {
    throw new Error(
      'Test database used before openTestDatabase() — call it in beforeEach.',
    );
  }
  return wrap(handle);
}
