import { describe, expect, test } from 'vitest';
import { BARCODE_MISS_TTL_MS, classifyBarcode, hasValidCheckDigit, isFreshBarcodeMiss, lookupBarcode } from '../src/logic/barcode';

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
  test('uses cached products and fresh misses without a network request', async () => {
    let lookups = 0;
    const cache = { getProduct: async () => ({ id: 'cached' }), getMiss: async () => null, lookup: async () => { lookups += 1; return null; }, recordMiss: async () => undefined };
    expect(await lookupBarcode('4006381333931', cache)).toMatchObject({ kind: 'product', cached: true });
    expect(lookups).toBe(0);
    const missCache = { ...cache, getProduct: async () => null, getMiss: async () => ({ fetchedAt: new Date().toISOString() }) };
    expect(await lookupBarcode('4006381333931', missCache)).toEqual({ kind: 'missing', cached: true });
    expect(lookups).toBe(0);
  });
});
