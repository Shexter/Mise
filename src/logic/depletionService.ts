import {
  applyDepletion,
  getAllCanonicals,
  getConsumptionEvents,
  listPantryItems,
  reapplyDepletion,
  reverseDepletion,
  updateMealWithDepletion,
} from '@/db/queries';
import { HIDDEN_INGREDIENTS } from '@/constants/hiddenIngredients';
import { planDepletion, type ConsumedIngredient, type Decrement } from '@/logic/deplete';
import { resolveIngredientReferences } from '@/logic/resolution';
import type { CanonicalItem, MealVenue, MealWithItems } from '@/types';

/**
 * Binds the pure planner to the identity layer and the database: resolve
 * each logged item to a canonical ingredient, plan the decrements, apply
 * them. Called on commit only — never while the user is still correcting
 * an estimate on the review screen.
 */

/** What was decremented, for the brief confirmation the commit shows. */
export interface DepletionSummary {
  /** Canonical display names whose items moved. */
  names: string[];
  /** How many consumed ingredients matched nothing in the catalogue. */
  uncatalogued: number;
}

/**
 * Resolves a meal's items to canonical ingredients.
 *
 * An item that already carries a `canonicalId` — a cooked suggestion, which
 * knows exactly what it used — is debited by that identity directly and
 * never re-derived from its name (decision 61). Everything else resolves as
 * before: a quick-pick carries its `canonicalId` directly (added to
 * `hidden-ingredients.json` by the identity layer), so it skips matching
 * entirely; an unmapped quick-pick resolves by name like any other item and
 * simply decrements nothing when it finds no match — the pre-existing
 * behaviour, not a regression.
 */
async function resolveIngredients(
  meal: MealWithItems,
): Promise<ConsumedIngredient[]> {
  const quickPickByName = new Map(
    HIDDEN_INGREDIENTS.filter((entry) => entry.canonicalId).map((entry) => [
      entry.name.toLowerCase(),
      entry.canonicalId as string,
    ]),
  );

  const resolved: ConsumedIngredient[] = [];
  const needsMatching: { index: number; name: string }[] = [];

  for (const [index, item] of meal.items.entries()) {
    if (item.canonicalId) {
      resolved[index] = {
        canonicalId: item.canonicalId,
        quantity: item.quantity,
        unit: item.unit,
        kind: 'meal_item',
      };
      continue;
    }
    const quickPick = quickPickByName.get(item.name.toLowerCase());
    if (quickPick) {
      resolved[index] = {
        canonicalId: quickPick,
        quantity: item.quantity,
        unit: item.unit,
        kind: 'hidden_ingredient',
      };
    } else {
      needsMatching.push({ index, name: item.name });
    }
  }

  if (needsMatching.length > 0) {
    const outcomes = await resolveIngredientReferences(
      needsMatching.map((entry) => ({ raw: entry.name })),
      'meal_log',
    );
    for (const [position, entry] of needsMatching.entries()) {
      const outcome = outcomes[position];
      const item = meal.items[entry.index];
      if (!item || !outcome) continue;
      // Both resolved and needs-confirmation outcomes carry a canonical:
      // meal logging is never interrupted to disambiguate (decision 28).
      if (
        outcome.status === 'resolved' ||
        outcome.status === 'needs_confirmation'
      ) {
        resolved[entry.index] = {
          canonicalId: outcome.canonicalId,
          quantity: item.quantity,
          unit: item.unit,
          kind: 'meal_item',
        };
      }
    }
  }

  return resolved.filter((entry): entry is ConsumedIngredient => Boolean(entry));
}

export async function planMealDepletion(meal: MealWithItems): Promise<{
  decrements: Decrement[];
  canonicals: Map<string, CanonicalItem>;
}> {
  const canonicals = new Map(
    (await getAllCanonicals()).map((canonical) => [canonical.id, canonical]),
  );
  if (meal.venue !== 'home') return { decrements: [], canonicals };

  const ingredients = await resolveIngredients(meal);
  const decrements = planDepletion({
    venue: meal.venue,
    servingsMult: meal.servingsMult,
    ingredients,
    catalogue: await listPantryItems(),
    canonicals,
  });
  return { decrements, canonicals };
}

