import { convert } from '@/logic/measures';
import type { CanonicalItem, Macros, MeasureUnit } from '@/types';

export interface NullableMacros {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export interface NutritionResult {
  values: NullableMacros;
  source: 'photo' | 'food-data-central';
}

function scaled(value: number | null, grams: number): number | null {
  if (value == null) return null;
  return Math.round(value * grams) / 100;
}

/**
 * Generic table nutrition for a measured ingredient. Unknown conversion or
 * nutrient values stay null; no missing figure is ever laundered into zero.
 */
export function catalogueNutrition(
  canonical: CanonicalItem,
  quantity: number,
  unit: MeasureUnit,
): NutritionResult | null {
  const grams = convert(quantity, unit, 'g', canonical);
  if (grams == null || grams < 0) return null;
  const values: NullableMacros = {
    calories: scaled(canonical.kcalPer100, grams),
    proteinG: scaled(canonical.proteinPer100, grams),
    carbsG: scaled(canonical.carbsPer100, grams),
    fatG: scaled(canonical.fatPer100, grams),
  };
  if (Object.values(values).every((value) => value == null)) return null;
  return { values, source: 'food-data-central' };
}

/** A photograph describes the actual prepared food and always outranks a table. */
export function nutritionWithPhotoPrecedence(
  photoEstimate: Macros | null,
  canonical: CanonicalItem,
  quantity: number,
  unit: MeasureUnit,
): NutritionResult | null {
  if (photoEstimate) {
    return { values: photoEstimate, source: 'photo' };
  }
  return catalogueNutrition(canonical, quantity, unit);
}
