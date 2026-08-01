import { differenceInCalendarDays } from 'date-fns';

import { localDateString, parseLocalDate } from '@/logic/dates';
import { convert, usesPerContainer } from '@/logic/measures';
import type { CanonicalItem, FoodClass, Fullness, PantryItem, StockStatus } from '@/types';

/**
 * Advisory stock status (decision 15): derived per food class, never shown
 * as a number. Pure — screens receive the result of this function, not the
 * quantities that fed it.
 *
 * The thresholds are guesses until real usage exists, exactly like the match
 * thresholds (decision 32) — named here so tuning is one edit.
 */

/** A staple is low below three typical uses' worth… */
export const LOW_STAPLE_USES = 3;
/** …or below 15% of a typical package, whichever is larger. */
export const LOW_STAPLE_FRACTION = 0.15;
/** A uses-tracked item is low after 75% of a typical container's uses. */
export const LOW_SEASONING_FRACTION = 0.75;
/** Perishables within this many days of expiry read as "use soon". */
export const EXPIRING_SOON_DAYS = 3;
/**
 * Estimated decrements an item may accumulate before the app stops
 * asserting and starts qualifying (decision 53). A guess, like the others —
 * tuning it changes no interface and no schema.
 */
export const DRIFT_LIMIT = 8;

/** The slice of a canonical the status math reads. */
export type StatusCanonical = Pick<
  CanonicalItem,
  | 'foodClass'
  | 'typicalUseQty'
  | 'typicalUseUnit'
  | 'typicalPkgQty'
  | 'typicalPkgUnit'
  | 'densityGPerMl'
>;

/** The slice of an item the status math reads. */
export type StatusInputs = Pick<
  PantryItem,
  'status' | 'fullness' | 'qtyRemaining' | 'qtyUnit' | 'usesCount' | 'expiresAt'
> &
  Partial<Pick<PantryItem, 'estimatedDecrementsSinceAnchor'>>;

/**
 * A status plus how much to trust it.
 *
 * `confident` is false once an item has drifted past `DRIFT_LIMIT`
 * estimated decrements without a ground-truth anchor. "Running low" after
 * two estimated decrements and after twenty are different claims, and the
 * interface must not state them identically — which is what makes
 * decision 15 honest rather than aspirational.
 */
export interface StatusResult {
  status: StockStatus;
  confident: boolean;
  /** True when the app should ask for a fullness check, on suspicion only. */
  suggestFullnessCheck: boolean;
}

/** Classes whose depletion is counted in uses, not mass (decision 12). */
const USES_TRACKED: readonly FoodClass[] = ['seasoning', 'condiment'];

/** Classes whose status follows the calendar, not a quantity. */
const PERISHABLE: readonly FoodClass[] = [
  'produce',
  'protein',
  'dairy',
  'frozen',
  'beverage',
];

/** Days until a date; negative when past. Null when there is no date. */
export function daysUntil(
  expiresAt: string | null,
  today: string = localDateString(),
): number | null {
  if (!expiresAt) return null;
  return differenceInCalendarDays(
    parseLocalDate(expiresAt),
    parseLocalDate(today),
  );
}

function fullnessStatus(fullness: Fullness): StockStatus {
  if (fullness === 'out') return 'out';
  if (fullness === 'low') return 'running_low';
  return 'in_stock';
}

/**
 * Derives an item's advisory status.
 *
 * Precedence: an explicit user action stored on the row (`out`,
 * `discarded`, `running_low`) is authoritative; then a fullness the user
 * set (decision 14 — it overrides any estimate); then the per-class signal:
 * remaining mass for staples, accumulated uses for seasonings and
 * condiments, expiry proximity for perishables. Where the data cannot
 * support a claim — missing quantities, mismatched units, no date — the
 * answer is `in_stock`, not a guess (decision 52's rule applied to status).
 */
export function stockStatus(
  item: StatusInputs,
  canonical: StatusCanonical,
  today: string = localDateString(),
): StockStatus {
  if (item.status !== 'in_stock') return item.status;

  if (USES_TRACKED.includes(canonical.foodClass)) {
    if (item.fullness) return fullnessStatus(item.fullness);
    const perContainer = usesPerContainer(canonical);
    if (
      perContainer !== null &&
      item.usesCount >= LOW_SEASONING_FRACTION * perContainer
    ) {
      return 'running_low';
    }
    return 'in_stock';
  }

  if (canonical.foodClass === 'staple') {
    const threshold = stapleLowThreshold(item, canonical);
    if (item.qtyRemaining !== null && threshold !== null) {
      if (item.qtyRemaining <= 0) return 'out';
      if (item.qtyRemaining < threshold) return 'running_low';
    }
    return 'in_stock';
  }

  if (PERISHABLE.includes(canonical.foodClass)) {
    const days = daysUntil(item.expiresAt, today);
    if (days !== null && days <= EXPIRING_SOON_DAYS) return 'running_low';
  }

  return 'in_stock';
}

/**
 * Low-water mark for a staple: the larger of three typical uses and 15% of
 * a typical package, expressed in the unit the item is stocked in.
 *
 * Both figures now route through `convert`, so a use in tbsp against a
 * stock figure in grams reconciles when the ingredient carries a density —
 * and still returns null when it does not. The refusal to guess is intact;
 * what changed is that it no longer fires on every mismatched pair
 * (decision 73).
 */
function stapleLowThreshold(
  item: Pick<StatusInputs, 'qtyUnit'>,
  canonical: StatusCanonical,
): number | null {
  if (item.qtyUnit == null) return null;

  const useInStockUnit =
    canonical.typicalUseQty != null && canonical.typicalUseUnit != null
      ? convert(
          canonical.typicalUseQty,
          canonical.typicalUseUnit,
          item.qtyUnit,
          canonical,
        )
      : null;
  const pkgInStockUnit =
    canonical.typicalPkgQty != null && canonical.typicalPkgUnit != null
      ? convert(
          canonical.typicalPkgQty,
          canonical.typicalPkgUnit,
          item.qtyUnit,
          canonical,
        )
      : null;

  const useThreshold =
    useInStockUnit != null ? LOW_STAPLE_USES * useInStockUnit : null;
  const pkgThreshold =
    pkgInStockUnit != null ? LOW_STAPLE_FRACTION * pkgInStockUnit : null;

  if (useThreshold === null && pkgThreshold === null) return null;
  return Math.max(useThreshold ?? 0, pkgThreshold ?? 0);
}

/**
 * The status an item should be shown with, and whether the app has earned
 * the right to assert it.
 *
 * A fullness check is offered only when the item is both drifted and
 * already looking low — the one moment the question is worth asking. Never
 * on a schedule, which is nagging.
 */
export function stockStatusWithConfidence(
  item: StatusInputs,
  canonical: StatusCanonical,
  today: string = localDateString(),
): StatusResult {
  const status = stockStatus(item, canonical, today);
  const drift = item.estimatedDecrementsSinceAnchor ?? 0;
  // An explicit user action is ground truth regardless of drift.
  const userSet = item.fullness !== null || item.status !== 'in_stock';
  const confident = userSet || drift <= DRIFT_LIMIT;
  return {
    status,
    confident,
    suggestFullnessCheck:
      !confident && (status === 'running_low' || status === 'out'),
  };
}
