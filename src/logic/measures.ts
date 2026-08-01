import type { CanonicalItem, MeasureUnit } from '@/types';

/**
 * Food measure conversion. Pure, and deliberately *not* `src/logic/units.ts`
 * — that module holds body measurements (`cmToFeetInches`, `kgToLb`) and
 * shares nothing with food measures but the word.
 *
 * The whole point of this module is the return type. `convert` returns
 * `number | null`, and `null` means "I cannot know" — never a fallback
 * factor. A function returning a bare number has no way to express
 * uncertainty, and the tempting defaults (assume 1 g/ml, assume a 100 g
 * piece) produce confident nonsense in exactly the place decision 15
 * forbids it. Making the absence of knowledge a value the type system
 * forces callers to handle is what stops a guess being added later for
 * convenience (decision 52).
 */

/** Fixed volume equivalents, in millilitres. Universal, not per-ingredient. */
export const ML_PER: Readonly<Partial<Record<MeasureUnit, number>>> = {
  ml: 1,
  tbsp: 15,
  tsp: 5,
  cup: 240,
};

const MASS_UNITS: readonly MeasureUnit[] = ['g'];

/** The per-ingredient factors a conversion may need. */
export type MeasureFacts = Pick<
  CanonicalItem,
  'densityGPerMl' | 'typicalUseQty' | 'typicalUseUnit'
> &
  Partial<Pick<CanonicalItem, 'typicalPkgQty' | 'typicalPkgUnit'>> & {
    /** Grams in one piece, where known. */
    gramsPerPiece?: number | null;
    /** Grams in one slice, where known. */
    gramsPerSlice?: number | null;
    /** Grams in one serving, where known. */
    gramsPerServing?: number | null;
  };

function isVolume(unit: MeasureUnit): boolean {
  return ML_PER[unit] !== undefined;
}

function isMass(unit: MeasureUnit): boolean {
  return MASS_UNITS.includes(unit);
}

/** Grams in one unit of a countable measure, or null when unknown. */
function gramsPerCount(
  unit: MeasureUnit,
  facts: MeasureFacts,
): number | null {
  switch (unit) {
    case 'piece':
      return facts.gramsPerPiece ?? null;
    case 'slice':
      return facts.gramsPerSlice ?? null;
    case 'serving':
      return facts.gramsPerServing ?? null;
    default:
      return null;
  }
}

/**
 * Converts `qty` from one measure to another for a specific ingredient.
 *
 * Returns null whenever a required factor is absent — a volume-to-mass
 * conversion without a density, or a count-to-anything conversion without a
 * weight per piece. Callers fall back to counting a use rather than
 * changing a remaining amount.
 */
export function convert(
  qty: number,
  from: MeasureUnit,
  to: MeasureUnit,
  facts: MeasureFacts,
): number | null {
  if (!Number.isFinite(qty)) return null;
  if (from === to) return qty;

  // Volume to volume: fixed, ingredient-independent.
  const fromMl = ML_PER[from];
  const toMl = ML_PER[to];
  if (fromMl !== undefined && toMl !== undefined) {
    return (qty * fromMl) / toMl;
  }

  const density = facts.densityGPerMl;

  // Volume to mass, and back. Needs the ingredient's density.
  if (isVolume(from) && isMass(to)) {
    if (density == null || density <= 0) return null;
    return qty * fromMl! * density;
  }
  if (isMass(from) && isVolume(to)) {
    if (density == null || density <= 0) return null;
    return qty / density / toMl!;
  }

  // Counts convert only through a known weight per unit.
  const fromGrams = gramsPerCount(from, facts);
  if (fromGrams != null && fromGrams > 0) {
    const grams = qty * fromGrams;
    if (isMass(to)) return grams;
    if (isVolume(to)) {
      if (density == null || density <= 0) return null;
      return grams / density / toMl!;
    }
    const toGrams = gramsPerCount(to, facts);
    return toGrams != null && toGrams > 0 ? grams / toGrams : null;
  }

  return null;
}

/**
 * How many typical uses a typical package holds, or null when the two
 * cannot be reconciled.
 *
 * This is what closes decision 73. Requiring `typicalUseUnit` to *equal*
 * `typicalPkgUnit` was correct in refusing to invent a factor, but measured
 * against the seed set 0 of 29 uses-tracked canonicals satisfied it: a use
 * is naturally a tablespoon and a package is naturally 500 ml or 500 g, so
 * the two never met and the uses model never fired. Converting between them
 * — with the same refusal to guess — is the missing piece rather than
 * forcing the data to match.
 */
export function usesPerContainer(facts: MeasureFacts): number | null {
  const { typicalUseQty, typicalUseUnit, typicalPkgQty, typicalPkgUnit } = facts;
  if (
    typicalUseQty == null ||
    typicalUseQty <= 0 ||
    typicalUseUnit == null ||
    typicalPkgQty == null ||
    typicalPkgQty <= 0 ||
    typicalPkgUnit == null
  ) {
    return null;
  }

  const packageInUseUnits = convert(
    typicalPkgQty,
    typicalPkgUnit,
    typicalUseUnit,
    facts,
  );
  if (packageInUseUnits == null) return null;
  return packageInUseUnits / typicalUseQty;
}
