import * as SQLite from 'expo-sqlite';

import { DROP_ALL, LATEST_VERSION, MIGRATIONS } from '@/db/schema';

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
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    await migrate(db);
    database = db;
    opening = null;
    return db;
  })();

  return opening;
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
  await handle.execAsync(DROP_ALL);
  await handle.execAsync('PRAGMA user_version = 0');
  await migrate(handle);
}
