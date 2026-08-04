import { beforeEach, describe, expect, test } from 'vitest';

import { parseReceiptResponse } from '../src/api/receipt';
import {
  attachExtractedLines,
  getAllCanonicals,
  getMatchQueue,
  getPantryItem,
  getReceipt,
  insertCapturedReceipt,
  insertPantryItem,
  listPantryItems,
  listReceipts,
  loadSeedData,
  markItemUsedUp,
  setReceiptLineExcluded,
} from '../src/db/queries';
import { RECEIPTS } from '../src/logic/__fixtures__/receipts';
import {
  acceptReceiptReview,
  captureReceipt,
  changeReceiptType,
  correctReceiptLine,
  needsExtraction,
  resolveReceiptLines,
} from '../src/logic/receiptService';
import type { CanonicalItem, ReceiptWithLines } from '../src/types';
import { openTestDatabase } from './stubs/db';

/**
 * Receipt import end to end: real queries, real seed data, extraction
 * stubbed by feeding a fixture's recorded response straight to
 * `attachExtractedLines` — task 5.4's "extraction stubbed, matching real."
 */

let canonicals: Map<string, CanonicalItem>;

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
  canonicals = new Map((await getAllCanonicals()).map((c) => [c.id, c]));
});

async function extract(name: string): Promise<ReceiptWithLines> {
  const fixture = RECEIPTS.find((r) => r.name === name);
  if (!fixture) throw new Error(`Unknown fixture: ${name}`);
  const captured = await insertCapturedReceipt('file://receipt.jpg', fixture.captureDate);
  const parsed = parseReceiptResponse(fixture.recordedResponse, fixture.captureDate);
  await attachExtractedLines(captured.id, {
    store: parsed.store,
    purchasedAt: parsed.purchasedAt,
    receiptType: parsed.receiptType,
    totalCents: parsed.totalCents,
    lines: parsed.lines.map((line) => ({
      rawText: line.text,
      kind: line.kind,
      qty: line.qty,
      unit: line.unit,
      lineTotalCents: line.lineTotalCents,
      unitPriceCents: line.unitPriceCents,
    })),
  });
  return resolveReceiptLines(captured.id, parsed.store);
}

describe('capture without a key or connection', () => {
  test('a receipt captured with no key is retained, not lost', async () => {
    const receipt = await captureReceipt('base64-placeholder', 'file://receipt.jpg', '2026-06-01');
    expect(receipt.id).toBeTruthy();
    expect(needsExtraction(receipt)).toBe(true);

    const stored = await getReceipt(receipt.id);
    expect(stored).not.toBeNull();
    expect(stored?.lines).toEqual([]);
    expect(stored?.status).toBe('pending');
  });

  test('a pending receipt appears in the list, waiting to be extracted', async () => {
    await captureReceipt('base64-placeholder', 'file://receipt.jpg', '2026-06-01');
    const all = await listReceipts();
    expect(all.length).toBe(1);
    expect(all[0]?.status).toBe('pending');
  });
});

describe('resolution (task 5)', () => {
  test('a whole fixture receipt resolves through the real cascade against real seed data', async () => {
    const receipt = await extract('supermarketOne');
    const foodLines = receipt.lines.filter((l) => l.kind === 'food');
    expect(foodLines.length).toBeGreaterThan(0);
    // At least the exact-alias-band lines settle without a model.
    const resolved = foodLines.filter((l) => l.canonicalId !== null);
    expect(resolved.length).toBeGreaterThan(0);
  });

  test('non-food lines never reach the review queue', async () => {
    await extract('heavyNonFood');
    const queue = await getMatchQueue();
    const receipt = (await listReceipts())[0]!;
    const stored = await getReceipt(receipt.id);
    const nonFoodTexts = new Set(
      stored!.lines.filter((l) => l.kind !== 'food').map((l) => l.rawText),
    );
    expect(queue.some((q) => nonFoodTexts.has(q.rawText))).toBe(false);
  });

  test('an unresolved food line is distinguishable from an excluded non-food line', async () => {
    const receipt = await extract('asianGrocer');
    // 李錦記 蠔油-style lines land in `review` per the matcher's own corpus,
    // so an unresolved food line existing is expected, not a fixture bug.
    const unresolvedFood = receipt.lines.find((l) => l.kind === 'food' && l.canonicalId === null);
    const nonFood = receipt.lines.find((l) => l.kind === 'non_food');
    expect(nonFood).toBeDefined();
    expect(nonFood?.canonicalId).toBeNull();
    // Distinguishable by kind, not by canonical id alone — both may be null.
    expect(unresolvedFood?.kind).not.toBe(nonFood?.kind);
  });
});

