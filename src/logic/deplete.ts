import { convert } from '@/logic/measures';
import type {
  CanonicalItem,
  ConsumptionKind,
  FoodClass,
  MealVenue,
  MeasureUnit,
  PantryItem,
} from '@/types';

/**
 * The depletion planner (decision 9). Pure: given a meal, a multiplier, and
 * the catalogue, it returns the changes it *intends*, and writes nothing.
 *
 * Everything interesting lives here — class dispatch, unit reconciliation,
 * which physical item to debit, the refusal to guess — which makes it
 * testable as a function from inputs to a list rather than as a sequence of
 * database writes. It also makes reversal trivial: a `Decrement` negated is
 * its own undo, which is why editing a meal reverses and replays rather
 * than computing a delta.
 */

/** One consumed ingredient, already resolved to a canonical. */
export interface ConsumedIngredient {
  canonicalId: string;
  quantity: number;
  unit: MeasureUnit;
  kind: ConsumptionKind;
}

/** One intended change against one pantry item, or against none. */
export interface Decrement {
  canonicalId: string;
  /** Null when the ingredient is not in the catalogue — recorded, not applied. */
  pantryItemId: string | null;
  /** Mass or volume to remove, in `unit`. Null when only a use is counted. */
  qty: number | null;
  unit: MeasureUnit | null;
  /** Uses to add, already scaled by the multiplier. */
  uses: number;
  kind: ConsumptionKind;
  /**
   * Why no quantity was computed, when none was. `unconvertible` is the
   * refusal to guess; `uses_tracked` is the class behaving as designed.
   */
  reason?: 'uses_tracked' | 'unconvertible' | 'uncatalogued';
}

export interface PlanInput {
  venue: MealVenue;
  servingsMult: number;
  ingredients: ConsumedIngredient[];
  /** Every item currently in the catalogue. */
  catalogue: readonly PantryItem[];
  canonicals: ReadonlyMap<string, CanonicalItem>;
  /** Today, as a local date string. Used for the nearest-expiry tiebreak. */
  today?: string;
}

/** Classes counted in uses rather than mass (decision 12). */
const USES_TRACKED: readonly FoodClass[] = ['seasoning', 'condiment'];

/**
 * Plans the decrements for one meal.
 *
 * Returns an empty plan for meals eaten out or logged as leftovers — the
 * batch was already debited when it was cooked (decisions 10 and 11).
 */
export function planDepletion(input: PlanInput): Decrement[] {
  if (input.venue !== 'home') return [];

  const multiplier = Math.max(1, input.servingsMult);
  const decrements: Decrement[] = [];
  // One physical item per canonical per meal, so two mentions of the same
  // ingredient debit the same bottle rather than two.
  const claimed = new Map<string, PantryItem>();

  for (const ingredient of input.ingredients) {
    const canonical = input.canonicals.get(ingredient.canonicalId);
    const item =
      claimed.get(ingredient.canonicalId) ??
      pickItem(input.catalogue, ingredient.canonicalId, input.today);
    if (item) claimed.set(ingredient.canonicalId, item);

    const scaledQty = ingredient.quantity * multiplier;

    // Uncatalogued: recorded against the canonical with no item, never
    // creating one. It is the raw material for "you cook with this a lot,
    // want to track it?" later.
    if (!item || !canonical) {
      decrements.push({
        canonicalId: ingredient.canonicalId,
        pantryItemId: null,
        qty: scaledQty,
        unit: ingredient.unit,
        uses: multiplier,
        kind: ingredient.kind,
        reason: 'uncatalogued',
      });
      continue;
    }

    // Uses-tracked classes never estimate a mass — a vision model will not
    // report 1.4 g of gochujang, so frequency is the only honest signal.
    if (USES_TRACKED.includes(canonical.foodClass)) {
      decrements.push({
        canonicalId: ingredient.canonicalId,
        pantryItemId: item.id,
        qty: null,
        unit: null,
        uses: multiplier,
        kind: ingredient.kind,
        reason: 'uses_tracked',
      });
      continue;
    }

    // Mass-tracked: convert into the unit the item is stocked in. Where the
    // item carries no unit yet, the logged unit stands.
    const targetUnit = item.qtyUnit ?? ingredient.unit;
    const converted = convert(
      scaledQty,
      ingredient.unit,
      targetUnit,
      canonical,
    );

    if (converted === null) {
      // The refusal to guess (decision 52): record the consumption, count a
      // use, and leave the remaining amount alone.
      decrements.push({
        canonicalId: ingredient.canonicalId,
        pantryItemId: item.id,
        qty: null,
        unit: null,
        uses: multiplier,
        kind: ingredient.kind,
        reason: 'unconvertible',
      });
      continue;
    }

    decrements.push({
      canonicalId: ingredient.canonicalId,
      pantryItemId: item.id,
      qty: converted,
      unit: targetUnit,
      uses: multiplier,
      kind: ingredient.kind,
    });
  }

  return decrements;
}

/**
 * Which physical item to debit: in stock, then opened, then nearest expiry,
 * then oldest. The nearest-expiry tiebreak is deliberate — cooking from the
 * oldest stock is what the user would do and what the dinner decision will
 * later recommend, so the model should assume it.
 *
 * One item is debited, not several: spreading a decrement makes every item
 * slightly wrong instead of one item mostly right, and it makes reversal
 * ambiguous.
 */
export function pickItem(
  catalogue: readonly PantryItem[],
  canonicalId: string,
  _today?: string,
): PantryItem | null {
  const candidates = catalogue.filter(
    (item) =>
      item.canonicalId === canonicalId &&
      item.status !== 'discarded' &&
      item.status !== 'out',
  );
  if (candidates.length === 0) return null;

  const ranked = [...candidates].sort((a, b) => {
    const stock = rankStatus(a) - rankStatus(b);
    if (stock !== 0) return stock;

    const opened = Number(b.openedAt !== null) - Number(a.openedAt !== null);
    if (opened !== 0) return opened;

    const expiry = compareExpiry(a.expiresAt, b.expiresAt);
    if (expiry !== 0) return expiry;

    return a.createdAt.localeCompare(b.createdAt);
  });
  return ranked[0] ?? null;
}

/** In-stock items sort ahead of running-low ones. */
function rankStatus(item: PantryItem): number {
  return item.status === 'in_stock' ? 0 : 1;
}

/** Soonest expiry first; undated items sort last. */
function compareExpiry(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}
