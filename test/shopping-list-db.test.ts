import { beforeEach, describe, expect, test } from 'vitest';

import {
  addShoppingListSource,
  insertShoppingListItem,
  insertCapturedReceipt,
  attachExtractedLines,
  listShoppingItems,
  matchShoppingItemToReceipt,
  undoShoppingReceiptMatch,
  updateShoppingListItem,
} from '@/db/queries';
import { openTestDatabase } from './stubs/db';

describe('shopping list persistence', () => {
  beforeEach(() => openTestDatabase());

  test('persists an exact receipt match and undo without touching receipt data', async () => {
    const item = await insertShoppingListItem({ canonicalId: null, displayName: 'Miso', normalizedName: 'miso', category: 'condiment' });
    await addShoppingListSource({ shoppingItemId: item.id, kind: 'manual' });
    const receipt = await insertCapturedReceipt('file://receipt.jpg', '2026-08-12');
    await attachExtractedLines(receipt.id, {
      store: 'Test', purchasedAt: '2026-08-12', receiptType: 'grocery', subtotalCents: null, taxCents: null, totalCents: null,
      lines: [{ rawText: 'Miso', kind: 'food', qty: 1, unit: 'piece', quantityKind: 'count', lineTotalCents: 100, unitPriceCents: null, appliesToText: null }],
    });
    const line = (await import('@/db/queries')).getReceipt;
    const storedReceipt = await line(receipt.id);
    expect(storedReceipt?.lines[0]?.rawText).toBe('Miso');
    const match = await matchShoppingItemToReceipt(item.id, receipt.id, storedReceipt!.lines[0]!.id);
    expect(match?.previousStatus).toBe('open');
    expect((await listShoppingItems(true)).find((entry) => entry.id === item.id)?.status).toBe('purchased');
    await undoShoppingReceiptMatch(match!.id);
    expect((await listShoppingItems(true)).find((entry) => entry.id === item.id)?.status).toBe('open');
    expect((await line(receipt.id))?.lines[0]?.rawText).toBe('Miso');
  });

  test('edits a manual item without removing its source', async () => {
    const item = await insertShoppingListItem({ displayName: 'Scallions', normalizedName: 'scallions' });
    await addShoppingListSource({ shoppingItemId: item.id, kind: 'manual' });
    await updateShoppingListItem(item.id, { displayName: 'Green onions', normalizedName: 'green onions', requestedQty: 2, requestedUnit: 'piece', note: 'For noodles' });
    const updated = (await listShoppingItems(true)).find((entry) => entry.id === item.id);
    expect(updated).toMatchObject({ displayName: 'Green onions', requestedQty: 2, requestedUnit: 'piece', note: 'For noodles' });
    expect(updated?.sources).toHaveLength(1);
    expect(updated?.sources[0]?.kind).toBe('manual');
  });
});
