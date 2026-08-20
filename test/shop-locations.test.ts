import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, test } from 'vitest';

import {
  deleteAllShops,
  deleteShop,
  listNeededIngredients,
  listShops,
  rememberShop,
  renameShop,
} from '../src/db/queries';
import { DROP_ALL, MIGRATIONS } from '../src/db/schema';
import {
  checkCurrentShop,
  forgetRecognisedShop,
  noteShopForReceipt,
  recentlyRecognisedShop,
  storeForReceipt,
} from '../src/logic/shopService';
import { SHOP_RECENCY_WINDOW_MS } from '../src/logic/shops';
import { db, openTestDatabase } from './stubs/db';
import { resetLocationStub, stub } from './stubs/expo-location';

const TESCO = { latitude: 51.5074, longitude: -0.1278 };
const SAINSBURYS = { latitude: 51.52, longitude: -0.14 };

function migrated(): DatabaseSync {
  const handle = new DatabaseSync(':memory:');
  for (const migration of MIGRATIONS) handle.exec(migration);
  return handle;
}

async function seedPantry(): Promise<void> {
  const insert = async (id: string, name: string, status: string) => {
    await db().runAsync(
      `INSERT INTO canonical_items (id, display_name, class, default_location, shelf_life_days, created_at)
       VALUES (?, ?, 'condiment', 'pantry', '{}', '2026-01-01T00:00:00Z')`,
      [id, name],
    );
    await db().runAsync(
      `INSERT INTO pantry_items (id, canonical_id, location_id, purchased_at, status, created_at, updated_at)
       VALUES (?, ?, 'pantry', '2026-01-01', ?, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
      [`p-${id}`, id, status],
    );
  };
  await insert('soy-sauce', 'Soy sauce', 'out');
  await insert('butter', 'Butter', 'running_low');
  await insert('rice', 'Rice', 'in_stock');
}

beforeEach(() => {
  openTestDatabase();
  resetLocationStub();
  forgetRecognisedShop();
});

describe('the schema stores shops, never visits', () => {
  test('the shops table has exactly five columns and not one of them is a time', () => {
    const handle = migrated();
    const columns = (
      handle.prepare('PRAGMA table_info(shops)').all() as { name: string; type: string }[]
    );
    expect(columns.map((column) => column.name).sort()).toEqual([
      'id',
      'latitude',
      'longitude',
      'name',
      'store_name',
    ]);
    // The guard against a reasonable-sounding cache column arriving later:
    // `last_seen_at` would quietly turn this into a movement log.
    for (const column of columns) {
      expect(column.name).not.toMatch(/at$|_at_|time|date|seen|visit|count/i);
    }
    handle.close();
  });

  test('no table anywhere can record when the user was at a shop', () => {
    const handle = migrated();
    const tables = (
      handle
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as { name: string }[]
    ).map((row) => row.name);

    // No companion table alongside `shops` — no visits, no arrivals, no check log.
    expect(tables.filter((name) => /visit|arriv|depart|geofence|presence|checkin/i.test(name)))
      .toEqual([]);
    expect(tables.filter((name) => name !== 'shops' && name.includes('shop') && !name.startsWith('shopping_')))
      .toEqual([]);

    // And no other table carries a position that could be paired with a time.
    for (const table of tables) {
      if (table === 'shops') continue;
      const columns = (
        handle.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
      ).map((column) => column.name);
      expect(columns.filter((name) => /latitude|longitude|\blat\b|\blon\b|coord/i.test(name)))
        .toEqual([]);
    }
    handle.close();
  });

  test('the migration adds shops to the current head and DROP_ALL removes it', () => {
    const handle = new DatabaseSync(':memory:');
    const shopsIndex = MIGRATIONS.findIndex((statement) =>
      statement.includes('CREATE TABLE shops'),
    );
    expect(shopsIndex).toBeGreaterThan(0);
    for (let version = 0; version < shopsIndex; version += 1) {
      handle.exec(MIGRATIONS[version]!);
    }
    handle.prepare(
      `INSERT INTO meals (id, logged_at, local_date, meal_type, name, source, created_at)
       VALUES ('before-shops', '2026-08-19T12:00:00Z', '2026-08-19', 'lunch', 'Noodles', 'manual', '2026-08-19T12:00:00Z')`,
    ).run();

    handle.exec(MIGRATIONS[shopsIndex]!);

    const tables = () =>
      (handle.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
        name: string;
      }[]).map((row) => row.name);
    expect(tables()).toContain('shops');
    expect(handle.prepare("SELECT name FROM meals WHERE id = 'before-shops'").get()).toEqual({
      name: 'Noodles',
    });

    handle.exec(DROP_ALL);
    expect(tables()).not.toContain('shops');
    handle.close();
  });
});

describe('learning shops', () => {
  test('a shop is stored coarsely, not as a precise trace', async () => {
    const shop = await rememberShop('Tesco', {
      latitude: 51.5074123456,
      longitude: -0.1277654321,
    });
    expect(shop).toMatchObject({ latitude: 51.5074, longitude: -0.1278 });
    expect(await listShops()).toEqual([shop]);
  });

  test('importing again from the same store updates rather than duplicating', async () => {
    const first = await rememberShop('Tesco', TESCO);
    await renameShop(first.id, 'The big Tesco');
    const second = await rememberShop('Tesco', { latitude: 51.5075, longitude: -0.1279 });

    const shops = await listShops();
    expect(shops).toHaveLength(1);
    expect(second.id).toBe(first.id);
    // The user's own name survives; only the position moves. No trail is left.
    expect(shops[0]).toMatchObject({
      name: 'The big Tesco',
      storeName: 'Tesco',
      latitude: 51.5075,
      longitude: -0.1279,
    });
  });

  test('a shop can be forgotten individually, and all of them at once', async () => {
    const tesco = await rememberShop('Tesco', TESCO);
    await rememberShop('Sainsburys', SAINSBURYS);

    await deleteShop(tesco.id);
    expect((await listShops()).map((shop) => shop.storeName)).toEqual(['Sainsburys']);

    await seedPantry();
    await deleteAllShops();
    expect(await listShops()).toEqual([]);
    // Withdrawing from the feature is not withdrawing from the app.
    expect(await listNeededIngredients()).toHaveLength(2);
  });
});

describe('the receipt import path', () => {
  test('does nothing at all without the permission', async () => {
    stub.granted = false;
    stub.position = TESCO;

    expect(await noteShopForReceipt('Tesco')).toBeNull();
    expect(await listShops()).toEqual([]);
    expect(stub.reads).toBe(0);
  });

  test('learns the shop when a receipt names its store', async () => {
    stub.granted = true;
    stub.position = { latitude: 51.50741, longitude: -0.12781 };

    const shop = await noteShopForReceipt('Tesco');
    expect(shop).toMatchObject({ storeName: 'Tesco', latitude: 51.5074, longitude: -0.1278 });
    expect(await listShops()).toHaveLength(1);
  });

  test('falls back to a known shop when the header is unreadable', async () => {
    stub.granted = true;
    stub.position = TESCO;
    await rememberShop('Tesco', TESCO);

    const recognised = await noteShopForReceipt(null);
    expect(recognised?.storeName).toBe('Tesco');
    expect(storeForReceipt(null, recognised)).toBe('Tesco');
  });

  test('the printed header wins over the position match', async () => {
    stub.granted = true;
    stub.position = TESCO;
    await rememberShop('Tesco', TESCO);

    // Standing in Tesco, importing a receipt that plainly says Sainsburys.
    const recognised = await noteShopForReceipt('Sainsburys');
    expect(storeForReceipt('Sainsburys', recognised)).toBe('Sainsburys');
  });

  test('an unreadable header at an unknown shop yields no store, not a guess', async () => {
    stub.granted = true;
    stub.position = SAINSBURYS;
    await rememberShop('Tesco', TESCO);

    const recognised = await noteShopForReceipt(null);
    expect(recognised).toBeNull();
    expect(storeForReceipt(null, recognised)).toBeNull();
  });

  test('a revoked permission mid-read degrades to nothing rather than throwing', async () => {
    stub.granted = true;
    stub.throwOnRead = true;
    await expect(noteShopForReceipt('Tesco')).resolves.toBeNull();
    expect(await listShops()).toEqual([]);
  });

  test('a shop recognised shortly before still informs a later import', async () => {
    stub.granted = true;
    stub.position = TESCO;
    await rememberShop('Tesco', TESCO);
    const now = 1_700_000_000_000;

    await noteShopForReceipt(null, now);
    expect(recentlyRecognisedShop(now + 5 * 60 * 1000)?.storeName).toBe('Tesco');
    expect(recentlyRecognisedShop(now + SHOP_RECENCY_WINDOW_MS + 1)).toBeNull();
  });
});

describe('the manual check', () => {
  test('surfaces what is low or out, by status and never by quantity', async () => {
    stub.granted = true;
    stub.position = TESCO;
    await rememberShop('Tesco', TESCO);
    await seedPantry();

    const result = await checkCurrentShop();
    expect(result.status).toBe('needed');
    if (result.status !== 'needed') return;
    expect(result.shop.storeName).toBe('Tesco');
    expect(result.items).toEqual([
      { canonicalId: 'soy-sauce', displayName: 'Soy sauce', status: 'out' },
      { canonicalId: 'butter', displayName: 'Butter', status: 'running_low' },
    ]);
    for (const item of result.items) {
      expect(Object.keys(item)).not.toContain('qtyRemaining');
      expect(Object.keys(item)).not.toContain('quantity');
    }
  });

  test('surfaces nothing when nothing is needed', async () => {
    stub.granted = true;
    stub.position = TESCO;
    await rememberShop('Tesco', TESCO);

    expect(await checkCurrentShop()).toMatchObject({ status: 'nothing_needed' });
  });

  test('surfaces nothing at a shop no receipt has been imported from', async () => {
    stub.granted = true;
    stub.position = SAINSBURYS;
    await rememberShop('Tesco', TESCO);
    await seedPantry();

    expect(await checkCurrentShop()).toEqual({ status: 'unknown_shop' });
  });

  test('degrades without the permission and when no fix is available', async () => {
    stub.granted = false;
    expect(await checkCurrentShop()).toEqual({ status: 'no_permission' });

    stub.granted = true;
    stub.position = null;
    expect(await checkCurrentShop()).toEqual({ status: 'no_position' });

    stub.throwOnRead = true;
    await expect(checkCurrentShop()).resolves.toEqual({ status: 'no_position' });
  });

  test('changes nothing — no stock, no receipt, no record of the check', async () => {
    stub.granted = true;
    stub.position = TESCO;
    await rememberShop('Tesco', TESCO);
    await seedPantry();

    const snapshot = async () => ({
      pantry: await db().getAllAsync('SELECT * FROM pantry_items ORDER BY id'),
      receipts: await db().getAllAsync('SELECT * FROM receipts'),
      shops: await db().getAllAsync('SELECT * FROM shops'),
      events: await db().getAllAsync('SELECT * FROM consumption_events'),
    });

    const before = await snapshot();
    await checkCurrentShop();
    await checkCurrentShop();
    expect(await snapshot()).toEqual(before);
  });
});

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('no places database is ever consulted', () => {
  const sources = [
    'src/logic/shops.ts',
    'src/logic/shopService.ts',
    'src/logic/location.ts',
    'app/shops.tsx',
  ];

  test('no source in this feature geocodes, fetches, or watches in the background', () => {
    for (const path of sources) {
      const source = readFileSync(join(repoRoot, path), 'utf8');
      const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      for (const forbidden of [
        'geocodeAsync',
        'reverseGeocode',
        'fetch(',
        'XMLHttpRequest',
        'nominatim',
        'overpass',
        'places',
        'startLocationUpdatesAsync',
        'startGeofencingAsync',
        'TaskManager',
        'BACKGROUND',
        'requestBackgroundPermissionsAsync',
      ]) {
        expect(code).not.toContain(forbidden);
      }
    }
  });

  test('the check runs entirely from what is already stored', async () => {
    stub.granted = true;
    stub.position = TESCO;
    await rememberShop('Tesco', TESCO);
    await seedPantry();

    // One position read, and nothing else leaves the module. If a lookup were
    // added, the stub — which implements only the three foreground calls —
    // would throw rather than quietly succeed.
    stub.reads = 0;
    await checkCurrentShop();
    expect(stub.reads).toBe(1);
  });
});
