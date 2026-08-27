import { subDays } from 'date-fns';
import { randomUUID } from 'expo-crypto';
import { db } from '@/db';
import { localDateString } from '@/logic/dates';
import type { Decrement } from '@/logic/deplete';
import { normalise } from '@/logic/normalise';
import type { Confidence, ConsumptionEvent, MeasureUnit, MealItem, MealSource, MealType, MealVenue, MealWithItems } from '@/types';
import {
  TransactionHandle,
  MealRow,
  MealItemRow,
  toMeal,
  toMealItem,
  PantryItemRow,
  ConsumptionEventRow,
  toConsumptionEvent,
} from './types';



/* -------------------------------------------------------------------------- */
/* Meals                                                                       */
/* -------------------------------------------------------------------------- */

export interface NewMealItem {
  name: string;
  quantity: number;
  unit: MeasureUnit;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fibreG?: number | null;
  isManualAddition: boolean;
  /** Carried identity from a cooked suggestion (decision 61). Optional; every existing caller omits it and gets today's resolve-by-name behaviour. */
  canonicalId?: string | null;
}


export interface NewMeal {
  loggedAt: string;
  localDate: string;
  mealType: MealType;
  name: string;
  photoUri: string | null;
  source: MealSource;
  confidence: Confidence | null;
  /** Defaults to home — the assumption every existing caller was making. */
  venue?: MealVenue;
  /** Servings the cooking produced. Forced to 1 for non-home venues. */
  servingsMult?: number;
  items: NewMealItem[];
}


export async function insertMeal(meal: NewMeal): Promise<MealWithItems> {
  const mealId = randomUUID();
  const createdAt = new Date().toISOString();

  const items: MealItem[] = meal.items.map((item, index) => ({
    id: randomUUID(),
    mealId,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    calories: item.calories,
    proteinG: item.proteinG,
    carbsG: item.carbsG,
    fatG: item.fatG,
    fibreG: item.fibreG ?? null,
    isManualAddition: item.isManualAddition,
    sortOrder: index,
    canonicalId: item.canonicalId ?? null,
  }));

  // A non-home meal never debits the pantry, so a multiplier on one would be
  // meaningless — forced to 1 here so the stored row cannot express it.
  const venue = meal.venue ?? 'home';
  const stored: MealWithItems = {
    id: mealId,
    loggedAt: meal.loggedAt,
    localDate: meal.localDate,
    mealType: meal.mealType,
    name: meal.name,
    photoUri: meal.photoUri,
    source: meal.source,
    confidence: meal.confidence,
    venue,
    servingsMult: venue === 'home' ? Math.max(1, meal.servingsMult ?? 1) : 1,
    isFavorite: false,
    createdAt,
    items,
  };

  await writeMeal(stored);
  return stored;
}


/** Re-inserts a previously deleted meal, ids intact. Used by undo. */
export async function restoreMeal(meal: MealWithItems): Promise<void> {
  await writeMeal(meal);
}


