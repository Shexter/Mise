import { randomUUID } from 'expo-crypto';
import { db } from '@/db';
import { localDateString } from '@/logic/dates';
import { canRecomputeExpiry, freezeExpiry, predictExpiry } from '@/logic/expiry';
import type { ExpirySource, Fullness, Location, LocationKind, MeasureUnit, PantryItem, QuantitySource } from '@/types';
import {
  CanonicalItemRow,
  toCanonicalItem,
  LocationRow,
  PantryItemRow,
  toLocation,
  toPantryItem,
} from './types';
import { getCanonicalById } from './identity';



/* -------------------------------------------------------------------------- */
/* Locations                                                                   */
/* -------------------------------------------------------------------------- */

export async function getLocations(): Promise<Location[]> {
  const rows = await db().getAllAsync<LocationRow>(
    'SELECT * FROM locations ORDER BY sort_order ASC, name ASC',
  );
  return rows.map(toLocation);
}


export async function addLocation(
  name: string,
  kind: LocationKind,
): Promise<Location> {
  const id = randomUUID();
  const row = await db().getFirstAsync<{ top: number | null }>(
    'SELECT MAX(sort_order) AS top FROM locations',
  );
  const sortOrder = (row?.top ?? -1) + 1;
  await db().runAsync(
    'INSERT INTO locations (id, name, kind, sort_order) VALUES (?, ?, ?, ?)',
    [id, name, kind, sortOrder],
  );
  return { id, name, kind, sortOrder };
}


export async function renameLocation(id: string, name: string): Promise<void> {
  await db().runAsync('UPDATE locations SET name = ? WHERE id = ?', [name, id]);
}


/**
 * Removes a location by first moving its items to a destination the user
 * chose — never deleting them, never leaving them locationless. One
 * transaction; expiry is recomputed for the moved items because their
 * location kind may have changed.
 */
export async function removeLocation(
  id: string,
  destinationId: string,
): Promise<void> {
  if (id === destinationId) {
    throw new Error('Cannot move a location’s items into itself.');
  }
  const destination = await db().getFirstAsync<LocationRow>(
    'SELECT * FROM locations WHERE id = ?',
    [destinationId],
  );
  if (!destination) {
    throw new Error('The destination location does not exist.');
  }

  const moved = await db().getAllAsync<PantryItemRow>(
    'SELECT * FROM pantry_items WHERE location_id = ?',
    [id],
  );
  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      'UPDATE pantry_items SET location_id = ?, updated_at = ? WHERE location_id = ?',
      [destinationId, new Date().toISOString(), id],
    );
    await txn.runAsync('DELETE FROM locations WHERE id = ?', [id]);
  });
  for (const row of moved) {
    await recomputeExpiry(row.id);
  }
}


/* -------------------------------------------------------------------------- */
/* Pantry items                                                                */
/* -------------------------------------------------------------------------- */

export interface NewPantryItem {
  canonicalId: string;
  locationId: string;
  /** Local date (yyyy-MM-dd). Defaults to today. */
  purchasedAt?: string;
  productId?: string | null;
  /** A quantity the user typed, echoable back to them. */
  qtyRemaining?: number | null;
  qtyUnit?: MeasureUnit | null;
  /**
   * Defaults to `'user'` when a quantity is given, matching manual add.
   * A receipt line's quantity is a model read of a photograph, not
   * something the user typed, so the receipt-import path overrides this
   * to `'estimate'` — the same distinction decision 74 already draws.
   */
  qtySource?: QuantitySource;
  /** A date from a label or the user; suppresses prediction. */
  expiresAt?: string | null;
  expirySource?: Exclude<ExpirySource, 'predicted'>;
  priceCents?: number | null;
  photoUri?: string | null;
}


/**
 * Inserts a pantry item, predicting its expiry from the canonical shelf
 * life and the location kind unless the caller supplied a date.
 */
