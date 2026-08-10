import { HIDDEN_INGREDIENTS } from '@/constants/hiddenIngredients';
import {
  getDishVenueDefault,
  listPantryItems,
  outstandingPortionsForDish,
} from '@/db/queries';
import { resolveIngredientReferencesLocally } from '@/logic/resolution';
import { inferVenue } from '@/logic/venue';
import type { MealVenue, VenueAssessment } from '@/types';

export interface VenueDraftItem {
  name: string;
  canonicalId?: string | null;
}

/** Ratio of all draft items that resolve to a canonical currently owned. A
 * completely unresolved draft returns null rather than pretending it matched
 * zero stock. */
export async function stockMatchForDraft(
  items: readonly VenueDraftItem[],
): Promise<number | null> {
  if (items.length === 0) return null;
  const quickPickByName = new Map(
    HIDDEN_INGREDIENTS.filter((entry) => entry.canonicalId).map((entry) => [
      entry.name.toLowerCase(),
      entry.canonicalId as string,
    ]),
  );
  const canonicalIds: (string | null)[] = items.map(
    (item) => item.canonicalId ?? quickPickByName.get(item.name.toLowerCase()) ?? null,
  );
  const unresolved = items
    .map((item, index) => ({ item, index }))
    .filter(({ index }) => canonicalIds[index] === null);

  if (unresolved.length > 0) {
    const outcomes = await resolveIngredientReferencesLocally(
      unresolved.map(({ item }) => ({ raw: item.name })),
      'meal_log',
    );
    for (const [position, entry] of unresolved.entries()) {
      const outcome = outcomes[position];
      if (
        outcome?.status === 'resolved' ||
        outcome?.status === 'needs_confirmation'
      ) {
        canonicalIds[entry.index] = outcome.canonicalId;
      }
    }
  }

  const resolved = canonicalIds.filter((id): id is string => id !== null);
  if (resolved.length === 0) return null;
  const inStock = new Set(
    (await listPantryItems())
      .filter((item) => item.status === 'in_stock' || item.status === 'running_low')
      .map((item) => item.canonicalId),
  );
  const matches = canonicalIds.filter((id) => id !== null && inStock.has(id)).length;
  return matches / items.length;
}

export async function inferVenueForDraft(
  mealName: string,
  items: readonly VenueDraftItem[],
  assessment: VenueAssessment | null,
): Promise<MealVenue> {
  const [stockMatch, outstandingPortions, learnedDefault] = await Promise.all([
    stockMatchForDraft(items),
    outstandingPortionsForDish(mealName),
    getDishVenueDefault(mealName),
  ]);
  return inferVenue(assessment, stockMatch, outstandingPortions, learnedDefault);
}
