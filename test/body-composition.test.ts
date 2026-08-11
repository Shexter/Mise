import { describe, expect, test } from 'vitest';

import { katchMcArdle } from '../src/logic/bmr';
import { TARGET_RESOLVERS, dexaFatFreeMass, energyInputWarnings, isMeasurementStale, PLAUSIBLE_RANGES, resolveTarget } from '../src/logic/bodyComposition';
import { TARGET_SOURCES, type BodyMeasurement, type Profile } from '../src/types';
import { recalculatedTarget } from '../src/store/profileStore';

const profile: Profile = {
  sex: 'female', age: 30, heightCm: 170, weightKg: 70,
  activityLevel: 'moderate', goal: 'maintain', targetCalories: 2000,
  targetSource: 'estimated', statedCalories: null, statedFigureKind: null,
  proteinPct: 0.3, carbsPct: 0.4, fatPct: 0.3, fibreTargetG: 30, units: 'metric',
  onboardedAt: '2026-08-09T00:00:00.000Z',
};

const dexa: BodyMeasurement = {
  provider: 'dexa', weightKg: 70, measuredAt: '2026-08-09', bodyFatPct: 20,
  leanTissueKg: null, boneMineralContentKg: null, fatFreeMassKg: 56,
};

test('Katch-McArdle uses measured fat-free mass', () => {
  expect(katchMcArdle(56)).toBeCloseTo(1579.6);
});

test('DEXA includes bone mineral content when that is the supplied shape', () => {
  expect(dexaFatFreeMass({ ...dexa, bodyFatPct: null, leanTissueKg: 53, boneMineralContentKg: 3 })).toBe(56);
  expect(dexaFatFreeMass(dexa)).toBe(56);
});

describe('resolveTarget', () => {
  test('dispatches each source and transforms stated figures only as declared', () => {
    expect(resolveTarget(profile, [dexa])).toBeGreaterThan(0);
    expect(resolveTarget({ ...profile, targetSource: 'dexa' }, [dexa])).toBeGreaterThan(0);
    expect(resolveTarget({ ...profile, targetSource: 'inbody' }, [{ ...dexa, provider: 'inbody', fatFreeMassKg: 56 }])).toBeGreaterThan(0);
    expect(resolveTarget({ ...profile, targetSource: 'dexa', weightKg: 80 }, [dexa])).toBe(resolveTarget({ ...profile, targetSource: 'dexa' }, [dexa]));
    expect(resolveTarget({ ...profile, targetSource: 'stated', statedCalories: 1775, statedFigureKind: 'adjusted' }, [])).toBe(1775);
    expect(resolveTarget({ ...profile, targetSource: 'stated', statedCalories: 1500, statedFigureKind: 'total', goal: 'lose' }, [])).toBe(1000);
    expect(resolveTarget({ ...profile, targetSource: 'stated', statedCalories: 1500, statedFigureKind: 'resting', activityLevel: 'moderate', goal: 'maintain' }, [])).toBe(2325);
    expect(resolveTarget({ ...profile, targetSource: 'inbody' }, [])).toBeNull();
  });
});

test('keeps the resolver dispatch exhaustive as sources are added', () => {
  expect(Object.keys(TARGET_RESOLVERS).sort()).toEqual([...TARGET_SOURCES].sort());
});

test('implausible values are flagged without altering the stored input', () => {
  const measurement = { ...dexa, bodyFatPct: 90 };
  expect(energyInputWarnings(profile, measurement)).not.toHaveLength(0);
  expect(measurement.bodyFatPct).toBe(90);
});

test('flags each plausible-range boundary without changing the input', () => {
  for (const bodyFatPct of [PLAUSIBLE_RANGES.bodyFatPct.min - 0.1, PLAUSIBLE_RANGES.bodyFatPct.max + 0.1]) {
    expect(energyInputWarnings(profile, { ...dexa, bodyFatPct })).toContain('Check the body fat percentage you entered.');
  }
  for (const fatFreeMassKg of [PLAUSIBLE_RANGES.fatFreeMassKg.min - 0.1, PLAUSIBLE_RANGES.fatFreeMassKg.max + 0.1]) {
    const measurement = { ...dexa, fatFreeMassKg };
    expect(energyInputWarnings(profile, measurement)).toContain('Check the Fat Free Mass you entered.');
    expect(measurement.fatFreeMassKg).toBe(fatFreeMassKg);
  }
  for (const statedCalories of [PLAUSIBLE_RANGES.statedCalories.min - 1, PLAUSIBLE_RANGES.statedCalories.max + 1]) {
    expect(energyInputWarnings({ ...profile, statedCalories })).toContain('Check the calorie figure and what it represents.');
  }
});

test('discloses a stale measurement but its target remains available', () => {
  expect(isMeasurementStale({ ...profile, weightKg: 73.5 }, dexa)).toBe(true);
  expect(resolveTarget({ ...profile, targetSource: 'dexa', weightKg: 73.5 }, [dexa])).not.toBeNull();
  expect(isMeasurementStale({ ...profile, weightKg: dexa.weightKg }, dexa)).toBe(false);
});

test('recalculation respects the active source', () => {
  const stated = { ...profile, targetSource: 'stated' as const, targetCalories: 1775, statedCalories: 1775, statedFigureKind: 'adjusted' as const };
  expect(recalculatedTarget({ ...stated, weightKg: 90 }, [])).toBe(1775);
  expect(recalculatedTarget({ ...profile, targetSource: 'estimated', weightKg: 80 }, [])).not.toBe(profile.targetCalories);
  const measured = { ...profile, targetSource: 'dexa' as const, activityLevel: 'active' as const };
  expect(recalculatedTarget(measured, [dexa])).toBe(resolveTarget(measured, [dexa]));
});
