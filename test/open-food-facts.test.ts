import { describe, expect, test } from 'vitest';
import { parseOpenFoodFactsResponse } from '../src/api/openFoodFacts';
describe('Open Food Facts parsing', () => {
  test('reads an ordinary product without assuming optional fields', () => expect(parseOpenFoodFactsResponse({ product: { product_name: 'Soy sauce', brands: 'Kikkoman', quantity: '500 ml', nutriments: { 'energy-kcal_100g': 60, proteins_100g: 8 } } }, '123')).toMatchObject({ gtin: '123', name: 'Soy sauce', pkgQty: 500, pkgUnit: 'ml', containerCount: null, kcalPer100: 60, proteinPer100: 8, carbsPer100: null }));
  test('reads dietary fibre when the product catalogue provides it', () => expect(parseOpenFoodFactsResponse({ product: { product_name: 'Oats', nutriments: { fiber_100g: 10.1 } } }, '123')).toMatchObject({ fibrePer100: 10.1 }));
  test('keeps an explicit pack count but never derives one from total quantity', () => {
    expect(parseOpenFoodFactsResponse({ product: { product_name: 'Coconut milk', quantity: '6 × 400 ml' } }, '123')).toMatchObject({ pkgQty: 400, pkgUnit: 'ml', containerCount: 6 });
    expect(parseOpenFoodFactsResponse({ product: { product_name: 'Oil', quantity: '2.4 l' } }, '123')).toMatchObject({ pkgQty: 2400, pkgUnit: 'ml', containerCount: null });
  });
  test('returns null for a miss or malformed product', () => { expect(parseOpenFoodFactsResponse({ code: '123' }, '123')).toBeNull(); expect(parseOpenFoodFactsResponse({ product: {} }, '123')).toBeNull(); });
});
