/** Canonical onboarding bounds. UI controls and validation import these values. */
export const AGE_RANGE = { min: 15, max: 99 } as const;
export const HEIGHT_RANGE_CM = { min: 120, max: 230 } as const;
export const WEIGHT_RANGE_KG = { min: 30, max: 300 } as const;
export const BODY_FAT_RANGE = { min: 3, max: 60 } as const;
export const LEAN_TISSUE_RANGE_KG = { min: 15, max: 250 } as const;
export const BONE_MINERAL_CONTENT_RANGE_KG = { min: 0.5, max: 10 } as const;
export const FAT_FREE_MASS_RANGE_KG = { min: 15, max: 250 } as const;
export const BMR_RANGE_KCAL = { min: 500, max: 5_000 } as const;

export const HEIGHT_ANCHOR_CM = 170;
export const WEIGHT_ANCHOR_KG = 70;
export const BODY_FAT_ANCHOR_PCT = { male: 23, female: 28, unavailable: 25 } as const;

export interface NumericRange {
  readonly min: number;
  readonly max: number;
}

export function isWithinRange(value: number, range: NumericRange): boolean {
  return Number.isFinite(value) && value >= range.min && value <= range.max;
}
