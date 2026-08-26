import { randomUUID } from 'expo-crypto';
import { db } from '@/db';
import { coarsen, defaultShopName } from '@/logic/shops';
import type { NeededIngredient, Shop } from '@/types';
import {
  ShopRow,
  toShop,
} from './types';



/** Every known shop, for matching a position or for the management screen. */
export async function listShops(): Promise<Shop[]> {
  const rows = await db().getAllAsync<ShopRow>(
    'SELECT * FROM shops ORDER BY name ASC',
  );
  return rows.map(toShop);
}


/**
 * Records where a store is, from a receipt imported at it.
 *
 * Keyed on the store name, so importing a second receipt from the same shop
 * updates its position rather than accumulating a duplicate row — and, because
 * the row is overwritten rather than appended to, a run of imports leaves one
 * position behind instead of a trail. The user's own name for the shop
 * survives the update; only the position moves.
 */
export async function rememberShop(
  storeName: string,
  position: { latitude: number; longitude: number },
): Promise<Shop> {
  const coarse = coarsen(position);
  const name = storeName.trim();
  const existing = await db().getFirstAsync<ShopRow>(
    'SELECT * FROM shops WHERE store_name = ?',
    [name],
  );
  if (existing) {
    await db().runAsync('UPDATE shops SET latitude = ?, longitude = ? WHERE id = ?', [
      coarse.latitude,
      coarse.longitude,
      existing.id,
    ]);
    return { ...toShop(existing), ...coarse };
  }
  const id = randomUUID();
  await db().runAsync(
    'INSERT INTO shops (id, name, store_name, latitude, longitude) VALUES (?, ?, ?, ?, ?)',
    [id, defaultShopName(name), name, coarse.latitude, coarse.longitude],
  );
  return {
    id,
    name: defaultShopName(name),
    storeName: name,
    latitude: coarse.latitude,
    longitude: coarse.longitude,
  };
}


/** Renames a shop. The store name receipts print is left alone. */
export async function renameShop(id: string, name: string): Promise<void> {
  await db().runAsync('UPDATE shops SET name = ? WHERE id = ?', [name.trim(), id]);
}


/** Forgets one shop's position. */
export async function deleteShop(id: string): Promise<void> {
  await db().runAsync('DELETE FROM shops WHERE id = ?', [id]);
}


/**
 * Forgets every stored shop position and nothing else. Withdrawing from this
 * feature must not mean withdrawing from the app, so this is deliberately
 * narrower than "Delete all data".
 */
export async function deleteAllShops(): Promise<void> {
  await db().runAsync('DELETE FROM shops');
}


/**
 * What is running low or out, by identity and status.
 *
 * No quantity is selected — not filtered out in the caller, not selected here
 * (decision 15). Seasonings and other status-only items are included on the
 * same footing as everything else, because status is the whole answer.
 */
export async function listNeededIngredients(): Promise<NeededIngredient[]> {
  const rows = await db().getAllAsync<{
    canonical_id: string;
    display_name: string;
    status: string;
  }>(
    `SELECT DISTINCT p.canonical_id AS canonical_id, c.display_name AS display_name, p.status AS status
       FROM pantry_items p
       JOIN canonical_items c ON c.id = p.canonical_id
      WHERE p.status IN ('running_low', 'out')
      ORDER BY p.status = 'running_low' ASC, c.display_name ASC`,
  );
  return rows.map((row) => ({
    canonicalId: row.canonical_id,
    displayName: row.display_name,
    status: row.status as NeededIngredient['status'],
  }));
}
