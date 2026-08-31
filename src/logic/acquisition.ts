import { predictExpiry, type ShelfLife } from '@/logic/expiry';
import type { AcquisitionEvidence, LocationKind } from '@/types';

export type { AcquisitionEvidence } from '@/types';

/**
 * When an item entered the kitchen, and whether that is actually known.
 *
 * `pantry_items.purchased_at` has been `NOT NULL` since the first migration,
 * which was correct for every channel that existed: a receipt has a printed
 * date, a barcode scan happens at the moment of purchase, a manual add is the
 * user typing one in. First-inventory capture breaks that. "I have seven eggs"
 * says nothing about when they were bought, and the fridge is full of food
 * bought at a dozen different times.
 *
 * The tempting fix — write today's date and move on — produces a confident
 * expiry that is wrong by however long the food has already been sitting there,
 * which is exactly the failure decision 15 exists to prevent. Predicting
 * freshness from a date the user never gave is a fabricated number wearing a
 * date's clothes.
 *
 * So the date column keeps holding a real timestamp (the row has to sort, and
 * the depletion ledger anchors on it), and a separate flag records whether that
 * timestamp is *evidence*. When it is not, no expiry is predicted at all —
 * the item is catalogued as present, with an unknown date and an unknown
 * expiry, which is the truth.
 */
export function knownAcquisition(acquiredAt: string): AcquisitionEvidence {
  return { acquiredAt, known: true };
}

/** Stock that was already in the kitchen when Mise first heard about it. */
export function unknownAcquisition(cataloguedOn: string): AcquisitionEvidence {
  return { acquiredAt: cataloguedOn, known: false };
}

/**
 * The predicted expiry, or null when there is no honest basis for one.
 *
 * Wraps `predictExpiry` rather than changing it: the shelf-life lookup is
 * correct and well-tested, and what changes here is whether it is entitled to
 * an input at all.
 *
 * An *opened* date is still the user's own evidence even when the acquisition
 * date is not, so an unknown-acquisition item the user has told us they opened
 * can still carry an opened-life expiry. That is the one case where a
 * prediction survives an unknown purchase date, and it survives because the
 * date it is counted from was supplied by the user.
 */
export function predictExpiryFromAcquisition(
  canonical: ShelfLife,
  kind: LocationKind,
  acquisition: AcquisitionEvidence,
  openedAt: string | null,
): string | null {
  if (acquisition.known) {
    return predictExpiry(canonical, kind, acquisition.acquiredAt, openedAt);
  }
  if (openedAt != null && canonical.openLifeDays != null) {
    // Only the opened branch, and only from the user's own date. Passing the
    // unknown acquisition date as the purchase date would let the unopened
    // prediction come back through the `min` inside `predictExpiry`.
    return predictExpiry(
      { shelfLifeDays: {}, openLifeDays: canonical.openLifeDays },
      kind,
      acquisition.acquiredAt,
      openedAt,
    );
  }
  return null;
}

/**
 * Whether an expiry recompute may run for this item at all. A location change
 * on an unknown-acquisition item must not manufacture the date that the insert
 * refused to manufacture.
 */
export function canPredictFrom(acquisition: AcquisitionEvidence): boolean {
  return acquisition.known;
}

/** What the pantry says instead of a date it does not have. */
export const UNKNOWN_ACQUISITION_LABEL = 'Added date unknown';
export const UNKNOWN_EXPIRY_LABEL = 'No expiry estimate — tell Mise when you got it';
