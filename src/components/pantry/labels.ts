import type { PantryEntry } from '@/store/pantryStore';
import type { StockStatus } from '@/types';

/**
 * Advisory copy (decisions 15 and 64): words, not numbers, and never a
 * safety verdict — "use soon", never "safe to eat".
 */

export function statusLabel(status: StockStatus): string {
  switch (status) {
    case 'in_stock':
      return 'In stock';
    case 'running_low':
      return 'Running low';
    case 'out':
      return 'Out';
    case 'discarded':
      return 'Discarded';
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