/**
 * Plans an edit against the pantry state that will exist after the old
 * ledger rows are reversed. This matters when the old meal marked an item
 * out: planning against the current snapshot would incorrectly skip it.
 */
async function planEditedMealDepletion(meal: MealWithItems): Promise<{
  decrements: Decrement[];
  canonicals: Map<string, CanonicalItem>;
}> {
  const [canonicalList, currentItems, events] = await Promise.all([
    getAllCanonicals(),
    listPantryItems(),
    getConsumptionEvents(meal.id),
  ]);
  const canonicals = new Map(canonicalList.map((canonical) => [canonical.id, canonical]));
  if (meal.venue !== 'home') return { decrements: [], canonicals };

  const restoredItems = currentItems.map((item) => {
    const rows = events.filter((event) => event.pantryItemId === item.id);
    if (rows.length === 0) return item;
    const restoredQty = rows.reduce<number | null>(
      (quantity, event) => event.qty === null ? quantity : (quantity ?? 0) + event.qty,
      item.qtyRemaining,
    );
    return {
      ...item,
      qtyRemaining: restoredQty,
      usesCount: Math.max(0, item.usesCount - rows.reduce((sum, event) => sum + event.uses, 0)),
      status: item.status === 'out' && (restoredQty ?? 0) > 0 ? 'in_stock' as const : item.status,
    };
  });
  const ingredients = await resolveIngredients(meal);
  return {
    decrements: planDepletion({
      venue: meal.venue,
      servingsMult: meal.servingsMult,
      ingredients,
      catalogue: restoredItems,
      canonicals,
    }),
    canonicals,
  };
}

export function summariseDepletion(
  decrements: readonly Decrement[],
  canonicals: ReadonlyMap<string, CanonicalItem>,
): DepletionSummary {
  const names = new Set<string>();
  let uncatalogued = 0;
  for (const decrement of decrements) {
    if (decrement.pantryItemId === null) {
      uncatalogued += 1;
      continue;
    }
    names.add(
      canonicals.get(decrement.canonicalId)?.displayName ??
        decrement.canonicalId,
    );
  }
  return { names: [...names], uncatalogued };
}

/**
 * Applies depletion for a freshly committed meal. Returns what moved, so
 * the automatic change can be shown rather than happening silently.
 */
export async function depleteForMeal(
  meal: MealWithItems,
): Promise<DepletionSummary> {
  const { decrements, canonicals } = await planMealDepletion(meal);
  if (decrements.length === 0) return { names: [], uncatalogued: 0 };
  await applyDepletion(meal.id, decrements, meal.servingsMult);
  return summariseDepletion(decrements, canonicals);
}

/** Re-commits an edited meal: reverse, then reapply, in one transaction. */
export async function redepleteForMeal(
  meal: MealWithItems,
): Promise<DepletionSummary> {
  const { decrements, canonicals } = await planMealDepletion(meal);
  await reapplyDepletion(meal.id, decrements, meal.servingsMult);
  return summariseDepletion(decrements, canonicals);
}

/** Saves the meal rows and their corrected depletion in one transaction. */
export async function saveEditedMeal(
  meal: MealWithItems,
): Promise<{ meal: MealWithItems; summary: DepletionSummary }> {
  const { decrements, canonicals } = await planEditedMealDepletion(meal);
  const stored = await updateMealWithDepletion(meal, decrements);
  return { meal: stored, summary: summariseDepletion(decrements, canonicals) };
}

/** Restores everything a deleted meal took. */
export async function undepleteForMeal(mealId: string): Promise<void> {
  await reverseDepletion(mealId);
}
