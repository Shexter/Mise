import { beforeEach, describe, expect, test } from 'vitest';

import { applyBarcodeSession, getBestAliasByNorm, getProductByBarcode, insertProduct, listPantryItems, loadSeedData, upsertProduct } from '../src/db/queries';
import { barcodePantryItems, confirmBarcodeMatch, identifyBarcode, BARCODE_MISS_TTL_MS, classifyBarcode, hasValidCheckDigit, isBarcodeScanDebounced, isFreshBarcodeMiss, lookupBarcode, resolveBarcode } from '../src/logic/barcode';
import { normalise } from '../src/logic/normalise';
import { useBarcodeCaptureStore } from '../src/store/barcodeCaptureStore';
import { openTestDatabase } from './stubs/db';

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
});

describe('barcode validation', () => {
  test('accepts standard retail formats with valid check digits', () => {
    expect(hasValidCheckDigit('4006381333931')).toBe(true);
    expect(hasValidCheckDigit('96385074')).toBe(true);
    expect(hasValidCheckDigit('036000291452')).toBe(true);
  });
  test('treats a bad check digit as unread, never as an unknown product', () => {
    expect(classifyBarcode('4006381333932')).toBe('unread');
  });
  test('routes restricted circulation labels away from lookup and caching', () => {
    expect(classifyBarcode('2001234567893')).toBe('store_local');
  });
  test('accepts a normal EAN-13 as a globally meaningful product', () => {
    expect(classifyBarcode('4006381333931')).toBe('product');
  });
  test('holds a remote miss for one month, then permits a refresh', () => {
    const now = Date.parse('2026-08-10T00:00:00Z');
    expect(isFreshBarcodeMiss('2026-07-11T00:00:01Z', now)).toBe(true);
    expect(isFreshBarcodeMiss(new Date(now - BARCODE_MISS_TTL_MS).toISOString(), now)).toBe(false);
  });

  test('debounces only a held code, allowing a later deliberate rescan', () => {
    expect(isBarcodeScanDebounced(1_000, 2_000)).toBe(true);
    expect(isBarcodeScanDebounced(1_000, 2_500)).toBe(false);
  });
  test('uses cached products and fresh misses without a network request', async () => {
    let lookups = 0;
    const cache = { getProduct: async () => ({ id: 'cached' }), getMiss: async () => null, lookup: async () => { lookups += 1; return null; }, recordMiss: async () => undefined };
    expect(await lookupBarcode('4006381333931', cache)).toMatchObject({ kind: 'product', cached: true });
    expect(lookups).toBe(0);
    const missCache = { ...cache, getProduct: async () => null, getMiss: async () => ({ fetchedAt: new Date().toISOString() }) };
    expect(await lookupBarcode('4006381333931', missCache)).toEqual({ kind: 'missing', cached: true });
    expect(lookups).toBe(0);
  });

  test('a confirm-band answer teaches the name matcher and binds this exact GTIN', async () => {
    const product = await confirmBarcodeMatch({
      gtin: '4006381333931',
      name: 'Barcode test olive oil',
      brand: 'Test brand',
      pkgQty: 500,
      pkgUnit: 'ml',
      containerCount: null,
      kcalPer100: null,
      proteinPer100: null,
      carbsPer100: null,
      fatPer100: null,
    }, 'olive-oil');

    expect(product.canonicalId).toBe('olive-oil');
    expect((await getBestAliasByNorm(normalise('Barcode test olive oil')))?.canonicalId).toBe('olive-oil');
    expect((await resolveBarcode('4006381333931'))).toMatchObject({
      kind: 'product',
      cached: true,
      product: { canonicalId: 'olive-oil' },
    });
    expect((await getProductByBarcode('4006381333931'))?.canonicalId).toBe('olive-oil');
  });

  test('preserves an explicit cached pack count unless an update supplies a replacement', async () => {
    const product = await insertProduct({
      gtin: '4006381333931', name: 'Coconut milk', brand: null,
      pkgQty: 400, pkgUnit: 'ml', containerCount: 6, canonicalId: 'olive-oil', source: 'barcode',
    });
    const refreshed = await upsertProduct({
      gtin: product.gtin, name: product.name, brand: product.brand,
      pkgQty: product.pkgQty, pkgUnit: product.pkgUnit, canonicalId: product.canonicalId, source: 'barcode',
    });
    expect(refreshed.containerCount).toBe(6);
  });

  test('creates one pantry item per explicit container and never guesses an unknown count', async () => {
    const multipack = await insertProduct({
      gtin: '4006381333931', name: 'Six cans', brand: null,
      pkgQty: 400, pkgUnit: 'ml', containerCount: 6, canonicalId: 'olive-oil', source: 'barcode',
    });
    const unknownPack = await insertProduct({
      gtin: '4006381333932', name: 'Large bottle', brand: null,
      pkgQty: 2_400, pkgUnit: 'ml', containerCount: null, canonicalId: 'olive-oil', source: 'barcode',
    });

    const multiItems = barcodePantryItems(multipack, 'pantry', '2026-08-10');
    const unknownItems = barcodePantryItems(unknownPack, 'pantry', '2026-08-10');
    expect(multiItems).toHaveLength(6);
    expect(multiItems.every((item) => item.qtyRemaining === 400 && item.qtyUnit === 'ml')).toBe(true);
    expect(unknownItems).toEqual([expect.objectContaining({ qtyRemaining: 2_400, qtyUnit: 'ml' })]);

    await applyBarcodeSession([...multiItems, ...unknownItems]);
    expect(await listPantryItems()).toHaveLength(7);
  });

  test('manual identifications bind two absent barcodes for later cached scans', async () => {
    const products = await Promise.all([
      identifyBarcode('4006381333931', 'Market coconut milk', 'olive-oil', 'Market brand'),
      identifyBarcode('96385074', 'Market rice noodles', 'jasmine-rice'),
    ]);
    expect(products).toMatchObject([
      { gtin: '4006381333931', name: 'Market coconut milk', canonicalId: 'olive-oil', source: 'user' },
      { gtin: '96385074', name: 'Market rice noodles', canonicalId: 'jasmine-rice', source: 'user' },
    ]);
    for (const product of products) {
      expect(await resolveBarcode(product.gtin!)).toMatchObject({
        kind: 'product', cached: true, product: { id: product.id, canonicalId: product.canonicalId },
      });
    }
  });

  test('keeps a rapid scan session in memory until one atomic apply', async () => {
    const product = await insertProduct({
      gtin: '4006381333931', name: 'Test olive oil', brand: null,
      pkgQty: 500, pkgUnit: 'ml', canonicalId: 'olive-oil', source: 'barcode',
    });
    const store = useBarcodeCaptureStore.getState();
    store.clearSession();
    store.addSessionProduct(product);
    store.addSessionProduct(product);

    expect((await listPantryItems())).toEqual([]);
    expect(useBarcodeCaptureStore.getState().session).toHaveLength(2);

    const ids = await applyBarcodeSession(useBarcodeCaptureStore.getState().session.map((item) => ({
      canonicalId: item.product.canonicalId,
      productId: item.product.id,
      locationId: 'pantry',
      purchasedAt: '2026-08-10',
      qtyRemaining: item.product.pkgQty,
      qtyUnit: item.product.pkgUnit,
      qtySource: 'estimate',
    })));
    expect(ids).toHaveLength(2);
    const items = await listPantryItems();
    expect(items).toHaveLength(2);
    expect(items.every((item) => item.qtyRemaining === 500 && item.qtyUnit === 'ml' && item.estimatedDecrementsSinceAnchor === 0)).toBe(true);

    store.clearSession();
    expect(useBarcodeCaptureStore.getState().session).toEqual([]);
    expect((await listPantryItems())).toHaveLength(2);
  });

  test('rolls back the whole batch if one scanned item cannot apply', async () => {
    const product = await insertProduct({
      gtin: '4006381333931', name: 'Test olive oil', brand: null,
      pkgQty: 500, pkgUnit: 'ml', canonicalId: 'olive-oil', source: 'barcode',
    });
    await expect(applyBarcodeSession([
      { canonicalId: 'olive-oil', productId: product.id, locationId: 'pantry', purchasedAt: '2026-08-10', qtyRemaining: 500, qtyUnit: 'ml', qtySource: 'estimate' },
      { canonicalId: 'missing-item', productId: product.id, locationId: 'pantry', purchasedAt: '2026-08-10', qtyRemaining: 500, qtyUnit: 'ml', qtySource: 'estimate' },
    ])).rejects.toThrow('valid ingredient or location');
    expect(await listPantryItems()).toEqual([]);
  });
});
