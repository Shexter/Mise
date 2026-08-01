import { differenceInCalendarDays } from 'date-fns';

import { localDateString, parseLocalDate } from '@/logic/dates';
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

/** The slice of an item the status math reads. */
export type StatusInputs = Pick<
  PantryItem,
  'status' | 'fullness' | 'qtyRemaining' | 'qtyUnit' | 'usesCount' | 'expiresAt'
>;

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
  canonical: Pick<
    CanonicalItem,
    'foodClass' | 'typicalUseQty' | 'typicalUseUnit' | 'typicalPkgQty' | 'typicalPkgUnit'
  >,
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
 * Typical uses in a container, where package and use figures share a unit.
 * Unit conversion deliberately does not exist here — a mismatch means no
 * estimate, never an invented factor (decision 52).
 */
function usesPerContainer(
  canonical: Pick<
    CanonicalItem,
    'typicalUseQty' | 'typicalUseUnit' | 'typicalPkgQty' | 'typicalPkgUnit'
  >,
): number | null {
  const { typicalUseQty, typicalUseUnit, typicalPkgQty, typicalPkgUnit } =
    canonical;
  if (
    typicalUseQty == null ||
    typicalPkgQty == null ||
    typicalUseQty <= 0 ||
    typicalUseUnit == null ||
    typicalUseUnit !== typicalPkgUnit
  ) {
    return null;
  }
  return typicalPkgQty / typicalUseQty;
}

/** Low-water mark for a staple: max of three uses and 15% of a package. */
function stapleLowThreshold(
  item: Pick<StatusInputs, 'qtyUnit'>,
  canonical: Pick<
    CanonicalItem,
    'typicalUseQty' | 'typicalUseUnit' | 'typicalPkgQty' | 'typicalPkgUnit'
  >,
): number | null {
  const useThreshold =
    canonical.typicalUseQty != null &&
    canonical.typicalUseUnit != null &&
    canonical.typicalUseUnit === item.qtyUnit
      ? LOW_STAPLE_USES * canonical.typicalUseQty
      : null;
  const pkgThreshold =
    canonical.typicalPkgQty != null &&
    canonical.typicalPkgUnit != null &&
    canonical.typicalPkgUnit === item.qtyUnit
      ? LOW_STAPLE_FRACTION * canonical.typicalPkgQty
      : null;

  if (useThreshold === null && pkgThreshold === null) return null;
  return Math.max(useThreshold ?? 0, pkgThreshold ?? 0);
}
