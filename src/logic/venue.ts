import type { MealVenue, VenueAssessment } from '@/types';

/** Provisional until measured against real meals; kept named so it can be
 * changed without altering the decision interface. */
export const STOCK_MATCH_THRESHOLD = 0.75;

function stockSignal(stockMatch: number | null): MealVenue | null {
  if (stockMatch === null) return null;
  if (stockMatch >= STOCK_MATCH_THRESHOLD) return 'home';
  if (stockMatch === 0) return 'out';
  return null;
}

/**
 * Combines independent signals without silently laundering disagreement into
 * confidence. One signal can choose a venue; agreeing signals reinforce it;
 * any conflict resolves to home because a missed pantry decrement is the more
 * damaging error. A learned default is deliberately one peer signal, never an
 * override.
 */
export function inferVenue(
  assessment: VenueAssessment | null,
  stockMatch: number | null,
  outstandingPortions: number,
  learnedDefault: MealVenue | null = null,
): MealVenue {
  const signals: MealVenue[] = [];
  if (assessment) signals.push(assessment);
  const stock = stockSignal(stockMatch);
  if (stock) signals.push(stock);
  if (outstandingPortions > 0) signals.push('leftovers');
  if (learnedDefault) signals.push(learnedDefault);

  if (signals.length === 0) return 'home';
  return signals.every((signal) => signal === signals[0]) ? signals[0]! : 'home';
}