async function writeMeal(meal: MealWithItems): Promise<void> {
  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO meals
         (id, logged_at, local_date, meal_type, name, photo_uri, source, confidence,
          venue, servings_mult, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        meal.id,
        meal.loggedAt,
        meal.localDate,
        meal.mealType,
        meal.name,
        meal.photoUri,
        meal.source,
        meal.confidence,
        meal.venue,
        meal.servingsMult,
        meal.isFavorite ? 1 : 0,
        meal.createdAt,
      ],
    );
    for (const item of meal.items) {
      await txn.runAsync(
        `INSERT INTO meal_items
           (id, meal_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g, fibre_g,
            is_manual_addition, sort_order, canonical_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.mealId,
          item.name,
          item.quantity,
          item.unit,
          item.calories,
          item.proteinG,
          item.carbsG,
          item.fatG,
          item.fibreG ?? null,
          item.isManualAddition ? 1 : 0,
          item.sortOrder,
          item.canonicalId,
        ],
      );
    }
  });
}


export async function getMealsForDate(
  localDate: string,
): Promise<MealWithItems[]> {
  const mealRows = await db().getAllAsync<MealRow>(
    'SELECT * FROM meals WHERE local_date = ? ORDER BY logged_at ASC',
    [localDate],
  );
  if (mealRows.length === 0) return [];

  const placeholders = mealRows.map(() => '?').join(', ');
  const itemRows = await db().getAllAsync<MealItemRow>(
    `SELECT * FROM meal_items WHERE meal_id IN (${placeholders})
     ORDER BY sort_order ASC`,
    mealRows.map((row) => row.id),
  );

  const itemsByMeal = new Map<string, MealItem[]>();
  for (const row of itemRows) {
    const list = itemsByMeal.get(row.meal_id) ?? [];
    list.push(toMealItem(row));
    itemsByMeal.set(row.meal_id, list);
  }

  return mealRows.map((row) => ({
    ...toMeal(row),
    items: itemsByMeal.get(row.id) ?? [],
  }));
}


export async function getMeal(id: string): Promise<MealWithItems | null> {
  const mealRow = await db().getFirstAsync<MealRow>(
    'SELECT * FROM meals WHERE id = ?',
    [id],
  );
  if (!mealRow) return null;
  const itemRows = await db().getAllAsync<MealItemRow>(
    'SELECT * FROM meal_items WHERE meal_id = ? ORDER BY sort_order ASC',
    [id],
  );
  return { ...toMeal(mealRow), items: itemRows.map(toMealItem) };
}


/** Toggles one stored meal's local quick-log pin and returns its new state. */
export async function toggleMealFavorite(id: string): Promise<boolean> {
  const row = await db().getFirstAsync<{ is_favorite: number }>(
    'SELECT is_favorite FROM meals WHERE id = ?',
    [id],
  );
  if (!row) throw new Error('Meal no longer exists.');
  const next = row.is_favorite !== 1;
  await db().runAsync(
    'UPDATE meals SET is_favorite = ? WHERE id = ?',
    [next ? 1 : 0, id],
  );
  return next;
}


export interface QuickRelogMeal {
  meal: MealWithItems;
  isFavorite: boolean;
  timesLogged: number;
}


/**
 * One representative per normalized dish from the recent window, plus every
 * pinned dish even when it is older. Pinned dishes sort first, then frequency,
 * then recency. The latest occurrence supplies the template ingredients.
 */
export async function getRecentAndFavoriteMeals(
  days = 14,
  limit = 20,
): Promise<QuickRelogMeal[]> {
  const windowDays = Math.max(1, Math.floor(days));
  const since = localDateString(subDays(new Date(), windowDays - 1));
  const rows = await db().getAllAsync<MealRow>(
    `SELECT * FROM meals
     WHERE is_favorite = 1 OR local_date >= ?
     ORDER BY logged_at DESC`,
    [since],
  );
  if (rows.length === 0) return [];

  const grouped = new Map<string, {
    representative: MealRow;
    isFavorite: boolean;
    timesLogged: number;
  }>();
  for (const row of rows) {
    const key = normalise(row.name) || row.id;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        representative: row,
        isFavorite: row.is_favorite === 1,
        timesLogged: row.local_date >= since ? 1 : 0,
      });
      continue;
    }
    current.isFavorite ||= row.is_favorite === 1;
    if (row.local_date >= since) current.timesLogged += 1;
  }

  const selected = [...grouped.values()]
    .sort((left, right) =>
      Number(right.isFavorite) - Number(left.isFavorite)
      || right.timesLogged - left.timesLogged
      || right.representative.logged_at.localeCompare(left.representative.logged_at),
    )
    .slice(0, Math.max(0, Math.floor(limit)));
  if (selected.length === 0) return [];

  const ids = selected.map((entry) => entry.representative.id);
  const placeholders = ids.map(() => '?').join(', ');
  const itemRows = await db().getAllAsync<MealItemRow>(
    `SELECT * FROM meal_items WHERE meal_id IN (${placeholders})
     ORDER BY sort_order ASC`,
    ids,
  );
  const itemsByMeal = new Map<string, MealItem[]>();
  for (const row of itemRows) {
    const items = itemsByMeal.get(row.meal_id) ?? [];
    items.push(toMealItem(row));
    itemsByMeal.set(row.meal_id, items);
  }

  return selected.map((entry) => ({
    meal: {
      ...toMeal(entry.representative),
      items: itemsByMeal.get(entry.representative.id) ?? [],
    },
    isFavorite: entry.isFavorite,
    timesLogged: entry.timesLogged,
  }));
}


export async function deleteMeal(id: string): Promise<void> {
  await db().runAsync('DELETE FROM meals WHERE id = ?', [id]);
}


export type MealEditFailureStage = 'meal' | 'item' | 'pantry' | 'event';


/** Test-only fault injection; production callers omit this argument. */
export interface MealEditOptions {
  failAt?: MealEditFailureStage;
}


/**
 * Replaces an edited meal and its depletion ledger as one transaction.
 * Immutable provenance columns are deliberately absent from the UPDATE.
 */
export async function updateMealWithDepletion(
  edited: MealWithItems,
  decrements: readonly Decrement[],
  options: MealEditOptions = {},
): Promise<MealWithItems> {
  const venue = edited.venue;
  const servingsMult = venue === 'home' ? Math.max(1, edited.servingsMult) : 1;
  let stored: MealWithItems | null = null;

  await db().withExclusiveTransactionAsync(async (txn) => {
    const row = await txn.getFirstAsync<MealRow>(
      'SELECT * FROM meals WHERE id = ?',
      [edited.id],
    );
    if (!row) throw new Error('Meal no longer exists.');
    const original = toMeal(row);
    const existingEvents = await txn.getAllAsync<ConsumptionEventRow>(
      'SELECT * FROM consumption_events WHERE meal_id = ?',
      [edited.id],
    );

    if (existingEvents.length > 0) {
      await reverseRows(txn, existingEvents, edited.id);
    }

    await txn.runAsync(
      `UPDATE meals
         SET meal_type = ?, name = ?, venue = ?, servings_mult = ?, local_date = ?
       WHERE id = ?`,
      [edited.mealType, edited.name, venue, servingsMult, edited.localDate, edited.id],
    );
    if (options.failAt === 'meal') throw new Error('Injected meal edit failure.');

    await txn.runAsync('DELETE FROM meal_items WHERE meal_id = ?', [edited.id]);
    const items = edited.items.map((item, sortOrder) => ({
      ...item,
      mealId: edited.id,
      sortOrder,
    }));
    for (const item of items) {
      await txn.runAsync(
        `INSERT INTO meal_items
           (id, meal_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g, fibre_g,
            is_manual_addition, sort_order, canonical_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id, item.mealId, item.name, item.quantity, item.unit,
          item.calories, item.proteinG, item.carbsG, item.fatG, item.fibreG ?? null,
          item.isManualAddition ? 1 : 0, item.sortOrder, item.canonicalId,
        ],
      );
    }
    if (options.failAt === 'item') throw new Error('Injected item edit failure.');

    const now = new Date().toISOString();
    for (const decrement of decrements) {
      const applied = decrement.pantryItemId
        ? await applyToItem(txn, decrement, now)
        : decrement.qty;
      if (options.failAt === 'pantry') throw new Error('Injected pantry edit failure.');
      await txn.runAsync(
        `INSERT INTO consumption_events
           (id, pantry_item_id, canonical_id, meal_id, qty, unit, uses,
            servings_mult, kind, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(), decrement.pantryItemId, decrement.canonicalId, edited.id,
          applied, decrement.unit, decrement.uses, servingsMult, decrement.kind, now,
        ],
      );
      if (options.failAt === 'event') throw new Error('Injected event edit failure.');
    }

    stored = {
      ...original,
      mealType: edited.mealType,
      name: edited.name,
      venue,
      servingsMult,
      items,
    };
  });

  if (!stored) throw new Error('Meal update did not complete.');
  return stored;
}


/**
 * Meals logged in the last `days` days (inclusive of today). Nothing reads
 * a window today — `getMealsForDate` reads one day and `getLoggedDates`
 * reads none of the content — so personalisation has no source without it.
 */
export async function getRecentMeals(days: number): Promise<MealWithItems[]> {
  const since = localDateString(subDays(new Date(), days));
  const mealRows = await db().getAllAsync<MealRow>(
    'SELECT * FROM meals WHERE local_date >= ? ORDER BY logged_at ASC',
    [since],
  );
  if (mealRows.length === 0) return [];

  const placeholders = mealRows.map(() => '?').join(', ');
  const itemRows = await db().getAllAsync<MealItemRow>(
    `SELECT * FROM meal_items WHERE meal_id IN (${placeholders})
     ORDER BY sort_order ASC`,
    mealRows.map((row) => row.id),
  );

  const itemsByMeal = new Map<string, MealItem[]>();
  for (const row of itemRows) {
    const list = itemsByMeal.get(row.meal_id) ?? [];
    list.push(toMealItem(row));
    itemsByMeal.set(row.meal_id, list);
  }

  return mealRows.map((row) => ({
    ...toMeal(row),
    items: itemsByMeal.get(row.id) ?? [],
  }));
}


/* -------------------------------------------------------------------------- */
/* Depletion                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The servings a dish made last time, so a repeated dish remembers its
 * yield. Matched on the normalised meal name, which is how the same dish
 * typed slightly differently still finds its own history.
 */
export async function lastServingsForDish(
  mealName: string,
): Promise<number | null> {
  const row = await db().getFirstAsync<{ servings_mult: number }>(
    `SELECT servings_mult FROM meals
     WHERE venue = 'home' AND LOWER(TRIM(name)) = ?
     ORDER BY logged_at DESC LIMIT 1`,
    [mealName.trim().toLowerCase()],
  );
  return row?.servings_mult ?? null;
}


/** The user's latest correction for this normalised dish, if any. */
export async function getDishVenueDefault(
  mealName: string,
): Promise<MealVenue | null> {
  const dishNorm = normalise(mealName);
  if (!dishNorm) return null;
  const row = await db().getFirstAsync<{ venue: string }>(
    'SELECT venue FROM dish_venue_defaults WHERE dish_norm = ?',
    [dishNorm],
  );
  return (row?.venue as MealVenue) ?? null;
}


/** Records only an explicit correction from an unknown-origin flow. A later
 * correction replaces the earlier one for the same normalised dish. */
export async function saveDishVenueDefault(
  mealName: string,
  venue: MealVenue,
): Promise<void> {
  const dishNorm = normalise(mealName);
  if (!dishNorm) return;
  await db().runAsync(
    `INSERT INTO dish_venue_defaults (dish_norm, venue, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(dish_norm) DO UPDATE SET
       venue = excluded.venue,
       updated_at = excluded.updated_at`,
    [dishNorm, venue, new Date().toISOString()],
  );
}


/** Remaining portions from the most recent batch of this dish. The meal
 * logged when the batch was cooked accounts for one portion; each later
 * leftovers meal accounts for one more. */
export async function outstandingPortionsForDish(
  mealName: string,
): Promise<number> {
  const dishNorm = normalise(mealName);
  if (!dishNorm) return 0;
  const batches = await db().getAllAsync<{
    name: string;
    logged_at: string;
    servings_mult: number;
  }>(
    `SELECT m.name, m.logged_at,
            COALESCE(MAX(e.servings_mult), m.servings_mult) AS servings_mult
     FROM meals m
     LEFT JOIN consumption_events e ON e.meal_id = m.id
     WHERE m.venue = 'home' AND m.servings_mult > 1
     GROUP BY m.id
     ORDER BY m.logged_at DESC`,
  );
  const batch = batches.find((row) => normalise(row.name) === dishNorm);
  if (!batch) return 0;

  const laterLeftovers = await db().getAllAsync<{ name: string }>(
    `SELECT name FROM meals
     WHERE venue = 'leftovers' AND logged_at > ?`,
    [batch.logged_at],
  );
  const consumed = laterLeftovers.filter(
    (row) => normalise(row.name) === dishNorm,
  ).length;
  return Math.max(0, batch.servings_mult - 1 - consumed);
}


export async function getConsumptionEvents(
  mealId: string,
): Promise<ConsumptionEvent[]> {
  const rows = await db().getAllAsync<ConsumptionEventRow>(
    'SELECT * FROM consumption_events WHERE meal_id = ? ORDER BY created_at ASC',
    [mealId],
  );
  return rows.map(toConsumptionEvent);
}


export async function getConsumptionEventsForItem(
  pantryItemId: string,
): Promise<ConsumptionEvent[]> {
  const rows = await db().getAllAsync<ConsumptionEventRow>(
    'SELECT * FROM consumption_events WHERE pantry_item_id = ? ORDER BY created_at ASC',
    [pantryItemId],
  );
  return rows.map(toConsumptionEvent);
}


/**
 * Writes a planned set of decrements and applies them, in one transaction.
 *
 * Three rules are enforced here rather than in the planner, because they are
 * about the stored row rather than the intention:
 *
 * - **Clamping.** A decrement larger than what is left empties the item and
 *   marks it out, rather than storing a negative amount. The clamp is drift
 *   evidence — the estimate was already wrong.
 * - **Drift.** Every estimated decrement increments the counter that gates
 *   how confidently the interface speaks (decision 53).
 * - **Provenance.** The first estimated decrement against a user-entered
 *   quantity flips `qty_source` to `estimated` (decision 74). Leaving it as
 *   `user` would let the pantry screen render a decremented estimate
 *   labelled as the figure the user typed.
 */
export async function applyDepletion(
  mealId: string,
  decrements: readonly Decrement[],
  servingsMult: number,
): Promise<void> {
  if (decrements.length === 0) return;
  const now = new Date().toISOString();

  await db().withExclusiveTransactionAsync(async (txn) => {
    for (const decrement of decrements) {
      const applied = decrement.pantryItemId
        ? await applyToItem(txn, decrement, now)
        : decrement.qty;
      await txn.runAsync(
        `INSERT INTO consumption_events
           (id, pantry_item_id, canonical_id, meal_id, qty, unit, uses,
            servings_mult, kind, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          decrement.pantryItemId,
          decrement.canonicalId,
          mealId,
          applied,
          decrement.unit,
          decrement.uses,
          servingsMult,
          decrement.kind,
          now,
        ],
      );
    }
  });
}


