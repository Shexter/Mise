import { describe, expect, test } from 'vitest';

import { canonical } from '@/logic/__fixtures__/kitchens';
import {
  CATALOGUE_NUTRITION_UNAVAILABLE,
  catalogueNutrition,
  hasCatalogueNutrition,
  nutritionSourceLabel,
  nutritionWithPhotoPrecedence,
} from '@/logic/nutrition';

const chicken = canonical({
  id: 'chicken',
  displayName: 'Chicken',
  kcalPer100: 165,
  proteinPer100: 31,
  carbsPer100: null,
  fatPer100: 3.6,
  sources: {
    kcalPer100: 'food-data-central',
    proteinPer100: 'food-data-central',
    fatPer100: 'food-data-central',
  },
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

  test('scales reviewed Dark soy nutrition by mass and density', () => {
    const darkSoy = canonical({
      id: 'soy-sauce-dark',
      displayName: 'Dark soy sauce',
      kcalPer100: 79,
      proteinPer100: 3,
      carbsPer100: 17.9,
      fatPer100: null,
      densityGPerMl: 1.2,
      sources: {
        kcalPer100: 'cofid',
        proteinPer100: 'cofid',
        carbsPer100: 'cofid',
      },
    });

    expect(catalogueNutrition(darkSoy, 100, 'g')).toEqual({
      source: 'cofid',
      values: { calories: 79, proteinG: 3, carbsG: 17.9, fatG: null },
    });
    expect(catalogueNutrition(darkSoy, 100, 'ml')).toEqual({
      source: 'cofid',
      values: { calories: 94.8, proteinG: 3.6, carbsG: 21.48, fatG: null },
    });
    expect(nutritionSourceLabel('cofid')).toMatch(/UK CoFID/);
  });

  test('distinguishes wholly unavailable nutrition from valid partial nutrition', () => {
    const unavailable = canonical({
      id: 'unknown',
      displayName: 'Unknown',
      kcalPer100: null,
      proteinPer100: null,
      carbsPer100: null,
      fatPer100: null,
    });
    expect(hasCatalogueNutrition(unavailable)).toBe(false);
    expect(CATALOGUE_NUTRITION_UNAVAILABLE).toMatch(/Enter the figures manually/);
    expect(hasCatalogueNutrition({ ...unavailable, kcalPer100: 0 })).toBe(true);
  });
});

describe('nutritionWithPhotoPrecedence', () => {
  test('keeps a photo estimate ahead of generic table figures', () => {
    const photo = { calories: 400, proteinG: 20, carbsG: 30, fatG: 12, fibreG: null };
    expect(nutritionWithPhotoPrecedence(photo, chicken, 200, 'g')).toEqual({
      source: 'photo',
      values: photo,
    });
  });
});
