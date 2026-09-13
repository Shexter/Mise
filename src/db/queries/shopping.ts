import { randomUUID } from 'expo-crypto';
import { db } from '@/db';
import type { MeasureUnit, ShoppingListCategory, ShoppingListItem, ShoppingListReceiptMatch, ShoppingListSource, ShoppingListSourceKind, ShoppingListStatus } from '@/types';
import {
  ShoppingListItemRow,
  ShoppingListSourceRow,
  ShoppingListReceiptMatchRow,
  toShoppingListItem,
  toShoppingListSource,
  toShoppingListReceiptMatch,
} from './types';



/* -------------------------------------------------------------------------- */
/* Shopping list                                                              */
/* -------------------------------------------------------------------------- */

export interface NewShoppingListItem {
  id?: string;
  canonicalId?: string | null;
  displayName: string;
  normalizedName: string;
  status?: ShoppingListStatus;
  requestedQty?: number | null;
  requestedUnit?: MeasureUnit | null;
  note?: string | null;
  category?: ShoppingListCategory;
  sortOrder?: number;
}


export interface NewShoppingListSource {
  shoppingItemId: string;
  kind: ShoppingListSourceKind;
  sourceId?: string | null;
  recipeId?: string | null;
  suggestionId?: string | null;
}


export async function listShoppingItems(includeClosed = false): Promise<ShoppingListItem[]> {
  const rows = await db().getAllAsync<ShoppingListItemRow>(
    includeClosed
      ? 'SELECT * FROM shopping_list_items ORDER BY sort_order ASC, display_name ASC'
      : "SELECT * FROM shopping_list_items WHERE status = 'open' ORDER BY sort_order ASC, display_name ASC",
  );
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const sources = await db().getAllAsync<ShoppingListSourceRow>(
    `SELECT * FROM shopping_list_sources WHERE shopping_item_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at ASC`,
    ids,
  );
  const sourcesByItem = new Map<string, ShoppingListSource[]>();
  for (const source of sources) {
    const list = sourcesByItem.get(source.shopping_item_id) ?? [];
    list.push(toShoppingListSource(source));
    sourcesByItem.set(source.shopping_item_id, list);
  }
  return rows.map((row) => toShoppingListItem(row, sourcesByItem.get(row.id) ?? []));
}


export async function insertShoppingListItem(input: NewShoppingListItem): Promise<ShoppingListItem> {
  const id = input.id ?? randomUUID();
  const now = new Date().toISOString();
  await db().runAsync(
    `INSERT INTO shopping_list_items
      (id, canonical_id, display_name, normalized_name, status, requested_qty,
       requested_unit, note, category, sort_order, created_at, updated_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [id, input.canonicalId ?? null, input.displayName, input.normalizedName,
      input.status ?? 'open', input.requestedQty ?? null, input.requestedUnit ?? null,
      input.note ?? null, input.category ?? 'other', input.sortOrder ?? 0, now, now],
  );
  const item = (await listShoppingItems(true)).find((candidate) => candidate.id === id);
  if (!item) throw new Error('Shopping item vanished on insert.');
  return item;
}


export async function updateShoppingListItem(
  id: string,
  patch: Partial<Pick<ShoppingListItem, 'canonicalId' | 'displayName' | 'normalizedName' | 'requestedQty' | 'requestedUnit' | 'note' | 'category' | 'sortOrder' | 'status'>>,
): Promise<void> {
  const current = await db().getFirstAsync<ShoppingListItemRow>('SELECT * FROM shopping_list_items WHERE id = ?', [id]);
  if (!current) throw new Error('Shopping item not found.');
  const now = new Date().toISOString();
  const nextStatus = patch.status ?? current.status;
  await db().runAsync(
    `UPDATE shopping_list_items SET canonical_id = ?, display_name = ?, normalized_name = ?,
       requested_qty = ?, requested_unit = ?, note = ?, category = ?,
       sort_order = ?, status = ?, updated_at = ?, completed_at = ? WHERE id = ?`,
    [patch.canonicalId === undefined ? current.canonical_id : patch.canonicalId,
      patch.displayName ?? current.display_name, patch.normalizedName ?? current.normalized_name,
      patch.requestedQty === undefined ? current.requested_qty : patch.requestedQty,
      patch.requestedUnit === undefined ? current.requested_unit : patch.requestedUnit,
      patch.note === undefined ? current.note : patch.note, patch.category ?? current.category,
      patch.sortOrder ?? current.sort_order, nextStatus, now,
      nextStatus === 'purchased' ? (current.completed_at ?? now) : null, id],
  );
}


export async function deleteShoppingListItem(id: string): Promise<void> {
  await db().runAsync('DELETE FROM shopping_list_items WHERE id = ?', [id]);
}


export async function addShoppingListSource(input: NewShoppingListSource): Promise<void> {
  await db().runAsync(
    `INSERT OR IGNORE INTO shopping_list_sources
       (id, shopping_item_id, kind, source_id, recipe_id, suggestion_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), input.shoppingItemId, input.kind, input.sourceId ?? null,
      input.recipeId ?? null, input.suggestionId ?? null, new Date().toISOString()],
  );
}


