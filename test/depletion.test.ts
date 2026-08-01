import { beforeEach, describe, expect, test } from 'vitest';

import {
  applyDepletion,
  getAllCanonicals,
  insertMeal,
  getConsumptionEvents,
  getPantryItem,
  insertPantryItem,
  listPantryItems,
  loadSeedData,
  reanchorFromReceipt,
  reapplyDepletion,
  reverseDepletion,
  setItemFullness,
  setItemQuantity,
} from '../src/db/queries';
import { planDepletion, type ConsumedIngredient } from '../src/logic/deplete';
import { DRIFT_LIMIT } from '../src/logic/stockStatus';
import { usePantryStore } from '../src/store/pantryStore';
import type { CanonicalItem } from '../src/types';
import { openTestDatabase } from './stubs/db';

/**
 * Depletion end to end: the real planner against the real SQL, with the
 * real seed data behind it.
 */

let canonicals: Map<string, CanonicalItem>;

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
  canonicals = new Map((await getAllCanonicals()).map((c) => [c.id, c]));
});

function ingredient(
  canonicalId: string,
  quantity: number,
  unit: ConsumedIngredient['unit'] = 'g',
): ConsumedIngredient {
  return { canonicalId, quantity, unit, kind: 'meal_item' };
}

/**
 * Plans and applies in one step, the way the commit path does — including
 * writing the real meal row, since consumption events reference it.
 * Returns the stored meal id.
 */
async function commit(
  label: string,
  ingredients: ConsumedIngredient[],
  options: { venue?: 'home' | 'out' | 'leftovers'; servings?: number } = {},
): Promise<string> {
  const venue = options.venue ?? 'home';
  const servings = options.servings ?? 1;
  const meal = await insertMeal({
    loggedAt: new Date().toISOString(),
    localDate: '2026-06-01',
    mealType: 'dinner',
    name: label,
    photoUri: null,
    source: 'manual',
    confidence: null,
    venue,
    servingsMult: servings,
    items: ingredients.map((entry) => ({
      name: entry.canonicalId,
      quantity: entry.quantity,
      unit: entry.unit,
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      isManualAddition: false,
    })),
  });
  const plan = planDepletion({
    venue,
    servingsMult: servings,
    ingredients,
    catalogue: await listPantryItems(),
    canonicals,
  });
  await applyDepletion(meal.id, plan, servings);
  return meal.id;
}

