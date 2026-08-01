import { describe, expect, test } from 'vitest';

import { convert, usesPerContainer, type MeasureFacts } from '@/logic/measures';

const NO_FACTS: MeasureFacts = {
  densityGPerMl: null,
  typicalUseQty: null,
  typicalUseUnit: null,
};

/** Seeded gochujang: a use in tbsp, a package in grams. */
const GOCHUJANG: MeasureFacts = {
  densityGPerMl: 1.2,
  typicalUseQty: 1,
  typicalUseUnit: 'tbsp',
  typicalPkgQty: 500,
  typicalPkgUnit: 'g',
};

/** Seeded sesame oil: a use in tsp, a package in ml. */
const SESAME_OIL: MeasureFacts = {
  densityGPerMl: 0.92,
  typicalUseQty: 1,
  typicalUseUnit: 'tsp',
  typicalPkgQty: 250,
  typicalPkgUnit: 'ml',
};

describe('fixed volume conversions', () => {
  test('convert between volume units without any ingredient facts', () => {
    expect(convert(1, 'tbsp', 'ml', NO_FACTS)).toBe(15);
    expect(convert(1, 'tsp', 'ml', NO_FACTS)).toBe(5);
    expect(convert(1, 'cup', 'ml', NO_FACTS)).toBe(240);
    expect(convert(3, 'tsp', 'tbsp', NO_FACTS)).toBe(1);
    expect(convert(30, 'ml', 'tbsp', NO_FACTS)).toBe(2);
  });

  test('the identity conversion is free', () => {
    expect(convert(7, 'g', 'g', NO_FACTS)).toBe(7);
  });
});

describe('ingredient-dependent conversions', () => {
  test('volume to mass uses the density', () => {
    // 1 tbsp = 15 ml; at 1.2 g/ml that is 18 g.
    expect(convert(1, 'tbsp', 'g', GOCHUJANG)).toBeCloseTo(18);
  });

  test('mass to volume inverts it', () => {
    expect(convert(18, 'g', 'tbsp', GOCHUJANG)).toBeCloseTo(1);
    expect(convert(92, 'g', 'ml', SESAME_OIL)).toBeCloseTo(100);
  });

  test('counts convert through a known weight per unit', () => {
    const egg: MeasureFacts = { ...NO_FACTS, gramsPerPiece: 50 };
    expect(convert(2, 'piece', 'g', egg)).toBe(100);

    const bacon: MeasureFacts = { ...NO_FACTS, gramsPerSlice: 20 };
    expect(convert(3, 'slice', 'g', bacon)).toBe(60);

    const yoghurt: MeasureFacts = { ...NO_FACTS, gramsPerServing: 170 };
    expect(convert(1, 'serving', 'g', yoghurt)).toBe(170);
  });

  test('a count converts to volume only when density is also known', () => {
    const withDensity: MeasureFacts = {
      ...NO_FACTS,
      gramsPerPiece: 50,
      densityGPerMl: 1,
    };
    expect(convert(1, 'piece', 'ml', withDensity)).toBe(50);
    expect(
      convert(1, 'piece', 'ml', { ...NO_FACTS, gramsPerPiece: 50 }),
    ).toBeNull();
  });
});

describe('the refusal to guess', () => {
  test('volume to mass without a density returns null, not a number', () => {
    expect(convert(1, 'tbsp', 'g', NO_FACTS)).toBeNull();
    expect(convert(100, 'g', 'ml', NO_FACTS)).toBeNull();
  });

  test('a count without a weight per unit returns null', () => {
    expect(convert(1, 'piece', 'g', NO_FACTS)).toBeNull();
    expect(convert(1, 'slice', 'g', NO_FACTS)).toBeNull();
    expect(convert(1, 'serving', 'g', NO_FACTS)).toBeNull();
    expect(convert(1, 'g', 'piece', NO_FACTS)).toBeNull();
  });

  test('a zero or negative density is treated as unknown', () => {
    expect(convert(1, 'tbsp', 'g', { ...NO_FACTS, densityGPerMl: 0 })).toBeNull();
  });

  test('a non-finite quantity returns null', () => {
    expect(convert(Number.NaN, 'g', 'g', NO_FACTS)).toBeNull();
  });
});

describe('usesPerContainer — decision 73', () => {
  test('a tbsp use and a gram package now reconcile', () => {
    // 500 g at 1.2 g/ml is ~416 ml, which is ~27.8 tbsp of 15 ml.
    const uses = usesPerContainer(GOCHUJANG);
    expect(uses).not.toBeNull();
    expect(uses!).toBeCloseTo(27.8, 1);
  });

  test('a tsp use and a millilitre package reconcile without a density', () => {
    expect(usesPerContainer(SESAME_OIL)).toBeCloseTo(50);
  });

  test('matching units still work', () => {
    const rice: MeasureFacts = {
      ...NO_FACTS,
      typicalUseQty: 75,
      typicalUseUnit: 'g',
      typicalPkgQty: 5000,
      typicalPkgUnit: 'g',
    };
    expect(usesPerContainer(rice)).toBeCloseTo(5000 / 75);
  });

  test('an unconvertible pair still returns null rather than a guess', () => {
    const opaque: MeasureFacts = {
      ...NO_FACTS,
      typicalUseQty: 1,
      typicalUseUnit: 'tbsp',
      typicalPkgQty: 500,
      typicalPkgUnit: 'g',
      // No density: tbsp and g cannot meet.
    };
    expect(usesPerContainer(opaque)).toBeNull();
  });

  test('missing package figures return null', () => {
    expect(usesPerContainer({ ...GOCHUJANG, typicalPkgQty: null })).toBeNull();
    expect(usesPerContainer({ ...GOCHUJANG, typicalUseQty: null })).toBeNull();
  });
});
