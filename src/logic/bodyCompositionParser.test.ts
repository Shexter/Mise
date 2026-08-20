import { describe, expect, test } from 'vitest';

import type { BodyCompositionPromptResponse } from '@/api/bodyCompositionPrompt';
import {
  BODY_COMPOSITION_PREFILL_BOUNDS,
  normalizeBodyComposition,
  sanitizeConfirmedBodyCompositionNumber,
} from '@/logic/bodyCompositionParser';
import { KG_PER_LB } from '@/logic/units';

const emptyRaw = (patch: Partial<BodyCompositionPromptResponse> = {}): BodyCompositionPromptResponse => ({
  provider: 'unknown',
  weightKg: null,
  bodyFatPct: null,
  leanTissueKg: null,
  boneMineralContentKg: null,
  fatFreeMassKg: null,
  bmrKcal: null,
  confidence: 'low',
  ...patch,
});

describe('normalizeBodyComposition', () => {
  test('normalises a realistic metric DEXA response without deriving fields', () => {
    const result = normalizeBodyComposition(emptyRaw({
      provider: 'dexa',
      weightKg: '82.4 kg',
      bodyFatPct: '21.7%',
      leanTissueKg: 61.8,
      boneMineralContentKg: 3.1,
      confidence: 'high',
    }));
    expect(result).toMatchObject({
      provider: 'dexa', weightKg: 82.4, bodyFatPct: 21.7,
      leanTissueKg: 61.8, boneMineralContentKg: 3.1,
      fatFreeMassKg: null, bmrKcal: null, confidence: 'high', issues: [],
    });
  });

  test('converts explicit imperial InBody masses without rounding', () => {
    const result = normalizeBodyComposition(emptyRaw({
      provider: 'inbody',
      weightKg: '154 lbs',
      fatFreeMassKg: '128.5 pounds',
      bmrKcal: '1512 kcal/day',
      confidence: 'medium',
    }));
    expect(result.weightKg).toBe(154 * KG_PER_LB);
    expect(result.fatFreeMassKg).toBe(128.5 * KG_PER_LB);
    expect(result.bmrKcal).toBe(1512);
    expect(result.issues).toEqual([]);
  });

  test('keeps missing values absent and never synthesises a companion field', () => {
    const result = normalizeBodyComposition(emptyRaw({
      provider: 'dexa', weightKg: 80, bodyFatPct: 20,
    }));
    expect(result.leanTissueKg).toBeNull();
    expect(result.boneMineralContentKg).toBeNull();
    expect(result.fatFreeMassKg).toBeNull();
    expect(result.bmrKcal).toBeNull();
    expect(result.provider).toBe('dexa');
    expect(result).not.toHaveProperty('measuredAt');
  });

  test.each([
    ['zero', 0],
    ['negative', -1],
    ['NaN', Number.NaN],
    ['infinity', Number.POSITIVE_INFINITY],
  ])('rejects %s numeric candidates without clamping', (_label, value) => {
    const result = normalizeBodyComposition(emptyRaw({ weightKg: value }));
    expect(result.weightKg).toBeNull();
    expect(result.issues).toContainEqual(expect.objectContaining({
      field: 'weightKg', code: 'invalid_value',
    }));
  });

  test('rejects unsupported and contradictory units rather than guessing', () => {
    const result = normalizeBodyComposition(emptyRaw({
      weightKg: '154 stone',
      leanTissueKg: '55 kg lb',
      bmrKcal: '1500 watts',
    }));
    expect(result.weightKg).toBeNull();
    expect(result.leanTissueKg).toBeNull();
    expect(result.bmrKcal).toBeNull();
    expect(result.issues).toHaveLength(3);
    expect(result.issues.every((issue) => issue.code === 'unsupported_unit')).toBe(true);
  });

  test('enforces the named weight lower bound only for automatic prefill', () => {
    expect(BODY_COMPOSITION_PREFILL_BOUNDS.weightKg.exclusiveMin).toBe(20);
    const atBoundary = normalizeBodyComposition(emptyRaw({ weightKg: 20 }));
    const aboveBoundary = normalizeBodyComposition(emptyRaw({ weightKg: 20.0001 }));
    expect(atBoundary.weightKg).toBeNull();
    expect(atBoundary.issues).toContainEqual(expect.objectContaining({
      field: 'weightKg', code: 'outside_prefill_bounds', receivedValue: 20,
    }));
    expect(aboveBoundary.weightKg).toBe(20.0001);
  });

  test('accepts body fat at 3 and 60 percent and withholds values outside', () => {
    expect(normalizeBodyComposition(emptyRaw({ bodyFatPct: 3 })).bodyFatPct).toBe(3);
    expect(normalizeBodyComposition(emptyRaw({ bodyFatPct: 60 })).bodyFatPct).toBe(60);
    for (const value of [2.999, 60.001]) {
      const result = normalizeBodyComposition(emptyRaw({ bodyFatPct: value }));
      expect(result.bodyFatPct).toBeNull();
      expect(result.issues).toContainEqual(expect.objectContaining({
        field: 'bodyFatPct', code: 'outside_prefill_bounds', receivedValue: value,
      }));
    }
  });

  test('flags Fat Free Mass materially above weight without mutating either value', () => {
    const result = normalizeBodyComposition(emptyRaw({
      provider: 'inbody', weightKg: 70, fatFreeMassKg: 74,
    }));
    expect(result.weightKg).toBe(70);
    expect(result.fatFreeMassKg).toBe(74);
    expect(result.issues).toContainEqual(expect.objectContaining({
      field: 'fatFreeMassKg', code: 'exceeds_weight', receivedValue: 74,
    }));
  });

  test('flags combined DEXA lean tissue and bone above weight without deriving a total', () => {
    const result = normalizeBodyComposition(emptyRaw({
      provider: 'dexa', weightKg: 60, leanTissueKg: 59, boneMineralContentKg: 4,
    }));
    expect(result.leanTissueKg).toBe(59);
    expect(result.boneMineralContentKg).toBe(4);
    expect(result.fatFreeMassKg).toBeNull();
    expect(result.issues).toContainEqual(expect.objectContaining({
      field: 'leanTissueKg', code: 'exceeds_weight',
    }));
  });

  test('does not infer provider, body fat, Fat Free Mass, BMR, or a date', () => {
    const result = normalizeBodyComposition(emptyRaw({
      provider: 'unknown', weightKg: 80, leanTissueKg: 60, boneMineralContentKg: 3,
    }));
    expect(result.provider).toBe('unknown');
    expect(result.bodyFatPct).toBeNull();
    expect(result.fatFreeMassKg).toBeNull();
    expect(result.bmrKcal).toBeNull();
    expect(result).not.toHaveProperty('date');
    expect(result).not.toHaveProperty('measuredAt');
  });
});

describe('sanitizeConfirmedBodyCompositionNumber', () => {
  test('preserves positive finite manual outliers for the existing warning layer', () => {
    expect(sanitizeConfirmedBodyCompositionNumber(2.5)).toBe(2.5);
    expect(sanitizeConfirmedBodyCompositionNumber('700')).toBe(700);
    expect(sanitizeConfirmedBodyCompositionNumber(0)).toBeNull();
    expect(sanitizeConfirmedBodyCompositionNumber('not a number')).toBeNull();
  });
});