describe('applying a home-cooked meal', () => {
  test('a staple loses mass, a condiment gains a use, a perishable loses mass', async () => {
    const rice = await insertPantryItem({
      canonicalId: 'jasmine-rice',
      locationId: 'pantry',
      qtyRemaining: 5000,
      qtyUnit: 'g',
    });
    const gochujang = await insertPantryItem({
      canonicalId: 'gochujang',
      locationId: 'fridge',
    });
    const chicken = await insertPantryItem({
      canonicalId: 'chicken-breast',
      locationId: 'fridge',
      qtyRemaining: 600,
      qtyUnit: 'g',
    });

    await commit('meal-1', [
      ingredient('jasmine-rice', 200),
      ingredient('gochujang', 1, 'tbsp'),
      ingredient('chicken-breast', 300),
    ]);

    expect((await getPantryItem(rice.id))?.qtyRemaining).toBe(4800);
    const jar = await getPantryItem(gochujang.id);
    expect(jar?.usesCount).toBe(1);
    expect(jar?.qtyRemaining).toBeNull();
    expect((await getPantryItem(chicken.id))?.qtyRemaining).toBe(300);
  });

  test('a four-serving batch debits fourfold, and leftovers debit nothing', async () => {
    const rice = await insertPantryItem({
      canonicalId: 'jasmine-rice',
      locationId: 'pantry',
      qtyRemaining: 5000,
      qtyUnit: 'g',
    });

    await commit('batch', [ingredient('jasmine-rice', 200)], { servings: 4 });
    expect((await getPantryItem(rice.id))?.qtyRemaining).toBe(4200);

    const leftoverId = await commit(
      'leftover-portion',
      [ingredient('jasmine-rice', 200)],
      { venue: 'leftovers' },
    );
    expect((await getPantryItem(rice.id))?.qtyRemaining).toBe(4200);
    expect(await getConsumptionEvents(leftoverId)).toEqual([]);
  });

  test('a meal eaten out moves nothing', async () => {
    const rice = await insertPantryItem({
      canonicalId: 'jasmine-rice',
      locationId: 'pantry',
      qtyRemaining: 5000,
      qtyUnit: 'g',
    });
    const outId = await commit('restaurant', [ingredient('jasmine-rice', 200)], {
      venue: 'out',
    });
    expect((await getPantryItem(rice.id))?.qtyRemaining).toBe(5000);
    expect(await getConsumptionEvents(outId)).toEqual([]);
  });

  test('an over-decrement clamps to empty and marks the item out', async () => {
    const rice = await insertPantryItem({
      canonicalId: 'jasmine-rice',
      locationId: 'pantry',
      qtyRemaining: 100,
      qtyUnit: 'g',
    });
    await commit('big-meal', [ingredient('jasmine-rice', 500)]);
    const after = await getPantryItem(rice.id);
    expect(after?.qtyRemaining).toBe(0);
    expect(after?.status).toBe('out');
  });

  test('an uncatalogued ingredient is recorded with no item and creates nothing', async () => {
    const mealId = await commit('meal-x', [ingredient('jasmine-rice', 200)]);
    const events = await getConsumptionEvents(mealId);
    expect(events.length).toBe(1);
    expect(events[0]?.pantryItemId).toBeNull();
    expect(events[0]?.canonicalId).toBe('jasmine-rice');
    expect(await listPantryItems()).toEqual([]);
  });
});

describe('decision 74 — a decrement demotes qty_source', () => {
  test('the pantry screen stops echoing a figure it has since estimated', async () => {
    const rice = await insertPantryItem({
      canonicalId: 'jasmine-rice',
      locationId: 'pantry',
      qtyRemaining: 5000,
      qtyUnit: 'g',
    });

    // Read side before: the user's own figure is echoed back to them.
    await usePantryStore.getState().refresh();
    const before = usePantryStore
      .getState()
      .groups.flatMap((g) => g.entries)
      .find((e) => e.id === rice.id);
    expect(before?.userEnteredQty).toBe('5000 g');

    await commit('meal-1', [ingredient('jasmine-rice', 200)]);

    // Read side after: no echo, because it is no longer their figure.
    await usePantryStore.getState().refresh();
    const after = usePantryStore
      .getState()
      .groups.flatMap((g) => g.entries)
      .find((e) => e.id === rice.id);
    expect(after?.userEnteredQty).toBeNull();
    expect((await getPantryItem(rice.id))?.qtySource).toBe('estimated');
  });

  test('typing a new quantity restores the echo and zeroes drift', async () => {
    const rice = await insertPantryItem({
      canonicalId: 'jasmine-rice',
      locationId: 'pantry',
      qtyRemaining: 5000,
      qtyUnit: 'g',
    });
    await commit('meal-1', [ingredient('jasmine-rice', 200)]);
    await setItemQuantity(rice.id, 4000, 'g');

    const item = await getPantryItem(rice.id);
    expect(item?.qtySource).toBe('user');
    expect(item?.estimatedDecrementsSinceAnchor).toBe(0);

    await usePantryStore.getState().refresh();
    const entry = usePantryStore
      .getState()
      .groups.flatMap((g) => g.entries)
      .find((e) => e.id === rice.id);
    expect(entry?.userEnteredQty).toBe('4000 g');
  });
});

