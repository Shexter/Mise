import { describe, expect, test } from 'vitest';

import { assessMacroGap, macroShortfall } from '../src/logic/macroGap';
import type { CanonicalItem, PantryItem } from '../src/types';

const canonical = (id: string, overrides: Partial<CanonicalItem>): CanonicalItem => ({
  id, displayName: id, foodClass: 'protein', defaultLocation: 'fridge',
  shelfLifeDays: {}, earlyWarningDays: null, openLifeDays: null, sources: {},
  kcalPer100: null, proteinPer100: null, carbsPer100: null, fatPer100: null,
  fibrePer100: null, vitaminCMgPer100: null, ironMgPer100: null, vitaminB12McgPer100: null,
  calciumMgPer100: null, folateMcgPer100: null, vitaminAMcgPer100: null, potassiumMgPer100: null,
  vitaminDMcgPer100: null, magnesiumMgPer100: null, zincMgPer100: null, sodiumMgPer100: null, vitaminEMgPer100: null, vitaminKMcgPer100: null, thiaminMgPer100: null, riboflavinMgPer100: null,
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

  test('per100 reads the matching field for every new micronutrient target, present and absent', () => {
    const full = canonical('spinach', {
      fibrePer100: 2.2, vitaminCMgPer100: 28, ironMgPer100: 2.7, vitaminB12McgPer100: 0,
      calciumMgPer100: 99, folateMcgPer100: 194, vitaminAMcgPer100: 469, potassiumMgPer100: 558,
    });
    const targets: [import('../src/logic/macroGap').MacroGapTarget, number][] = [
      ['fibre', 2.2], ['vitaminC', 28], ['iron', 2.7], ['vitaminB12', 0],
      ['calcium', 99], ['folate', 194], ['vitaminA', 469], ['potassium', 558],
    ];
    for (const [target, expected] of targets) {
      expect(assessMacroGap([item('spinach', 'spinach', 100, null)], new Map([['spinach', full]]), target).bestAchievableG).toBe(expected);
    }

    const empty = canonical('mystery', {});
    for (const [target] of targets) {
      expect(assessMacroGap([item('mystery', 'mystery', 100, null)], new Map([['mystery', empty]]), target)).toMatchObject({
        hasMeasuredCoverage: false, hasUnmeasuredStock: true,
      });
    }
  });

  test('fibre is no longer unconditionally null now that the catalogue populates it', () => {
    const result = assessMacroGap(
      [item('kale', 'kale', 200, '2026-01-05')],
      new Map([['kale', canonical('kale', { fibrePer100: 3.6 })]]),
      'fibre',
      '2026-01-01',
    );
    expect(result.bestAchievableG).toBe(7.2);
    expect(result.hasMeasuredCoverage).toBe(true);
  });

  test('a new target (iron) ranks and tiebreaks identically to the macro targets, with the same unmeasured-stock behavior', () => {
    const canonicals = new Map([
      ['lentils', canonical('lentils', { ironMgPer100: 7.5 })],
      ['spinach', canonical('spinach', { ironMgPer100: 2.7 })],
      ['unknown', canonical('unknown', { ironMgPer100: null })],
    ]);
    const result = assessMacroGap([
      item('lentils', 'lentils', 200, '2026-01-10'),
      item('spinach', 'spinach', 200, '2026-01-02'),
      item('unknown', 'unknown', 200, null),
    ], canonicals, 'iron', '2026-01-01');
    expect(result.contributors.map((entry) => entry.canonical.id)).toEqual(['lentils', 'spinach']);
    expect(result.hasMeasuredCoverage).toBe(true);
    expect(result.hasUnmeasuredStock).toBe(true);
  });

  test('the seven new micronutrient targets have no daily target to derive a shortfall from', () => {
    const target = { proteinG: 120, carbsG: 240, fatG: 80, fibreG: 30 };
    const consumed = { proteinG: 85, carbsG: 260, fatG: 70, fibreG: 10 };
    for (const macro of ['vitaminC', 'iron', 'vitaminB12', 'calcium', 'folate', 'vitaminA', 'potassium'] as const) {
      expect(macroShortfall(target, consumed, macro)).toBeNull();
    }
  });
});
