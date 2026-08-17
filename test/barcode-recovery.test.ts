import { beforeEach, describe, expect, test } from 'vitest';

import { parseBarcodeEvidence } from '../src/api/barcodeRecovery';
import { getAllCanonicals, getLocations, getProductByBarcode, listPantryItems, loadSeedData } from '../src/db/queries';
import { classifyBarcode, confirmRecoveredBarcode, resolveBarcode } from '../src/logic/barcode';
import { BARCODE_FACTUAL_RESULT_DISCLOSURE, barcodeNutritionRows } from '../src/logic/barcodePresentation';
import { planCaptureItems } from '../src/logic/captureItems';
import { useBarcodeCaptureStore } from '../src/store/barcodeCaptureStore';
import { nextExpandedId } from '../src/logic/collapsibleEditor';
import { openTestDatabase } from './stubs/db';

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
  useBarcodeCaptureStore.getState().clearRecovery();
});

describe('barcode guided recovery', () => {
  test('switching disclosure rows keeps only the selected row open', () => {
    expect(nextExpandedId(null, 'barcode-a')).toBe('barcode-a');
    expect(nextExpandedId('barcode-a', 'barcode-b')).toBe('barcode-b');
    expect(nextExpandedId('barcode-b', 'barcode-b')).toBeNull();
  });
  test('parses only visible factual package fields and preserves unknown nutrition', () => {
    const evidence = parseBarcodeEvidence('{"name":"Tofu","brand":null,"pkgQty":300,"pkgUnit":"g","containerCount":null,"kcalPer100":null,"proteinPer100":12,"carbsPer100":null,"fatPer100":6}');
    expect(evidence.kcalPer100).toBeNull();
    expect(barcodeNutritionRows(evidence)).toContain('Energy: Not provided');
    expect(BARCODE_FACTUAL_RESULT_DISCLOSURE).not.toMatch(/good|bad|healthy|unhealthy/i);
  });

  test('manual no-network recovery retains the GTIN but creates no stock before review', async () => {
    const store = useBarcodeCaptureStore.getState();
    store.startRecovery('4006381333931', false);
    store.updateRecovery({ name: 'Recovered tofu', brand: 'Local brand' });
    expect(useBarcodeCaptureStore.getState().recoveryDraft?.gtin).toBe('4006381333931');
    expect(await listPantryItems()).toEqual([]);

    await confirmRecoveredBarcode({ gtin: '4006381333931', name: 'Recovered olive oil', brand: 'Local brand', canonicalId: 'olive-oil' });
    expect(await resolveBarcode('4006381333931')).toMatchObject({ kind: 'product', cached: true, product: { name: 'Recovered olive oil' } });
    expect(await listPantryItems()).toEqual([]);
  });

  test('store-local codes remain outside global product learning', async () => {
    const localCode = '2001234567893';
    expect(classifyBarcode(localCode)).toBe('store_local');
    expect(await resolveBarcode(localCode)).toEqual({ kind: 'store_local' });
    expect(await getProductByBarcode(localCode)).toBeNull();
  });

  test('a shelf image yields individual review candidates and cannot create stock', async () => {
    const [canonicals, locations] = await Promise.all([getAllCanonicals(), getLocations()]);
    const proposals = planCaptureItems(
      [{ name: 'olive oil', quantity: null, unit: null }, { name: 'jasmine rice', quantity: null, unit: null }],
      [
        { status: 'resolved', raw: 'olive oil', norm: 'olive oil', canonicalId: 'olive-oil', confidence: 1, method: 'exact_alias' },
        { status: 'resolved', raw: 'jasmine rice', norm: 'jasmine rice', canonicalId: 'jasmine-rice', confidence: 1, method: 'exact_alias' },
      ],
      canonicals, locations, '2026-08-11',
    );
    expect(proposals).toHaveLength(2);
    expect(proposals.every((proposal) => proposal.canonical && proposal.location)).toBe(true);
    expect(await listPantryItems()).toEqual([]);
  });
});
