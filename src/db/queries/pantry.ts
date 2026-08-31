import { randomUUID } from 'expo-crypto';
import { db } from '@/db';
import { localDateString } from '@/logic/dates';
import {
  knownAcquisition,
  predictExpiryFromAcquisition,
  unknownAcquisition,
} from '@/logic/acquisition';
import { canRecomputeExpiry, freezeExpiry, predictExpiry } from '@/logic/expiry';
import type { ShoppingRestockPlan } from '@/logic/stockRestock';
import type { ExpirySource, Fullness, Location, LocationKind, MeasureUnit, PantryItem, QuantitySource, ShoppingListStatus } from '@/types';
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
  /**
   * Defaults to true, matching every channel that has a real date: a receipt,
   * a scan at the till, a date the user typed. First-inventory capture passes
   * false, and then no expiry is predicted from `purchasedAt` at all.
   */
  acquiredAtKnown?: boolean;
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

export interface ShoppingRestockUndo {
  createdItemId: string;
  replacedItemIds: string[];
}


/** Applies one shopping-list restock as a new physical container. */
export async function applyShoppingRestock(
  plan: ShoppingRestockPlan,
): Promise<ShoppingRestockUndo> {
  const createdItemId = randomUUID();
  const now = new Date().toISOString();
  let replacedItemIds: string[] = [];

  await db().withExclusiveTransactionAsync(async (txn) => {
    const shoppingItem = await txn.getFirstAsync<{ status: string }>(
      'SELECT status FROM shopping_list_items WHERE id = ?',
      [plan.shoppingItemId],
    );
    if (shoppingItem?.status !== 'purchased') {
      throw new Error('Shopping item is no longer marked purchased.');
    }

    if (plan.replacedItemIds.length > 0) {
      const placeholders = plan.replacedItemIds.map(() => '?').join(',');
      const replaceable = await txn.getAllAsync<{ id: string }>(
        `SELECT id FROM pantry_items WHERE status = 'out' AND id IN (${placeholders})`,
        plan.replacedItemIds,
      );
      replacedItemIds = replaceable.map((row) => row.id);
    }

    await txn.runAsync(
      `INSERT INTO pantry_items
         (id, canonical_id, product_id, location_id, qty_remaining, qty_unit,
          qty_source, fullness, uses_count, purchased_at, opened_at, expires_at,
          expiry_source, price_cents, photo_uri, status, created_at, updated_at)
       VALUES (?, ?, NULL, ?, NULL, NULL, NULL, NULL, 0, ?, NULL, ?, ?, NULL, NULL, 'in_stock', ?, ?)`,
      [
        createdItemId,
        plan.item.canonicalId,
        plan.item.locationId,
        plan.item.purchasedAt,
        plan.item.expiresAt,
        plan.item.expiresAt === null ? null : 'predicted',
        now,
        now,
      ],
    );

    for (const id of replacedItemIds) {
      await txn.runAsync(
        "UPDATE pantry_items SET status = 'replaced', updated_at = ? WHERE id = ? AND status = 'out'",
        [now, id],
      );
    }
  });

  return { createdItemId, replacedItemIds };
}


