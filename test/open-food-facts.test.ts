import { describe, expect, test } from 'vitest';
import { parseOpenFoodFactsResponse } from '../src/api/openFoodFacts';
describe('Open Food Facts parsing', () => {
  test('reads an ordinary product without assuming optional fields', () => expect(parseOpenFoodFactsResponse({ product: { product_name: 'Soy sauce', brands: 'Kikkoman', quantity: '500 ml', nutriments: { 'energy-kcal_100g': 60, proteins_100g: 8 } } }, '123')).toMatchObject({ gtin: '123', name: 'Soy sauce', pkgQty: 500, pkgUnit: 'ml', kcalPer100: 60, proteinPer100: 8, carbsPer100: null }));
  test('returns null for a miss or malformed product', () => { expect(parseOpenFoodFactsResponse({ code: '123' }, '123')).toBeNull(); expect(parseOpenFoodFactsResponse({ product: {} }, '123')).toBeNull(); });
});