/**
 * Applies one decrement to its pantry item and reports the amount actually
 * removed, which is not always the amount intended: a decrement larger than
 * what is left empties the item rather than going negative.
 *
 * The *applied* figure is what the consumption event stores, so reversing a
 * clamped decrement restores exactly what it took and not the larger amount
 * it wanted. Recording the intention instead would hand an item free stock
 * every time an over-decrement was undone.
 */
async function applyToItem(
  txn: TransactionHandle,
  decrement: Decrement,
  now: string,
): Promise<number | null> {
  const row = await txn.getFirstAsync<PantryItemRow>(
    'SELECT * FROM pantry_items WHERE id = ?',
    [decrement.pantryItemId],
  );
  if (!row) return decrement.qty;

  const uses = row.uses_count + decrement.uses;

  if (decrement.qty === null) {
    // Uses-tracked, or unconvertible: the count moves, the amount does not.
    await txn.runAsync(
      `UPDATE pantry_items
         SET uses_count = ?,
             estimated_decrements_since_anchor = estimated_decrements_since_anchor + 1,
             updated_at = ?
       WHERE id = ?`,
      [uses, now, decrement.pantryItemId],
    );
    return null;
  }

  const remaining = row.qty_remaining ?? 0;
  const next = remaining - decrement.qty;
  const clamped = next <= 0;
  const applied = clamped ? remaining : decrement.qty;

  await txn.runAsync(
    `UPDATE pantry_items
       SET qty_remaining = ?,
           qty_unit = COALESCE(qty_unit, ?),
           qty_source = 'estimated',
           uses_count = ?,
           status = CASE WHEN ? THEN 'out' ELSE status END,
           estimated_decrements_since_anchor = estimated_decrements_since_anchor + 1,
           updated_at = ?
     WHERE id = ?`,
    [
      clamped ? 0 : next,
      decrement.unit,
      uses,
      clamped ? 1 : 0,
      now,
      decrement.pantryItemId,
    ],
  );
  return applied;
}


