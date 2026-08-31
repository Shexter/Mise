import type { MeasureUnit, StatedQuantity } from '@/types';

export type { StatedQuantity } from '@/types';

/**
 * How a stated quantity becomes pantry rows.
 *
 * The rule the pantry has always had is "one row is one physical container"
 * — three tins are three rows. Speech is the first channel that can state a
 * count *without* stating a container, and the two readings of "three carrots"
 * pull in opposite directions:
 *
 *   - three rows, because there are three carrots; or
 *   - one row holding three pieces, because there is one bag of carrots in the
 *     fridge drawer and the user will not be tracking them individually.
 *
 * This module answers it once, for every channel, because the answer must not
 * differ between a receipt line reading "CARROTS 3" and someone saying "three
 * carrots". Receipt, barcode, manual, and voice all call this.
 *
 * **The answer: a container makes a row; a loose count makes an amount.**
 *
 * "Two cans of tomatoes" names a container, so it is two rows. "Three carrots"
 * names no container, so it is one row whose remaining quantity is 3 pieces.
 * The test that separates them is whether the user said a container word, not
 * whether the food happens to come in packaging — because the user's words are
 * the evidence, and inferring "carrots come in bags" is the kind of guess
 * decision 15 forbids.
 *
 * The practical consequence is the one that matters: opening, freezing, and
 * expiring act on a container. Three separate carrot rows would ask the user to
 * open a carrot, and a "half used" carrot bag cannot be expressed as three
 * independent rows at all.
 */

export const UNKNOWN_QUANTITY: StatedQuantity = {
  containerCount: null,
  amount: null,
  unit: null,
  approximate: false,
};

/** One pantry row to create. */
export interface MaterialisedRow {
  /**
   * The quantity to store on the row, or null to store nothing. Null is the
   * correct outcome for an unknown or approximate amount: the pantry may hold
   * a figure only when the user stated one exactly.
   */
  qtyRemaining: number | null;
  qtyUnit: MeasureUnit | null;
}

/** The most rows one spoken phrase may create, so a misheard number cannot
 * flood the pantry. Anything above it is held for review instead. */
export const MAX_ROWS_PER_PROPOSAL = 24;

export interface MaterialisationPlan {
  rows: MaterialisedRow[];
  /**
   * Set when the stated quantity cannot be turned into rows without a
   * decision the user has to make. `rows` is empty and nothing may be written.
   */
  blocked: 'too_many_containers' | null;
}

/**
 * Turns one stated quantity into the rows it should create.
 *
 * Note what does *not* happen here: no unit conversion, no package-size lookup,
 * and no default amount. An approximate amount is deliberately dropped rather
 * than rounded into `qty_remaining`, because `qty_remaining` is a number the UI
 * is allowed to show back to the user and "about half a carton" is not one.
 * The approximation survives in the proposal's own evidence and in `fullness`,
 * which is the field built for exactly this kind of claim.
 */
export function materialise(quantity: StatedQuantity): MaterialisationPlan {
  const containers = quantity.containerCount;

  if (containers != null) {
    if (!Number.isInteger(containers) || containers < 1) {
      return { rows: [], blocked: null };
    }
    if (containers > MAX_ROWS_PER_PROPOSAL) {
      return { rows: [], blocked: 'too_many_containers' };
    }
    const perContainer = storableAmount(quantity);
    return {
      rows: Array.from({ length: containers }, () => ({ ...perContainer })),
      blocked: null,
    };
  }

  // No container named: one row, carrying the loose count as its amount.
  return { rows: [storableAmount(quantity)], blocked: null };
}

/**
 * The part of a stated quantity the pantry may store as a number.
 *
 * An approximate amount stores nothing. This is the whole reason the function
 * exists separately: it is the single place where "the user hedged" turns into
 * "the database holds no figure", and inlining it would let one caller quietly
 * keep the number.
 */
function storableAmount(quantity: StatedQuantity): MaterialisedRow {
  if (quantity.approximate) return { qtyRemaining: null, qtyUnit: null };
  if (quantity.amount == null || quantity.unit == null) {
    return { qtyRemaining: null, qtyUnit: null };
  }
  return { qtyRemaining: quantity.amount, qtyUnit: quantity.unit };
}

/** How many rows a stated quantity will create, for review copy. */
export function rowCount(quantity: StatedQuantity): number {
  return materialise(quantity).rows.length;
}