export async function insertPantryItem(
  input: NewPantryItem,
): Promise<PantryItem> {
  const canonical = await getCanonicalById(input.canonicalId);
  if (!canonical) {
    throw new Error(`Unknown canonical ingredient: ${input.canonicalId}`);
  }
  const location = await db().getFirstAsync<LocationRow>(
    'SELECT * FROM locations WHERE id = ?',
    [input.locationId],
  );
  if (!location) {
    throw new Error(`Unknown location: ${input.locationId}`);
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const purchasedAt = input.purchasedAt ?? localDateString();

  let expiresAt: string | null;
  let expirySource: ExpirySource | null;
  if (input.expiresAt != null) {
    expiresAt = input.expiresAt;
    expirySource = input.expirySource ?? 'user';
  } else {
    expiresAt = predictExpiry(
      canonical,
      location.kind as LocationKind,
      purchasedAt,
      null,
    );
    expirySource = expiresAt != null ? 'predicted' : null;
  }

  await db().runAsync(
    `INSERT INTO pantry_items
       (id, canonical_id, product_id, location_id, qty_remaining, qty_unit,
        qty_source, fullness, uses_count, purchased_at, opened_at, expires_at,
        expiry_source, price_cents, photo_uri, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, NULL, ?, ?, ?, ?, 'in_stock', ?, ?)`,
    [
      id,
      input.canonicalId,
      input.productId ?? null,
      input.locationId,
      input.qtyRemaining ?? null,
      input.qtyUnit ?? null,
      input.qtyRemaining != null ? (input.qtySource ?? 'user') : null,
      purchasedAt,
      expiresAt,
      expirySource,
      input.priceCents ?? null,
      input.photoUri ?? null,
      now,
      now,
    ],
  );
  const stored = await getPantryItem(id);
  if (!stored) throw new Error('Pantry item vanished on insert.');
  return stored;
}


export interface UpdatePantryItemInput {
  canonicalId: string;
  locationId: string;
  purchasedAt: string;
  qtyRemaining: number | null;
  qtyUnit: MeasureUnit | null;
  expiresAt: string | null;
}


/** Updates only user-owned pantry fields; derived expiry is recomputed when it was predicted. */
export async function updatePantryItem(
  id: string,
  input: UpdatePantryItemInput,
): Promise<PantryItem> {
  const canonical = await getCanonicalById(input.canonicalId);
  if (!canonical) throw new Error(`Unknown canonical ingredient: ${input.canonicalId}`);
  const location = await db().getFirstAsync<LocationRow>(
    'SELECT * FROM locations WHERE id = ?',
    [input.locationId],
  );
  if (!location) throw new Error(`Unknown location: ${input.locationId}`);
  const existing = await getPantryItem(id);
  if (!existing) throw new Error('Pantry item no longer exists.');

  let expiresAt = input.expiresAt;
  let expirySource: ExpirySource | null = input.expiresAt != null
    ? (input.expiresAt === existing.expiresAt ? existing.expirySource ?? 'user' : 'user')
    : null;
  if (input.expiresAt == null && canRecomputeExpiry(existing.expirySource)) {
    expiresAt = predictExpiry(
      canonical,
      location.kind as LocationKind,
      input.purchasedAt,
      existing.openedAt,
    );
    expirySource = expiresAt != null ? 'predicted' : null;
  }
  await db().runAsync(
    `UPDATE pantry_items
     SET canonical_id = ?, location_id = ?, purchased_at = ?,
         qty_remaining = ?, qty_unit = ?, qty_source = ?,
         expires_at = ?, expiry_source = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.canonicalId,
      input.locationId,
      input.purchasedAt,
      input.qtyRemaining,
      input.qtyUnit,
      input.qtyRemaining != null ? 'user' : null,
      expiresAt,
      expirySource,
      new Date().toISOString(),
      id,
    ],
  );
  const updated = await getPantryItem(id);
  if (!updated) throw new Error('Pantry item vanished after update.');
  return updated;
}


/** One accepted rapid-scan session becomes pantry stock atomically. */
export async function applyBarcodeSession(
  items: readonly (NewPantryItem & { productId: string })[],
): Promise<string[]> {
  const now = new Date().toISOString();
  const ids: string[] = [];
  await db().withExclusiveTransactionAsync(async (txn) => {
    for (const item of items) {
      const canonical = await txn.getFirstAsync<CanonicalItemRow>(
        'SELECT * FROM canonical_items WHERE id = ?',
        [item.canonicalId],
      );
      const location = await txn.getFirstAsync<LocationRow>(
        'SELECT * FROM locations WHERE id = ?',
        [item.locationId],
      );
      if (!canonical || !location) throw new Error('A scanned item no longer has a valid ingredient or location.');
      const id = randomUUID();
      const purchasedAt = item.purchasedAt ?? localDateString();
      const expiresAt = item.expiresAt ?? predictExpiry(toCanonicalItem(canonical), location.kind as LocationKind, purchasedAt, null);
      const expirySource = item.expiresAt != null ? (item.expirySource ?? 'user') : (expiresAt != null ? 'predicted' : null);
      await txn.runAsync(
        `INSERT INTO pantry_items
           (id, canonical_id, product_id, location_id, qty_remaining, qty_unit,
            qty_source, fullness, uses_count, purchased_at, opened_at, expires_at,
            expiry_source, price_cents, photo_uri, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, NULL, ?, ?, ?, ?, 'in_stock', ?, ?)`,
        [
          id, item.canonicalId, item.productId, item.locationId,
          item.qtyRemaining ?? null, item.qtyUnit ?? null,
          item.qtyRemaining != null ? (item.qtySource ?? 'estimate') : null,
          purchasedAt, expiresAt, expirySource, item.priceCents ?? null,
          item.photoUri ?? null, now, now,
        ],
      );
      ids.push(id);
    }
  });
  return ids;
}


export async function getPantryItem(id: string): Promise<PantryItem | null> {
  const row = await db().getFirstAsync<PantryItemRow>(
    'SELECT * FROM pantry_items WHERE id = ?',
    [id],
  );
  return row ? toPantryItem(row) : null;
}


/**
 * The catalogue, soonest expiry first; undated items follow dated ones.
 * Discarded and replaced items are excluded — a replaced item was
 * superseded by the new purchase that created it, so it is no longer a
 * live container either (decision 68).
 */
export async function listPantryItems(): Promise<PantryItem[]> {
  const rows = await db().getAllAsync<PantryItemRow>(
    `SELECT * FROM pantry_items
     WHERE status NOT IN ('discarded', 'replaced')
     ORDER BY expires_at IS NULL ASC, expires_at ASC, created_at ASC`,
  );
  return rows.map(toPantryItem);
}


async function touchPantryItem(
  id: string,
  fields: string,
  params: (string | number | null)[],
): Promise<void> {
  await db().runAsync(
    `UPDATE pantry_items SET ${fields}, updated_at = ? WHERE id = ?`,
    [...params, new Date().toISOString(), id],
  );
}


/**
 * Recomputes and stores a predicted expiry from the item's current state.
 * One of the few writers of `expires_at` — creation, opening, moving, and
 * freezing route through here or set it directly. A user or label date is
 * left alone (`canRecomputeExpiry`).
 */
async function recomputeExpiry(id: string): Promise<void> {
  const item = await getPantryItem(id);
  if (!item || !canRecomputeExpiry(item.expirySource)) return;
  const canonical = await getCanonicalById(item.canonicalId);
  const location = await db().getFirstAsync<LocationRow>(
    'SELECT * FROM locations WHERE id = ?',
    [item.locationId],
  );
  if (!canonical || !location) return;

  const expiresAt = predictExpiry(
    canonical,
    location.kind as LocationKind,
    item.purchasedAt,
    item.openedAt,
  );
  await touchPantryItem(id, 'expires_at = ?, expiry_source = ?', [
    expiresAt,
    expiresAt != null ? 'predicted' : null,
  ]);
}


/** Marks an item opened today and recomputes its (predicted) expiry. */
export async function markItemOpened(id: string): Promise<void> {
  await touchPantryItem(id, 'opened_at = ?', [localDateString()]);
  await recomputeExpiry(id);
}


/** Moves an item and recomputes its (predicted) expiry for the new kind. */
export async function updateItemLocation(
  id: string,
  locationId: string,
): Promise<void> {
  await touchPantryItem(id, 'location_id = ?', [locationId]);
  await recomputeExpiry(id);
}


/**
 * The freeze action (decision 20): move to a freezer location and recount
 * expiry from the freezer shelf life as of today. A user or label date
 * still wins over the recount.
 */
export async function freezeItem(
  id: string,
  freezerLocationId: string,
): Promise<void> {
  const item = await getPantryItem(id);
  if (!item) return;
  const canonical = await getCanonicalById(item.canonicalId);
  if (!canonical) return;

  if (canRecomputeExpiry(item.expirySource)) {
    const expiresAt = freezeExpiry(canonical, localDateString());
    await touchPantryItem(
      id,
      'location_id = ?, expires_at = ?, expiry_source = ?',
      [freezerLocationId, expiresAt, expiresAt != null ? 'predicted' : null],
    );
  } else {
    await touchPantryItem(id, 'location_id = ?', [freezerLocationId]);
  }
}


/**
 * A fullness tap (decision 14): authoritative over any estimate at the
 * moment it is given, so the stored advisory status is reset to match.
 */
export async function setItemFullness(
  id: string,
  fullness: Fullness,
): Promise<void> {
  // A fullness tap is ground truth (decision 14), so it is an anchor: the
  // drift counter resets and the app may speak confidently again.
  await touchPantryItem(
    id,
    `fullness = ?, status = ?,
     estimated_decrements_since_anchor = 0, last_anchor_at = ?`,
    [fullness, fullness === 'out' ? 'out' : 'in_stock', new Date().toISOString()],
  );
}


/**
 * A quantity the user typed. The other ground-truth anchor: it zeroes
 * drift, and it restores `qty_source` to `user`, which is what makes the
 * pantry screen echo the figure back to them again (decision 74).
 */
export async function setItemQuantity(
  id: string,
  qtyRemaining: number,
  qtyUnit: MeasureUnit,
): Promise<void> {
  await touchPantryItem(
    id,
    `qty_remaining = ?, qty_unit = ?, qty_source = 'user',
     estimated_decrements_since_anchor = 0, last_anchor_at = ?`,
    [qtyRemaining, qtyUnit, new Date().toISOString()],
  );
}


/**
 * A receipt re-anchor (decision 55): the purchased quantity *sets* the
 * amount rather than adding to it, and drift zeroes. Adding to a drifted
 * estimate compounds the error; setting discards it, which is the point of
 * receipts being the ground-truth re-anchor.
 *
 * Note the boundary with decision 68: this applies when a receipt matches
 * an *existing* item. A purchase of a container the user does not yet have
 * creates a new pantry item instead, which `add-receipt-import` owns.
 */
export async function reanchorFromReceipt(
  id: string,
  qtyRemaining: number,
  qtyUnit: MeasureUnit,
): Promise<void> {
  await touchPantryItem(
    id,
    `qty_remaining = ?, qty_unit = ?, qty_source = 'user', status = 'in_stock',
     uses_count = 0, fullness = NULL,
     estimated_decrements_since_anchor = 0, last_anchor_at = ?`,
    [qtyRemaining, qtyUnit, new Date().toISOString()],
  );
}


export async function markItemUsedUp(id: string): Promise<void> {
  await touchPantryItem(id, "status = 'out'", []);
}


export async function markItemRunningLow(id: string): Promise<void> {
  await touchPantryItem(id, "status = 'running_low'", []);
}


/** Discarded, not consumed — the raw material for waste figures later. */
export async function discardItem(id: string): Promise<void> {
  await touchPantryItem(id, "status = 'discarded'", []);
}
