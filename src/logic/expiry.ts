import { addDays } from 'date-fns';

import { localDateString, parseLocalDate } from '@/logic/dates';
import type {
  CanonicalItem,
  ExpirySource,
  LocationKind,
  StorageLocation,
} from '@/types';

/**
 * Predicted expiry (decision 19): a lookup, not a model. Purchase or opening
 * date plus the canonical ingredient's shelf life for where the item lives.
 * Pure — no database, no network. All dates are local date strings
 * (`yyyy-MM-dd`), matching the day-boundary convention in `dates.ts`.
 */

/** The slice of a canonical ingredient the expiry math reads. */
export type ShelfLife = Pick<CanonicalItem, 'shelfLifeDays' | 'openLifeDays'>;

/**
 * Maps a location's closed `kind` onto the shelf-life table's location keys.
 * `ambient` is the seed data's `pantry` column; the other kinds match by
 * name. This is the seam that lets a "Chest freezer" behave as a freezer
 * without the lookup knowing its name.
 */
export function shelfLifeKey(kind: LocationKind): StorageLocation {
  return kind === 'ambient' ? 'pantry' : kind;
}

function plusDays(localDate: string, days: number): string {
  return localDateString(addDays(parseLocalDate(localDate), days));
}

/**
 * The predicted expiry for an item, or null where the ingredient has no
 * shelf-life figure for that location kind and no applicable opened life —
 * no data means no claim, not a guess.
 *
 * The opened case takes the *earlier* of the unopened prediction and
 * opening date plus opened life. Opening a tin of tomatoes with two years
 * left gives it days; opening a bag of rice with a month left does not
 * extend it to a year.
 */
export function predictExpiry(
  canonical: ShelfLife,
  kind: LocationKind,
  purchasedAt: string,
  openedAt: string | null,
): string | null {
  const baseDays = canonical.shelfLifeDays[shelfLifeKey(kind)];
  const unopened = baseDays != null ? plusDays(purchasedAt, baseDays) : null;

  if (openedAt != null && canonical.openLifeDays != null) {
    const opened = plusDays(openedAt, canonical.openLifeDays);
    if (unopened === null) return opened;
    return opened < unopened ? opened : unopened;
  }
  return unopened;
}

/**
 * The freeze action (decision 20): expiry recounted from the freezer shelf
 * life as of the freeze date. Null where the ingredient carries no freezer
 * figure — which is also what makes it not freezable.
 */
export function freezeExpiry(
  canonical: ShelfLife,
  frozenAt: string,
): string | null {
  const days = canonical.shelfLifeDays['freezer'];
  return days != null ? plusDays(frozenAt, days) : null;
}

/** Freezing is offered only where the shelf-life table has a freezer entry. */
export function isFreezable(canonical: ShelfLife): boolean {
  return canonical.shelfLifeDays['freezer'] != null;
}

/**
 * Whether a recompute may overwrite the stored date. A date the user
 * entered or read off a label always wins over a prediction.
 */
export function canRecomputeExpiry(source: ExpirySource | null): boolean {
  return source !== 'user' && source !== 'label';
}