describe('reversal', () => {
  test('deleting a meal restores every affected item exactly', async () => {
    const rice = await insertPantryItem({
      canonicalId: 'jasmine-rice',
      locationId: 'pantry',
      qtyRemaining: 5000,
      qtyUnit: 'g',
    });
    const gochujang = await insertPantryItem({
      canonicalId: 'gochujang',
      locationId: 'fridge',
    });
    const chicken = await insertPantryItem({
      canonicalId: 'chicken-breast',
      locationId: 'fridge',
      qtyRemaining: 600,
      qtyUnit: 'g',
    });

    const mealId = await commit('meal-1', [
      ingredient('jasmine-rice', 200),
      ingredient('gochujang', 1, 'tbsp'),
      ingredient('chicken-breast', 300),
    ]);
    await reverseDepletion(mealId);

    expect((await getPantryItem(rice.id))?.qtyRemaining).toBe(5000);
    expect((await getPantryItem(gochujang.id))?.usesCount).toBe(0);
    expect((await getPantryItem(chicken.id))?.qtyRemaining).toBe(600);
    expect(await getConsumptionEvents(mealId)).toEqual([]);
  });

  test('reversal unwinds the drift counter too', async () => {
    const rice = await insertPantryItem({
      canonicalId: 'jasmine-rice',
      locationId: 'pantry',
      qtyRemaining: 5000,
      qtyUnit: 'g',
    });
    const mealId = await commit('meal-1', [ingredient('jasmine-rice', 200)]);
    expect((await getPantryItem(rice.id))?.estimatedDecrementsSinceAnchor).toBe(1);
    await reverseDepletion(mealId);
    expect((await getPantryItem(rice.id))?.estimatedDecrementsSinceAnchor).toBe(0);
  });

  test('a clamped item comes back in stock when its amount is restored', async () => {
    const rice = await insertPantryItem({
      canonicalId: 'jasmine-rice',
      locationId: 'pantry',
      qtyRemaining: 100,
      qtyUnit: 'g',
    });
    const mealId = await commit('big-meal', [ingredient('jasmine-rice', 500)]);
    expect((await getPantryItem(rice.id))?.status).toBe('out');
    await reverseDepletion(mealId);
    const restored = await getPantryItem(rice.id);
    expect(restored?.qtyRemaining).toBe(100);
    expect(restored?.status).toBe('in_stock');
  });
});

describe('editing is reverse-then-reapply', () => {
  test('re-committing an edited meal never applies a decrement twice', async () => {
    const rice = await insertPantryItem({
      canonicalId: 'jasmine-rice',
      locationId: 'pantry',
      qtyRemaining: 5000,
      qtyUnit: 'g',
    });

    const mealId = await commit('meal-1', [ingredient('jasmine-rice', 200)]);
    expect((await getPantryItem(rice.id))?.qtyRemaining).toBe(4800);

    // The user corrects the portion to 300 g and re-commits.
    const edited = planDepletion({
      venue: 'home',
      servingsMult: 1,
      ingredients: [ingredient('jasmine-rice', 300)],
      catalogue: await listPantryItems(),
      canonicals,
    });
    await reapplyDepletion(mealId, edited, 1);

    // 5000 - 300, not 5000 - 200 - 300 and not 4800 - 300.
    expect((await getPantryItem(rice.id))?.qtyRemaining).toBe(4700);
    expect((await getConsumptionEvents(mealId)).length).toBe(1);
  });

  test('a changed multiplier reapplies cleanly', async () => {
    const rice = await insertPantryItem({
      canonicalId: 'jasmine-rice',
      locationId: 'pantry',
      qtyRemaining: 5000,
      qtyUnit: 'g',
    });
    const mealId = await commit('meal-1', [ingredient('jasmine-rice', 200)], {
      servings: 1,
    });

    const rescaled = planDepletion({
      venue: 'home',
      servingsMult: 4,
      ingredients: [ingredient('jasmine-rice', 200)],
      catalogue: await listPantryItems(),
      canonicals,
    });
    await reapplyDepletion(mealId, rescaled, 4);
    expect((await getPantryItem(rice.id))?.qtyRemaining).toBe(4200);
  });

  test('removing an item from an edited meal restores what it took', async () => {
    const rice = await insertPantryItem({
      canonicalId: 'jasmine-rice',
      locationId: 'pantry',
      qtyRemaining: 5000,
      qtyUnit: 'g',
    });
    const chicken = await insertPantryItem({
      canonicalId: 'chicken-breast',
      locationId: 'fridge',
      qtyRemaining: 600,
      qtyUnit: 'g',
    });
    const mealId = await commit('meal-1', [
      ingredient('jasmine-rice', 200),
      ingredient('chicken-breast', 300),
    ]);

    const withoutChicken = planDepletion({
      venue: 'home',
      servingsMult: 1,
      ingredients: [ingredient('jasmine-rice', 200)],
      catalogue: await listPantryItems(),
      canonicals,
    });
    await reapplyDepletion(mealId, withoutChicken, 1);

    expect((await getPantryItem(chicken.id))?.qtyRemaining).toBe(600);
    expect((await getPantryItem(rice.id))?.qtyRemaining).toBe(4800);
  });
});

