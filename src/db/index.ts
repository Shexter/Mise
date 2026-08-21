import * as SQLite from 'expo-sqlite';

import { loadSeedData } from '@/db/queries';
import { DROP_ALL, LATEST_VERSION, MIGRATIONS } from '@/db/schema';

/**
 * Kept as `snap.db` after the rename to Mise, deliberately. The filename is
 * internal — no user ever sees it — and changing it would make an existing
 * install's meals, profile, and targets vanish rather than migrate. Rename it
 * only alongside a migration that moves the old file.
 */
const DATABASE_NAME = 'snap.db';

let database: SQLite.SQLiteDatabase | null = null;
let opening: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Opens the database and brings it up to `LATEST_VERSION`. Concurrent callers
 * share one open+migrate pass.
 */
export function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) return Promise.resolve(database);
  if (opening) return opening;

  opening = (async () => {
    let handle: SQLite.SQLiteDatabase | null = null;
    try {
      handle = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await handle.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await migrate(handle);
      await loadSeedData(handle);
      // Nothing outside this attempt can observe a partially migrated or
      // partially seeded handle. Publication is the final successful step.
      database = handle;
      return handle;
    } catch (error) {
      database = null;
      if (handle) {
        try { await handle.closeAsync(); } catch { /* invalidation is authoritative */ }
      }
      throw error;
    } finally {
      opening = null;
    }
  })();

  return opening;
}

/** Test-only lifecycle boundary; production code never calls this. */
export async function __resetDatabaseLifecycleForTests(): Promise<void> {
  const handle = database;
  database = null;
  opening = null;
  if (handle) await handle.closeAsync();
}

/**
 * Returns the open database.
 *
 * Preconditions:
 * openDatabase has already resolved — the root layout awaits it before rendering
 */
export function db(): SQLite.SQLiteDatabase {
  if (!database) {
    throw new Error('Database used before it was opened.');
  }
  return database;
}

async function migrate(handle: SQLite.SQLiteDatabase): Promise<void> {
  const row = await handle.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  let version = row?.user_version ?? 0;

  while (version < LATEST_VERSION) {
    const statement = MIGRATIONS[version];
    if (!statement) break;
    await handle.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(statement);
    });
    version += 1;
    await handle.execAsync(`PRAGMA user_version = ${version}`);
  }
}

/** Drops every table and rebuilds the schema. Irreversible. */
export async function resetDatabase(): Promise<void> {
  const handle = await openDatabase();
  // Receipt lines and receipt-created pantry items reference each other. A
  // populated database therefore cannot drop either side first while foreign
  // keys are enforced. Disable enforcement only for this controlled rebuild,
  // then restore it even if a migration or seed load fails.
  await handle.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await handle.execAsync(DROP_ALL);
    await handle.execAsync('PRAGMA user_version = 0;');
    await migrate(handle);
    // A wiped install starts from the shipped seed set, nothing more.
    await loadSeedData();
  } finally {
    await handle.execAsync('PRAGMA foreign_keys = ON;');
  }
}