/**
 * Reverses a meal's depletion: restores what its events recorded, then
 * deletes them. Drift counters unwind with the amounts, so a reversed meal
 * leaves no trace of confidence it should not have cost.
 */
export async function reverseDepletion(mealId: string): Promise<void> {
  const rows = await db().getAllAsync<ConsumptionEventRow>(
    'SELECT * FROM consumption_events WHERE meal_id = ?',
    [mealId],
  );
  if (rows.length === 0) return;
  await db().withExclusiveTransactionAsync(async (txn) => {
    await reverseRows(txn, rows, mealId);
  });
}


async function reverseRows(
  txn: TransactionHandle,
  rows: readonly ConsumptionEventRow[],
  mealId: string,
): Promise<void> {
  const now = new Date().toISOString();
  for (const row of rows) {
    if (row.pantry_item_id) {
      const item = await txn.getFirstAsync<PantryItemRow>(
        'SELECT * FROM pantry_items WHERE id = ?',
        [row.pantry_item_id],
      );
      if (item) {
        const restoredQty =
          row.qty === null ? item.qty_remaining : (item.qty_remaining ?? 0) + row.qty;
        await txn.runAsync(
          `UPDATE pantry_items
             SET qty_remaining = ?,
                 uses_count = MAX(0, uses_count - ?),
                 status = CASE WHEN status = 'out' AND ? > 0 THEN 'in_stock' ELSE status END,
                 estimated_decrements_since_anchor =
                   MAX(0, estimated_decrements_since_anchor - 1),
                 updated_at = ?
           WHERE id = ?`,
          [restoredQty, row.uses, restoredQty ?? 0, now, row.pantry_item_id],
        );
      }
    }
  }
  await txn.runAsync('DELETE FROM consumption_events WHERE meal_id = ?', [
    mealId,
  ]);
}