export async function removeShoppingListSource(
  shoppingItemId: string,
  source: Pick<NewShoppingListSource, 'kind' | 'sourceId' | 'recipeId' | 'suggestionId'>,
): Promise<void> {
  await db().runAsync(
    `DELETE FROM shopping_list_sources
     WHERE shopping_item_id = ? AND kind = ?
       AND source_id IS ? AND recipe_id IS ? AND suggestion_id IS ?`,
    [shoppingItemId, source.kind, source.sourceId ?? null, source.recipeId ?? null, source.suggestionId ?? null],
  );
}


export async function matchShoppingItemToReceipt(
  shoppingItemId: string,
  receiptId: string,
  receiptLineId: string,
): Promise<ShoppingListReceiptMatch | null> {
  const item = await db().getFirstAsync<ShoppingListItemRow>('SELECT * FROM shopping_list_items WHERE id = ?', [shoppingItemId]);
  if (!item || item.status !== 'open') return null;
  const existing = await db().getFirstAsync<ShoppingListReceiptMatchRow>(
    'SELECT * FROM shopping_list_receipt_matches WHERE shopping_item_id = ? AND receipt_line_id = ?',
    [shoppingItemId, receiptLineId],
  );
  if (existing && existing.undone_at === null) return toShoppingListReceiptMatch(existing);
  const planDemand = await db().getFirstAsync<{
    total_qty: number | null;
    min_unit: string | null;
    max_unit: string | null;
    unknown_count: number;
  }>(
    `SELECT SUM(pgc.requested_qty) AS total_qty,
            MIN(pgc.requested_unit) AS min_unit,
            MAX(pgc.requested_unit) AS max_unit,
            SUM(pgc.has_unknown_qty) AS unknown_count
       FROM plan_grocery_contributions pgc
       JOIN plan_grocery_applications pga ON pga.id = pgc.application_id
      WHERE pgc.shopping_item_id = ? AND pga.undone_at IS NULL`,
    [shoppingItemId],
  );
  const receiptQuantity = await db().getFirstAsync<{ qty: number | null; unit: string | null }>(
    'SELECT qty, unit FROM receipt_lines WHERE id = ?', [receiptLineId],
  );
  const hasPlanDemand = planDemand?.total_qty !== null || (planDemand?.unknown_count ?? 0) > 0;
  const planFullyCovered = !hasPlanDemand || (
    planDemand!.unknown_count === 0 &&
    planDemand!.total_qty !== null &&
    planDemand!.min_unit === planDemand!.max_unit &&
    receiptQuantity?.qty !== null && receiptQuantity?.qty !== undefined &&
    receiptQuantity.unit === planDemand!.min_unit &&
    receiptQuantity.qty >= planDemand!.total_qty
  );
  const id = randomUUID();
  const now = new Date().toISOString();
  await db().withExclusiveTransactionAsync(async (txn) => {
    if (planFullyCovered) {
      await txn.runAsync("UPDATE shopping_list_items SET status = 'purchased', completed_at = ?, updated_at = ? WHERE id = ?", [now, now, shoppingItemId]);
    } else {
      // Identity alone cannot prove a weekly quantity. Keep the outstanding
      // plan row open while retaining this receipt match as purchase history.
      await txn.runAsync("UPDATE shopping_list_items SET status = 'open', completed_at = NULL, updated_at = ? WHERE id = ?", [now, shoppingItemId]);
    }
    await txn.runAsync(
      `INSERT OR REPLACE INTO shopping_list_receipt_matches
        (id, shopping_item_id, receipt_id, receipt_line_id, previous_status, matched_at, undone_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      [id, shoppingItemId, receiptId, receiptLineId, item.status, now],
    );
  });
  const row = await db().getFirstAsync<ShoppingListReceiptMatchRow>('SELECT * FROM shopping_list_receipt_matches WHERE id = ?', [id]);
  return row ? toShoppingListReceiptMatch(row) : null;
}


export async function undoShoppingReceiptMatch(matchId: string): Promise<void> {
  const match = await db().getFirstAsync<ShoppingListReceiptMatchRow>('SELECT * FROM shopping_list_receipt_matches WHERE id = ?', [matchId]);
  if (!match || match.undone_at !== null) return;
  const now = new Date().toISOString();
  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('UPDATE shopping_list_items SET status = ?, completed_at = NULL, updated_at = ? WHERE id = ?', [match.previous_status, now, match.shopping_item_id]);
    await txn.runAsync('UPDATE shopping_list_receipt_matches SET undone_at = ? WHERE id = ?', [now, matchId]);
  });
}


export async function listShoppingReceiptMatches(receiptId: string): Promise<ShoppingListReceiptMatch[]> {
  const rows = await db().getAllAsync<ShoppingListReceiptMatchRow>(
    'SELECT * FROM shopping_list_receipt_matches WHERE receipt_id = ? ORDER BY matched_at ASC', [receiptId],
  );
  return rows.map(toShoppingListReceiptMatch);
}
