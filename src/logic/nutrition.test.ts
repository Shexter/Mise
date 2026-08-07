import { describe, expect, test } from 'vitest';

import { canonical } from '@/logic/__fixtures__/kitchens';
import {
  catalogueNutrition,
  nutritionWithPhotoPrecedence,
} from '@/logic/nutrition';

const chicken = canonical({
  id: 'chicken',
  displayName: 'Chicken',
  kcalPer100: 165,
  proteinPer100: 31,
  carbsPer100: null,
  fatPer100: 3.6,
});

describe('catalogueNutrition', () => {
  test('scales per-100 g figures and preserves missing nutrients as null', () => {
    expect(catalogueNutrition(chicken, 200, 'g')).toEqual({
      source: 'food-data-central',
      values: {
        calories: 330,
        proteinG: 62,
        carbsG: null,
        fatG: 7.2,
      },
    });
  });

  test('converts volume only when the ingredient has a density', () => {
    expect(
      catalogueNutrition({ ...chicken, densityGPerMl: 0.5 }, 100, 'ml')?.values.calories,
    ).toBe(82.5);
    expect(catalogueNutrition(chicken, 100, 'ml')).toBeNull();
  });

  test('returns null when a count unit has no known mass conversion', () => {
    expect(catalogueNutrition(chicken, 1, 'serving')).toBeNull();
  });
});

describe('nutritionWithPhotoPrecedence', () => {
  test('keeps a photo estimate ahead of generic table figures', () => {
    const photo = { calories: 400, proteinG: 20, carbsG: 30, fatG: 12 };
    expect(nutritionWithPhotoPrecedence(photo, chicken, 200, 'g')).toEqual({
      source: 'photo',
      values: photo,
    });
  });
});
