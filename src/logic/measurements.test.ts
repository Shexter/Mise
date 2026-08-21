import { describe, expect, test } from 'vitest';

import { BODY_FAT_RANGE, HEIGHT_RANGE_CM, WEIGHT_RANGE_KG } from '@/logic/onboardingDomain';
import {
  adjustMeasurement, anchorMeasurement, cancelMeasurement, cmToIn, confirmMeasurement,
  inToCm, kgToLb, lbToKg, parseDecimalString, seedMeasurement, snapToNearest,
  validateBodyFatPct, validateHeightCm, validateMeasurement, validateWeightKg,
} from '@/logic/measurements';

describe('measurement conversions', () => {
  test('metric and imperial round trips preserve the canonical value', () => {
    expect(inToCm(cmToIn(173.4))).toBeCloseTo(173.4, 10);
    expect(lbToKg(kgToLb(72.35))).toBeCloseTo(72.35, 10);
  });

  test('repeated display-unit switches do not drift', () => {
    const canonical = 72.35;
    let displayed = canonical;
    for (let index = 0; index < 100; index += 1) displayed = lbToKg(kgToLb(displayed));
    expect(displayed).toBeCloseTo(canonical, 8);
  });

  test('validates inclusive range boundaries', () => {
    expect(validateMeasurement(HEIGHT_RANGE_CM.min, HEIGHT_RANGE_CM)).toBe(true);
    expect(validateMeasurement(HEIGHT_RANGE_CM.max, HEIGHT_RANGE_CM)).toBe(true);
    expect(validateMeasurement(WEIGHT_RANGE_KG.min - 0.01, WEIGHT_RANGE_KG)).toBe(false);
    expect(validateHeightCm(HEIGHT_RANGE_CM.min)).toBe(true);
    expect(validateHeightCm(HEIGHT_RANGE_CM.min - 0.01)).toBe(false);
    expect(validateWeightKg(WEIGHT_RANGE_KG.max)).toBe(true);
    expect(validateWeightKg(WEIGHT_RANGE_KG.max + 0.01)).toBe(false);
    expect(validateBodyFatPct(BODY_FAT_RANGE.min)).toBe(true);
    expect(validateBodyFatPct(BODY_FAT_RANGE.max + 0.01)).toBe(false);
  });

  test('parses decimal comma and dot without clamping outliers', () => {
    expect(parseDecimalString('72.35', WEIGHT_RANGE_KG)).toEqual({ ok: true, value: 72.35 });
    expect(parseDecimalString('72,35', WEIGHT_RANGE_KG)).toEqual({ ok: true, value: 72.35 });
    expect(parseDecimalString('999', WEIGHT_RANGE_KG)).toEqual({ ok: false, reason: 'out-of-range' });
    expect(parseDecimalString('72kg', WEIGHT_RANGE_KG)).toEqual({ ok: false, reason: 'invalid' });
  });

  test('snaps to the nearest step with decimal precision', () => {
    expect(snapToNearest(72.34, 0.1)).toBe(72.3);
    expect(snapToNearest(72.36, 0.1)).toBe(72.4);
  });
});

describe('confirmable measurement values', () => {
  test('an anchor cannot submit until adjusted or explicitly confirmed', () => {
    const anchor = anchorMeasurement(70);
    expect(anchor).toMatchObject({ value: null, origin: 'anchor', confirmed: false });
    expect(confirmMeasurement(anchor)).toMatchObject({ value: 70, confirmed: true });
    expect(adjustMeasurement(anchor, 71.2)).toMatchObject({ value: 71.2, origin: 'typed', confirmed: true });
  });

  test('saved values take precedence and cancellation does not create an anchor value', () => {
    expect(seedMeasurement(68, 'saved')).toMatchObject({ position: 68, value: 68, confirmed: true });
    expect(cancelMeasurement(anchorMeasurement(70))).toMatchObject({ value: null, confirmed: false });
  });

  test('extracted values remain unconfirmed', () => {
    expect(seedMeasurement(22.4, 'extracted')).toMatchObject({ value: 22.4, origin: 'extracted', confirmed: false });
  });
});
