import type { PantryEntry } from '@/store/pantryStore';
import type { StockStatus } from '@/types';

/**
 * Advisory copy (decisions 15 and 64): words, not numbers, and never a
 * safety verdict — "use soon", never "safe to eat".
 */

/**
 * Status wording, qualified when the app has drifted past what it can
 * defend (decision 53). "Probably low" and "Running low" are different
 * claims and must not read identically — that difference is the whole
 * point of tracking drift.
 */
export function statusLabel(status: StockStatus, confident = true): string {
  switch (status) {
    case 'in_stock':
      return confident ? 'In stock' : 'Probably still have some';
    case 'running_low':
      return confident ? 'Running low' : 'Probably low';
    case 'out':
      return confident ? 'Out' : 'Probably out';
    case 'discarded':
      return 'Discarded';
    case 'replaced':
      return 'Replaced';
  }
}

export function expiryLabel(
  entry: Pick<PantryEntry, 'daysLeft' | 'expiryIsPredicted'>,
): string {
  const { daysLeft } = entry;
  if (daysLeft === null) return 'No date';
  const suffix = entry.expiryIsPredicted ? ' (est.)' : '';
  if (daysLeft < 0) return `Past its date${suffix}`;
  if (daysLeft === 0) return `Use today${suffix}`;
  if (daysLeft === 1) return `Use by tomorrow${suffix}`;
  return `${daysLeft} days left${suffix}`;
}
