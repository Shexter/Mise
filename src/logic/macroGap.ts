import { daysUntil } from '@/logic/stockStatus';
import type { CanonicalItem, DailyTarget, Macros, PantryItem } from '@/types';

export type MacroGapTarget =
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'fibre'
  | 'vitaminC'
  | 'iron'
  | 'vitaminB12'
  | 'calcium'
  | 'folate'
  | 'vitaminA'
  | 'potassium';

export interface MacroContributor {
  item: PantryItem;
  canonical: CanonicalItem;
  contributionG: number;
  daysLeft: number | null;
}

export interface MacroGapAssessment {
  target: MacroGapTarget;
  contributors: MacroContributor[];
  bestAchievableG: number;
  hasMeasuredCoverage: boolean;
  /** Some in-stock food cannot be measured for this macro from current data. */
  hasUnmeasuredStock: boolean;
}

/**
 * Returns null when the day's target macro is unknown, never a guessed gap.
 * Only the four original macros have a daily target/consumed figure to
 * compare — the seven micronutrients `add-micronutrient-tracking` added to
 * the catalogue have no Today-screen target (explicit non-goal of
 * `add-nutrient-directed-search`), so there is nothing to derive a
 * shortfall from for them; they always return null here, same as any other
 * "unknown" case this function already returns null for.
 */
export function macroShortfall(
  target: Pick<DailyTarget, 'proteinG' | 'carbsG' | 'fatG' | 'fibreG'>,
  consumed: Pick<Macros, 'proteinG' | 'carbsG' | 'fatG' | 'fibreG'>,
  macro: MacroGapTarget,
): number | null {
  switch (macro) {
    case 'protein': return consumed.proteinG === null ? null : Math.max(0, target.proteinG - consumed.proteinG);
    case 'carbs': return consumed.carbsG === null ? null : Math.max(0, target.carbsG - consumed.carbsG);
    case 'fat': return consumed.fatG === null ? null : Math.max(0, target.fatG - consumed.fatG);
    case 'fibre': return consumed.fibreG === null ? null : Math.max(0, target.fibreG - consumed.fibreG);
    case 'vitaminC':
    case 'iron':
    case 'vitaminB12':
    case 'calcium':
    case 'folate':
    case 'vitaminA':
    case 'potassium':
      return null;
  }
}

function per100(canonical: CanonicalItem, target: MacroGapTarget): number | null {
  switch (target) {
    case 'protein': return canonical.proteinPer100;
    case 'carbs': return canonical.carbsPer100;
    case 'fat': return canonical.fatPer100;
    case 'fibre': return canonical.fibrePer100;
    case 'vitaminC': return canonical.vitaminCMgPer100;
    case 'iron': return canonical.ironMgPer100;
    case 'vitaminB12': return canonical.vitaminB12McgPer100;
    case 'calcium': return canonical.calciumMgPer100;
    case 'folate': return canonical.folateMcgPer100;
    case 'vitaminA': return canonical.vitaminAMcgPer100;
    case 'potassium': return canonical.potassiumMgPer100;
  }
}

/** A mass we can defend from the recorded pantry quantity, otherwise null. */
function availableGrams(item: PantryItem, canonical: CanonicalItem): number | null {
  if (item.qtyRemaining === null) return null;
  if (item.qtyUnit === 'g') return item.qtyRemaining;
  if (item.qtyUnit === 'ml' && canonical.densityGPerMl !== null) {
    return item.qtyRemaining * canonical.densityGPerMl;
  }
  return null;
}

/**
 * Assesses only measurable pantry contribution. Unknown nutrition and unknown
 * mass remain absent rather than becoming a misleading zero-contribution row.
 */
export function assessMacroGap(
  items: readonly PantryItem[],
  canonicals: ReadonlyMap<string, CanonicalItem>,
  target: MacroGapTarget,
  today?: string,
): MacroGapAssessment {
  const contributors: MacroContributor[] = [];
  let hasUnmeasuredStock = false;
  for (const item of items) {
    if (item.status !== 'in_stock') continue;
    const canonical = canonicals.get(item.canonicalId);
    if (!canonical) {
      hasUnmeasuredStock = true;
      continue;
    }
    const macroPer100 = per100(canonical, target);
    const grams = availableGrams(item, canonical);
    if (macroPer100 === null || grams === null) {
      hasUnmeasuredStock = true;
      continue;
    }
    const contributionG = Math.max(0, (grams / 100) * macroPer100);
    if (contributionG <= 0) continue;
    contributors.push({ item, canonical, contributionG, daysLeft: daysUntil(item.expiresAt, today) });
  }

  contributors.sort((left, right) => {
    // A ten-percent band treats practically equivalent contributions as a tie;
    // expiry never lets a materially weaker contributor leap ahead.
    const comparable = Math.abs(left.contributionG - right.contributionG)
      <= Math.max(left.contributionG, right.contributionG) * 0.1;
    if (!comparable) return right.contributionG - left.contributionG;
    return (left.daysLeft ?? Infinity) - (right.daysLeft ?? Infinity);
  });

  return {
    target,
    contributors,
    bestAchievableG: contributors.reduce((total, item) => total + item.contributionG, 0),
    hasMeasuredCoverage: contributors.length > 0,
    hasUnmeasuredStock,
  };
}
