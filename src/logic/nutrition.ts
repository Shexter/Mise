import { convert } from '@/logic/measures';
import type { CanonicalItem, Macros, MeasureUnit, Product, SourceId } from '@/types';

export const CATALOGUE_NUTRITION_UNAVAILABLE =
  'Catalogue nutrition is unavailable for this ingredient. Enter the figures manually.';

export interface NullableMacros {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fibreG?: number | null;
}

export interface NutritionResult {
  values: NullableMacros;
  source: 'photo' | SourceId;
}

export type FibreSource = 'product' | SourceId | 'text-fallback';

export interface FibreResult {
  value: number | null;
  source: FibreSource | null;
  confidence: 'structured' | 'fallback' | 'unknown';
}

export function hasCatalogueNutrition(canonical: CanonicalItem): boolean {
  return [
    canonical.kcalPer100,
    canonical.proteinPer100,
    canonical.carbsPer100,
    canonical.fatPer100,
  ].some((value) => value != null);
}

export function nutritionSourceLabel(source: NutritionResult['source']): string {
  switch (source) {
    case 'food-data-central':
      return 'Nutrition from USDA FoodData Central.';
    case 'cofid':
      return 'Nutrition from the UK CoFID dataset.';
    case 'photo':
      return 'Nutrition estimated from your photo.';
    default:
      return 'Nutrition from the ingredient catalogue.';
  }
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
    ...(canonical.fibrePer100 == null ? {} : { fibreG: scaled(canonical.fibrePer100, grams) }),
  };
  if (Object.values(values).every((value) => value == null)) return null;
  const source = canonical.sources.kcalPer100 ??
    canonical.sources.proteinPer100 ??
    canonical.sources.carbsPer100 ??
    canonical.sources.fatPer100 ??
    'hand-authored';
  return { values, source };
}

/** Derives fibre after identity resolution; image output is deliberately ignored. */
export function deriveResolvedFibre(
  product: Product | null,
  canonical: CanonicalItem | null,
  quantity: number,
  unit: MeasureUnit,
  textFallback?: (name: string, quantity: number, unit: MeasureUnit) => number | null,
): FibreResult {
  if (product?.fibrePer100 != null) {
    const grams = canonical ? convert(quantity, unit, 'g', canonical) : unit === 'g' ? quantity : null;
    if (grams != null) return { value: scaled(product.fibrePer100, grams), source: 'product', confidence: 'structured' };
  }
  if (canonical?.fibrePer100 != null) {
    const grams = convert(quantity, unit, 'g', canonical);
    if (grams != null) {
      const source = canonical.sources.fibrePer100 ?? 'hand-authored';
      return { value: scaled(canonical.fibrePer100, grams), source, confidence: 'structured' };
    }
  }
  const fallback = textFallback?.(product?.name ?? canonical?.displayName ?? '', quantity, unit)
    ?? localFibreFallback(product?.name ?? canonical?.displayName ?? '', quantity, unit, canonical);
  return fallback == null
    ? { value: null, source: null, confidence: 'unknown' }
    : { value: Math.max(0, fallback), source: 'text-fallback', confidence: 'fallback' };
}

/** Small offline fallback for common produce; it is intentionally conservative. */
function localFibreFallback(name: string, quantity: number, unit: MeasureUnit, canonical: CanonicalItem | null): number | null {
  const grams = canonical ? convert(quantity, unit, 'g', canonical) : unit === 'g' ? quantity : null;
  if (grams == null) return null;
  const lower = name.toLowerCase();
  const per100 = lower.includes('green') || lower.includes('spinach') || lower.includes('lettuce')
    ? 2.2
    : lower.includes('broccoli') ? 2.6
    : lower.includes('oat') ? 10.1
    : lower.includes('potato') ? 2.2
    : null;
  return per100 == null ? null : Math.round(per100 * grams) / 100;
}

function productAsFacts(product: Product) {
  return { densityGPerMl: null, typicalUseQty: product.pkgQty, typicalUseUnit: product.pkgUnit };
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