describe('accepting a review (task 6.2, 6.3)', () => {
  test('nothing is applied while a receipt is pending', async () => {
    await extract('supermarketOne');
    const items = await listPantryItems();
    expect(items).toEqual([]);
  });

  test('accepting creates pantry items for resolved food lines, at zero drift', async () => {
    const receipt = await extract('supermarketOne');
    const summary = await acceptReceiptReview(receipt.id);
    expect(summary.names.length).toBeGreaterThan(0);

    const items = await listPantryItems();
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.estimatedDecrementsSinceAnchor).toBe(0);
      expect(item.qtySource).toBe('estimate');
    }

    const applied = await getReceipt(receipt.id);
    expect(applied?.status).toBe('applied');
  });

  test('an excluded line creates no pantry item', async () => {
    const receipt = await extract('supermarketOne');
    const foodLine = receipt.lines.find((l) => l.kind === 'food' && l.canonicalId !== null)!;
    await setReceiptLineExcluded(foodLine.id, true);

    await acceptReceiptReview(receipt.id);
    const items = await listPantryItems();
    expect(items.some((item) => item.canonicalId === foodLine.canonicalId)).toBe(false);
  });

  test('a restaurant receipt records no pantry item but still applies', async () => {
    const receipt = await extract('restaurant');
    const summary = await acceptReceiptReview(receipt.id);
    expect(summary.names).toEqual([]);
    expect(await listPantryItems()).toEqual([]);
    const applied = await getReceipt(receipt.id);
    expect(applied?.status).toBe('applied');
    expect(applied?.totalCents).toBe(4850);
  });
});

describe('reconciliation against existing stock (task 9.3)', () => {
  test('buying a replacement for an out item marks the old one replaced', async () => {
    const old = await insertPantryItem({
      canonicalId: 'soy-sauce-light',
      locationId: 'pantry',
      qtyRemaining: 0,
      qtyUnit: 'ml',
    });
    // Manually mark it out — mirroring the app's own status setter.
    await markItemUsedUp(old.id);

    const receipt = await extract('supermarketOne');
    await acceptReceiptReview(receipt.id);

    const oldNow = await getPantryItem(old.id);
    expect(oldNow?.status).toBe('replaced');

    const items = await listPantryItems();
    expect(items.some((i) => i.canonicalId === 'soy-sauce-light' && i.status === 'in_stock')).toBe(
      true,
    );
  });

  test('buying an ingredient already in stock leaves it alone and creates a second item', async () => {
    const existing = await insertPantryItem({
      canonicalId: 'sesame-oil',
      locationId: 'pantry',
      qtyRemaining: 200,
      qtyUnit: 'ml',
    });

    const receipt = await extract('supermarketOne');
    await acceptReceiptReview(receipt.id);

    const stillThere = await getPantryItem(existing.id);
    expect(stillThere?.status).toBe('in_stock');
    expect(stillThere?.qtyRemaining).toBe(200);

    const items = await listPantryItems();
    const sesameItems = items.filter((i) => i.canonicalId === 'sesame-oil');
    expect(sesameItems.length).toBe(2);
  });
});

describe('corrections are learned (task 6.5, 9.4)', () => {
  test('a corrected line resolves the same way on a second receipt', async () => {
    // "KS ORG EVOO 2L" sits in the review band of the matcher's own corpus
    // — too brand-specific for the offline cascade without a model.
    const receipt = await extract('warehouseClub');
    const unresolved = receipt.lines.find((l) => l.rawText === 'KS ORG EVOO 2L');
    expect(unresolved).toBeDefined();
    expect(unresolved?.canonicalId).toBeNull();

    await correctReceiptLine(unresolved!.id, unresolved!.rawText, 'olive-oil');
    const corrected = await getReceipt(receipt.id);
    expect(corrected?.lines.find((l) => l.id === unresolved!.id)?.canonicalId).toBe('olive-oil');

    // A second receipt carrying the exact same raw text now resolves without the model.
    const second = await extract('warehouseClub');
    const sameLine = second.lines.find((l) => l.rawText === 'KS ORG EVOO 2L');
    expect(sameLine?.canonicalId).toBe('olive-oil');
  });
});

describe('abandoning a review (task 9.5)', () => {
  test('a receipt never accepted leaves the pantry untouched', async () => {
    await extract('supermarketOne');
    expect(await listPantryItems()).toEqual([]);
    const receipts = await listReceipts();
    expect(receipts[0]?.status).toBe('pending');
  });
});

describe('changing the receipt type re-plans rather than undoing (task 8.4)', () => {
  test('marking an applied grocery receipt as restaurant removes its pantry items, keeps spending', async () => {
    const receipt = await extract('supermarketOne');
    await acceptReceiptReview(receipt.id);
    expect((await listPantryItems()).length).toBeGreaterThan(0);

    await changeReceiptType(receipt.id, 'restaurant');

    expect(await listPantryItems()).toEqual([]);
    const updated = await getReceipt(receipt.id);
    expect(updated?.type).toBe('restaurant');
    expect(updated?.totalCents).toBe(3427); // spending retained
    expect(updated?.lines.every((l) => l.pantryItemId === null)).toBe(true);
  });

  test('switching back to grocery recreates the items', async () => {
    const receipt = await extract('supermarketOne');
    await acceptReceiptReview(receipt.id);
    await changeReceiptType(receipt.id, 'restaurant');
    expect(await listPantryItems()).toEqual([]);

    await changeReceiptType(receipt.id, 'grocery');
    expect((await listPantryItems()).length).toBeGreaterThan(0);
  });

  test('changing the type on a still-pending receipt does not touch the pantry', async () => {
    const receipt = await extract('supermarketOne');
    await changeReceiptType(receipt.id, 'restaurant');
    expect(await listPantryItems()).toEqual([]);
    const updated = await getReceipt(receipt.id);
    expect(updated?.status).toBe('pending');
    expect(updated?.type).toBe('restaurant');
  });
});