/** Reverses the toast-scoped restock and its purchase in one transaction. */
export async function undoShoppingRestock(
  undo: ShoppingRestockUndo,
  shoppingItemId: string,
  previousStatus: ShoppingListStatus,
): Promise<void> {
  const now = new Date().toISOString();
  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM pantry_items WHERE id = ?', [undo.createdItemId]);
    for (const id of undo.replacedItemIds) {
      await txn.runAsync(
        "UPDATE pantry_items SET status = 'out', updated_at = ? WHERE id = ? AND status = 'replaced'",
        [now, id],
      );
    }
    await txn.runAsync(
      'UPDATE shopping_list_items SET status = ?, completed_at = NULL, updated_at = ? WHERE id = ?',
      [previousStatus, now, shoppingItemId],
    );
  });
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
  const acquiredAtKnown = input.acquiredAtKnown ?? true;
  const acquisition = acquiredAtKnown
    ? knownAcquisition(purchasedAt)
    : unknownAcquisition(purchasedAt);

  let expiresAt: string | null;
  let expirySource: ExpirySource | null;
  if (input.expiresAt != null) {
    expiresAt = input.expiresAt;
    expirySource = input.expirySource ?? 'user';
  } else {
    expiresAt = predictExpiryFromAcquisition(
      canonical,
      location.kind as LocationKind,
      acquisition,
      null,
    );
    expirySource = expiresAt != null ? 'predicted' : null;
  }

  await db().runAsync(
    `INSERT INTO pantry_items
       (id, canonical_id, product_id, location_id, qty_remaining, qty_unit,
        qty_source, fullness, uses_count, purchased_at, acquired_at_known,
        opened_at, expires_at, expiry_source, price_cents, photo_uri, status,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, NULL, ?, ?, ?, ?, 'in_stock', ?, ?)`,
    [
      id,
      input.canonicalId,
      input.productId ?? null,
      input.locationId,
      input.qtyRemaining ?? null,
      input.qtyUnit ?? null,
      input.qtyRemaining != null ? (input.qtySource ?? 'user') : null,
      purchasedAt,
      acquiredAtKnown ? 1 : 0,
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
    // Editing the date in the sheet *is* the user supplying the acquisition
    // date, so an unknown-acquisition row becomes a known one here and starts
    // predicting. That is the only way back from unknown, and it is a date the
    // user typed rather than one Mise assumed.
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
         acquired_at_known = 1,
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

  const expiresAt = predictExpiryFromAcquisition(
    canonical,
    location.kind as LocationKind,
    item.acquiredAtKnown
      ? knownAcquisition(item.purchasedAt)
      : unknownAcquisition(item.purchasedAt),
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


/* -------------------------------------------------------------------------- */
/* Reviewed intake batches                                                     */
/* -------------------------------------------------------------------------- */

/** One accepted proposal, already reviewed, ready to become physical rows. */
export interface IntakeBatchItem {
  canonicalId: string;
  locationId: string;
  /** One entry per physical container the proposal creates. */
  rows: readonly { qtyRemaining: number | null; qtyUnit: MeasureUnit | null }[];
  /** False for first-inventory stock, which suppresses expiry prediction. */
  acquiredAtKnown: boolean;
  /** Local date. Defaults to today; only meaningful when known. */
  acquiredAt?: string;
  fullness?: Fullness | null;
  /** A local date the user said the container was opened. */
  openedAt?: string | null;
}

export interface IntakeBatchResult {
  batchId: string;
  createdItemIds: string[];
  /** True when this draft had already been applied and nothing was written. */
  alreadyApplied: boolean;
}

/**
 * Writes one reviewed intake as a single transaction.
 *
 * Three properties the photo path does not have, each earned by a specific
 * failure a voice batch makes likely:
 *
 *   - **Atomic.** The photo review inserts items with `Promise.all`, so a bad
 *     canonical id halfway through leaves half a fridge in the pantry and no
 *     record of which half. Eight items in one breath makes that both more
 *     likely and much harder to unpick by hand.
 *   - **Idempotent.** `draft_id` is unique, so a retried confirmation — a
 *     double tap, a screen that remounts, a retry after a timeout the write
 *     actually survived — returns the first batch instead of making a second
 *     one.
 *   - **Reversible.** The created ids are recorded against the batch, so Undo
 *     deletes exactly those rows and nothing that merely looks like them.
 *
 * `qty_source` is `'user'`: every figure here was either spoken by the user or
 * typed by them in review, and both are their own claim rather than an
 * estimate (the distinction decision 74 draws).
 */
export async function applyPantryIntakeBatch(
  draftId: string,
  source: string,
  items: readonly IntakeBatchItem[],
): Promise<IntakeBatchResult> {
  const existing = await db().getFirstAsync<{ id: string }>(
    'SELECT id FROM pantry_intake_batches WHERE draft_id = ?',
    [draftId],
  );
  if (existing) {
    const rows = await db().getAllAsync<{ pantry_item_id: string }>(
      'SELECT pantry_item_id FROM pantry_intake_batch_items WHERE batch_id = ?',
      [existing.id],
    );
    return {
      batchId: existing.id,
      createdItemIds: rows.map((row) => row.pantry_item_id),
      alreadyApplied: true,
    };
  }

  const batchId = randomUUID();
  const now = new Date().toISOString();
  const today = localDateString();
  const createdItemIds: string[] = [];

  await db().withExclusiveTransactionAsync(async (txn) => {
    // Re-checked inside the transaction: two confirmations racing would both
    // pass the read above, and only the unique index can actually decide.
    await txn.runAsync(
      `INSERT INTO pantry_intake_batches (id, draft_id, source, item_count, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [batchId, draftId, source, items.length, now],
    );

    for (const item of items) {
      const canonical = await txn.getFirstAsync<CanonicalItemRow>(
        'SELECT * FROM canonical_items WHERE id = ?',
        [item.canonicalId],
      );
      const location = await txn.getFirstAsync<LocationRow>(
        'SELECT * FROM locations WHERE id = ?',
        [item.locationId],
      );
      if (!canonical || !location) {
        throw new Error(
          'A reviewed item no longer has a valid ingredient or location. Nothing was added.',
        );
      }

      const acquiredAt = item.acquiredAt ?? today;
      const acquisition = item.acquiredAtKnown
        ? knownAcquisition(acquiredAt)
        : unknownAcquisition(acquiredAt);
      const openedAt = item.openedAt ?? null;
      const expiresAt = predictExpiryFromAcquisition(
        toCanonicalItem(canonical),
        location.kind as LocationKind,
        acquisition,
        openedAt,
      );

      for (const row of item.rows) {
        const id = randomUUID();
        await txn.runAsync(
          `INSERT INTO pantry_items
             (id, canonical_id, product_id, location_id, qty_remaining, qty_unit,
              qty_source, fullness, uses_count, purchased_at, acquired_at_known,
              opened_at, expires_at, expiry_source, price_cents, photo_uri, status,
              created_at, updated_at)
           VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, NULL, NULL, 'in_stock', ?, ?)`,
          [
            id,
            item.canonicalId,
            item.locationId,
            row.qtyRemaining ?? null,
            row.qtyUnit ?? null,
            row.qtyRemaining != null ? 'user' : null,
            item.fullness ?? null,
            acquiredAt,
            item.acquiredAtKnown ? 1 : 0,
            openedAt,
            expiresAt,
            expiresAt != null ? 'predicted' : null,
            now,
            now,
          ],
        );
        await txn.runAsync(
          'INSERT INTO pantry_intake_batch_items (batch_id, pantry_item_id) VALUES (?, ?)',
          [batchId, id],
        );
        createdItemIds.push(id);
      }
    }
  });

  return { batchId, createdItemIds, alreadyApplied: false };
}


/**
 * Removes exactly the rows one batch created.
 *
 * Deletes by recorded id rather than by any resemblance to the batch, so an
 * item the user added by hand in between — same food, same shelf, same minute
 * — survives. The batch is marked undone rather than deleted: the draft id
 * must stay claimed, or re-confirming the same draft after an Undo would write
 * the batch a second time.
 */
export async function undoPantryIntakeBatch(batchId: string): Promise<number> {
  const rows = await db().getAllAsync<{ pantry_item_id: string }>(
    'SELECT pantry_item_id FROM pantry_intake_batch_items WHERE batch_id = ?',
    [batchId],
  );
  if (rows.length === 0) return 0;

  const now = new Date().toISOString();
  await db().withExclusiveTransactionAsync(async (txn) => {
    for (const row of rows) {
      await txn.runAsync('DELETE FROM pantry_items WHERE id = ?', [row.pantry_item_id]);
    }
    await txn.runAsync(
      'DELETE FROM pantry_intake_batch_items WHERE batch_id = ?',
      [batchId],
    );
    await txn.runAsync(
      'UPDATE pantry_intake_batches SET undone_at = ? WHERE id = ?',
      [now, batchId],
    );
  });
  return rows.length;
}
