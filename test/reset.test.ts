import { beforeEach, describe, expect, test } from 'vitest';

import {
  applyReceiptChanges,
  attachExtractedLines,
  enqueueMatch,
  getAllCanonicals,
  getBestAliasByNorm,
  getMatchQueue,
  getProductByBarcode,
  getReceipt,
  insertCanonicalItem,
  insertCapturedReceipt,
  insertProduct,
  insertRecipe,
  listRecipes,
  listPantryItems,
  listReceipts,
  loadSeedData,
  recordUserResolution,
} from '../src/db/queries';
import { openTestDatabase, resetTestDatabase } from './stubs/db';

/**
 * Mirrors *Settings → Delete all data*: `resetDatabase` runs `DROP_ALL`,
 * re-migrates, and reloads the seed — so a wiped install holds exactly the
 * shipped seed set and nothing the user taught it.
 */
describe('delete all data', () => {
  beforeEach(async () => {
    openTestDatabase();
    await loadSeedData();
  });

  test('clears the identity tables and a relaunch reloads only the seed set', async () => {
    const seedCount = (await getAllCanonicals()).length;

    // The user teaches the app things the wipe must forget.
    await recordUserResolution('MY WEIRD LABEL', 'miso');
    await insertProduct({
      gtin: '999',
      name: 'Some SKU',
      canonicalId: 'miso',
      source: 'user',
    });
    await enqueueMatch({ rawText: 'UNPLACED THING', source: 'receipt' });
    await insertCanonicalItem({
      id: 'my-custom-thing',
      displayName: 'My custom thing',
      foodClass: 'condiment',
      defaultLocation: 'pantry',
      shelfLifeDays: { pantry: 100 },
    });

    // Delete all data, then the next launch's init path.
    resetTestDatabase();
    await loadSeedData();

    const canonicals = await getAllCanonicals();
    expect(canonicals.length).toBe(seedCount);
    expect(canonicals.every((item) => item.isSeed)).toBe(true);
    expect(canonicals.find((item) => item.id === 'my-custom-thing')).toBeUndefined();
    expect(await getBestAliasByNorm('my weird label')).toBeNull();
    expect(await getProductByBarcode('999')).toBeNull();
    expect(await getMatchQueue()).toEqual([]);
  });

  test('clears receipts and their lines (task 9.6)', async () => {
    const receipt = await insertCapturedReceipt('file://receipt.jpg', '2026-06-01');
    await attachExtractedLines(receipt.id, {
      store: 'Test Store',
      purchasedAt: '2026-06-01',
      receiptType: 'grocery',
      subtotalCents: 500,
      taxCents: 0,
      totalCents: 500,
      lines: [
        {
          rawText: 'TEST ITEM',
          kind: 'food',
          qty: 1,
          unit: 'piece',
          quantityKind: 'count',
          lineTotalCents: 500,
          unitPriceCents: null,
          appliesToText: null,
        },
      ],
    });
    expect((await listReceipts()).length).toBe(1);

    resetTestDatabase();
    await loadSeedData();

    expect(await listReceipts()).toEqual([]);
  });

  test('clears saved recipes (recipe-links task 9.8)', async () => {
    await insertRecipe({ title: 'To delete', sourceLink: 'https://example.com/post' });
    expect((await listRecipes()).length).toBe(1);
    resetTestDatabase();
    await loadSeedData();
    expect(await listRecipes()).toEqual([]);
  });

  test('rebuilds a populated database with circular receipt and pantry links', async () => {
    const receipt = await insertCapturedReceipt('file://linked-receipt.jpg', '2026-08-11');
    await attachExtractedLines(receipt.id, {
      store: 'Test Market',
      purchasedAt: '2026-08-11',
      receiptType: 'grocery',
      subtotalCents: 500,
      taxCents: 0,
      totalCents: 500,
      lines: [{
        rawText: 'MISO', kind: 'food', qty: 1, unit: 'piece', quantityKind: 'count',
        lineTotalCents: 500, unitPriceCents: 500, appliesToText: null,
      }],
    });
    const stored = await getReceipt(receipt.id);
    const lineId = stored?.lines[0]?.id;
    expect(lineId).toBeTruthy();

    await applyReceiptChanges(receipt.id, [{
      kind: 'create',
      lineId: lineId!,
      item: {
        canonicalId: 'miso', locationId: 'fridge', qtyRemaining: 500,
        qtyUnit: 'g', priceCents: 500, purchasedAt: '2026-08-11',
      },
    }]);
    expect(await listPantryItems()).toHaveLength(1);

    resetTestDatabase();
    await loadSeedData();
    expect(await listPantryItems()).toEqual([]);
    expect(await listReceipts()).toEqual([]);
  });
});