describe('drift and anchors', () => {
  test('an anchor resets the count', async () => {
    const jar = await insertPantryItem({
      canonicalId: 'gochujang',
      locationId: 'fridge',
    });
    for (let i = 0; i < 3; i += 1) {
      await commit(`meal-${i}`, [ingredient('gochujang', 1, 'tbsp')]);
    }
    expect((await getPantryItem(jar.id))?.estimatedDecrementsSinceAnchor).toBe(3);

    await setItemFullness(jar.id, 'half');
    const anchored = await getPantryItem(jar.id);
    expect(anchored?.estimatedDecrementsSinceAnchor).toBe(0);
    expect(anchored?.lastAnchorAt).not.toBeNull();
  });

  test('past the limit the interface qualifies rather than asserts', async () => {
    const rice = await insertPantryItem({
      canonicalId: 'jasmine-rice',
      locationId: 'pantry',
      qtyRemaining: 5000,
      qtyUnit: 'g',
    });
    for (let i = 0; i <= DRIFT_LIMIT; i += 1) {
      await commit(`meal-${i}`, [ingredient('jasmine-rice', 100)]);
    }

    await usePantryStore.getState().refresh();
    const entry = usePantryStore
      .getState()
      .groups.flatMap((g) => g.entries)
      .find((e) => e.id === rice.id);
    expect(entry?.statusConfident).toBe(false);
  });

  test('a receipt re-anchors by setting, not by adding', async () => {
    const rice = await insertPantryItem({
      canonicalId: 'jasmine-rice',
      locationId: 'pantry',
      qtyRemaining: 5000,
      qtyUnit: 'g',
    });
    for (let i = 0; i < 4; i += 1) {
      await commit(`meal-${i}`, [ingredient('jasmine-rice', 200)]);
    }
    expect((await getPantryItem(rice.id))?.qtyRemaining).toBe(4200);

    // A receipt for a 5 kg bag: the amount is set, not added to the drifted
    // estimate, and the accumulated drift is discarded.
    await reanchorFromReceipt(rice.id, 5000, 'g');
    const anchored = await getPantryItem(rice.id);
    expect(anchored?.qtyRemaining).toBe(5000);
    expect(anchored?.estimatedDecrementsSinceAnchor).toBe(0);
    expect(anchored?.qtySource).toBe('user');
  });
});

describe('depletion is never retroactive', () => {
  test('adding an item does not replay historical meals', async () => {
    // A month of meals with nothing catalogued.
    for (let i = 0; i < 5; i += 1) {
      await commit(`old-meal-${i}`, [ingredient('jasmine-rice', 200)]);
    }
    const rice = await insertPantryItem({
      canonicalId: 'jasmine-rice',
      locationId: 'pantry',
      qtyRemaining: 5000,
      qtyUnit: 'g',
    });
    const item = await getPantryItem(rice.id);
    expect(item?.qtyRemaining).toBe(5000);
    expect(item?.estimatedDecrementsSinceAnchor).toBe(0);
  });
});
