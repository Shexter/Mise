import { describe, expect, test } from 'vitest';
import { classifyBarcode, hasValidCheckDigit } from '../src/logic/barcode';

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
});
