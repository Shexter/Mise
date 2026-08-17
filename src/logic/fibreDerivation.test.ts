import { describe, expect, test } from 'vitest';
import { deriveResolvedFibre } from '@/logic/nutrition';
import { canonical } from '@/logic/__fixtures__/kitchens';
import type { Product } from '@/types';

const greens = canonical({ id: 'greens', displayName: 'Mixed greens', fibrePer100: null });
const product = (fibrePer100: number | null): Product => ({
  id: 'sku', gtin: '123', brand: null, name: 'Mixed greens', pkgQty: 500, pkgUnit: 'g',
  containerCount: null, canonicalId: 'greens', kcalPer100: 20, proteinPer100: 2,
  carbsPer100: 3, fatPer100: 0, fibrePer100, source: 'barcode', fetchedAt: null, lastScannedAt: null,
});

describe('post-resolution fibre derivation', () => {
  test('prefers structured product fibre and scales quantity', () => {
    expect(deriveResolvedFibre(product(2.5), greens, 200, 'g')).toMatchObject({ value: 5, source: 'product', confidence: 'structured' });
  });
  test('falls back after identity resolution for mixed greens', () => {
    expect(deriveResolvedFibre(null, greens, 100, 'g')).toMatchObject({ value: 2.2, source: 'text-fallback', confidence: 'fallback' });
  });
  test('keeps unknown when no defensible source exists', () => {
    expect(deriveResolvedFibre(null, canonical({ id: 'mystery', displayName: 'Mystery food' }), 1, 'serving')).toEqual({ value: null, source: null, confidence: 'unknown' });
  });
});
