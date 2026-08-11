import { describe, expect, test } from 'vitest';

import { assessMacroGap, macroShortfall } from '../src/logic/macroGap';
import type { CanonicalItem, PantryItem } from '../src/types';

const canonical = (id: string, overrides: Partial<CanonicalItem>): CanonicalItem => ({
  id, displayName: id, foodClass: 'protein', defaultLocation: 'fridge',
  shelfLifeDays: {}, earlyWarningDays: null, openLifeDays: null, sources: {},
  kcalPer100: null, proteinPer100: null, carbsPer100: null, fatPer100: null,
  typicalUseQty: null, typicalUseUnit: null, typicalPkgQty: null, typicalPkgUnit: null,
  densityGPerMl: null, isSeed: true, createdAt: '2026-01-01', ...overrides,
});

const item = (id: string, canonicalId: string, qtyRemaining: number, expiresAt: string | null): PantryItem => ({
  id, canonicalId, productId: null, locationId: 'fridge', qtyRemaining, qtyUnit: 'g',
  qtySource: 'estimate', fullness: null, usesCount: 0, purchasedAt: '2026-01-01',
  openedAt: null, expiresAt, expirySource: 'predicted', status: 'in_stock',
  estimatedDecrementsSinceAnchor: 0, lastAnchorAt: null, priceCents: null,
  photoUri: null, replacementAsked: false, createdAt: '2026-01-01', updatedAt: '2026-01-01',
});

describe('macro-gap assessment', () => {
  test('uses the shipped daily target and consumed totals for a target macro', () => {
    expect(macroShortfall(
      { proteinG: 120, carbsG: 240, fatG: 80, fibreG: 30 },
      { proteinG: 85, carbsG: 260, fatG: 70, fibreG: null },
      'protein',
    )).toBe(35);
    expect(macroShortfall(
      { proteinG: 120, carbsG: 240, fatG: 80, fibreG: 30 },
      { proteinG: 85, carbsG: 260, fatG: 70, fibreG: null },
      'carbs',
    )).toBe(0);
    expect(macroShortfall(
      { proteinG: 120, carbsG: 240, fatG: 80, fibreG: 30 },
      { proteinG: null, carbsG: 260, fatG: 70, fibreG: null },
      'protein',
    )).toBeNull();
  });

  test('ranks measurable macro contribution before expiry', () => {
    const canonicals = new Map([
      ['cucumber', canonical('cucumber', { proteinPer100: 1 })],
      ['tofu', canonical('tofu', { proteinPer100: 15 })],
    ]);
    const result = assessMacroGap([
      item('cucumber', 'cucumber', 300, '2026-01-02'),
      item('tofu', 'tofu', 300, '2026-01-10'),
    ], canonicals, 'protein', '2026-01-01');
    expect(result.contributors.map((entry) => entry.canonical.id)).toEqual(['tofu', 'cucumber']);
  });

  test('uses expiry to separate comparable contributions', () => {
    const canonicals = new Map([
      ['a', canonical('a', { proteinPer100: 10 })],
      ['b', canonical('b', { proteinPer100: 10.5 })],
    ]);
    const result = assessMacroGap([
      item('a', 'a', 100, '2026-01-04'),
      item('b', 'b', 100, '2026-01-02'),
    ], canonicals, 'protein', '2026-01-01');
    expect(result.contributors.map((entry) => entry.canonical.id)).toEqual(['b', 'a']);
  });

  test('does not turn unknown nutrition into zero contribution', () => {
    const result = assessMacroGap(
      [item('unknown', 'unknown', 200, null)],
      new Map([['unknown', canonical('unknown', { proteinPer100: null })]]),
      'protein',
    );
    expect(result).toMatchObject({
      hasMeasuredCoverage: false, hasUnmeasuredStock: true, bestAchievableG: 0, contributors: [],
    });
  });

  test('keeps an unknown pantry item visible as partial coverage beside measurable stock', () => {
    const result = assessMacroGap(
      [item('tofu', 'tofu', 200, null), item('unknown', 'unknown', 200, null)],
      new Map([
        ['tofu', canonical('tofu', { proteinPer100: 15 })],
        ['unknown', canonical('unknown', { proteinPer100: null })],
      ]),
      'protein',
    );
    expect(result).toMatchObject({
      hasMeasuredCoverage: true, hasUnmeasuredStock: true, bestAchievableG: 30,
    });
  });
});