/**
 * Re-commits an edited meal: reverse, then reapply, in one transaction.
 *
 * Deliberately not a computed delta between the old and new meals. A diff
 * would have to be simultaneously correct for added items, removed items,
 * changed quantities, and a changed multiplier, and it drifts out of
 * agreement with itself the moment one of those cases is handled slightly
 * differently. Reverse-then-reapply has one code path, and the events table
 * exists precisely to make it cheap.
 */
export async function reapplyDepletion(
  mealId: string,
  decrements: readonly Decrement[],
  servingsMult: number,
): Promise<void> {
  const existing = await db().getAllAsync<ConsumptionEventRow>(
    'SELECT * FROM consumption_events WHERE meal_id = ?',
    [mealId],
  );
  const now = new Date().toISOString();

  await db().withExclusiveTransactionAsync(async (txn) => {
    if (existing.length > 0) {
      await reverseRows(txn, existing, mealId);
    }
    for (const decrement of decrements) {
      const applied = decrement.pantryItemId
        ? await applyToItem(txn, decrement, now)
        : decrement.qty;
      await txn.runAsync(
        `INSERT INTO consumption_events
           (id, pantry_item_id, canonical_id, meal_id, qty, unit, uses,
            servings_mult, kind, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          decrement.pantryItemId,
          decrement.canonicalId,
          mealId,
          applied,
          decrement.unit,
          decrement.uses,
          servingsMult,
          decrement.kind,
          now,
        ],
      );
    }
  });
}
