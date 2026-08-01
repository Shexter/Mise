import { beforeEach, describe, expect, test } from 'vitest';

import {
  getAllCanonicals,
  getPantryItem,
  insertMeal,
  insertPantryItem,
  listPantryItems,
  loadSeedData,
  reapplyDepletion,
} from '../src/db/queries';
import { planDepletion } from '../src/logic/deplete';
import { depleteForMeal } from '../src/logic/depletionService';
import type { CanonicalItem } from '../src/types';
import { openTestDatabase } from './stubs/db';

/**
 * A cooked suggestion carries the exact canonical it used
 * (`meal_items.canonical_id`); the resolver must debit that identity
 * directly and never re-derive it from the item's name (decision 61).
 */

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
});

describe('resolveIngredients prefers a carried canonical id', () => {
  test('a cooked suggestion debits a seasoning by identity, no name match needed', async () => {
    const gochujang = await insertPantryItem({
      canonicalId: 'gochujang',
      locationId: 'fridge',
      qtyRemaining: 200,
      qtyUnit: 'g',
    });

    const meal = await insertMeal({
      loggedAt: new Date().toISOString(),
      localDate: '2026-06-01',
      mealType: 'dinner',
      name: 'Cooked from a suggestion',
      photoUri: null,
      source: 'manual',
      confidence: null,
      items: [
        {
          // A name that would not resolve to gochujang through the cascade.
          name: 'spicy sauce (from suggestion)',
          quantity: 15,
          unit: 'g',
          calories: 0,
          proteinG: 0,
          carbsG: 0,
          fatG: 0,
          isManualAddition: false,
          canonicalId: 'gochujang',
        },
      ],
    });

    const summary = await depleteForMeal(meal);
    expect(summary.uncatalogued).toBe(0);
    const item = await getPantryItem(gochujang.id);
    expect(item?.usesCount).toBe(1);
  });

  test('a photographed meal with no carried id still resolves by name', async () => {
    const rice = await insertPantryItem({
      canonicalId: 'jasmine-rice',
      locationId: 'pantry',
      qtyRemaining: 1000,
      qtyUnit: 'g',
    });

    const meal = await insertMeal({
      loggedAt: new Date().toISOString(),
      localDate: '2026-06-01',
      mealType: 'dinner',
      name: 'Photographed plate',
      photoUri: 'file://plate.jpg',
      source: 'photo',
      confidence: 'high',
      items: [
        {
          name: 'jasmine rice',
          quantity: 150,
          unit: 'g',
          calories: 200,
          proteinG: 4,
          carbsG: 44,
          fatG: 0,
          isManualAddition: false,
        },
      ],
    });

    const summary = await depleteForMeal(meal);
    expect(summary.uncatalogued).toBe(0);
    const item = await getPantryItem(rice.id);
    expect(item?.qtyRemaining).toBe(850);
  });

  test('a carried canonical wins over a name that would otherwise resolve to something else', async () => {
    const gochujang = await insertPantryItem({
      canonicalId: 'gochujang',
      locationId: 'fridge',
      qtyRemaining: 200,
      qtyUnit: 'g',
    });
    const rice = await insertPantryItem({
      canonicalId: 'jasmine-rice',
      locationId: 'pantry',
      qtyRemaining: 1000,
      qtyUnit: 'g',
    });

    const meal = await insertMeal({
      loggedAt: new Date().toISOString(),
      localDate: '2026-06-01',
      mealType: 'dinner',
      name: 'Ambiguous name, carried identity',
      photoUri: null,
      source: 'manual',
      confidence: null,
      items: [
        {
          // Named "rice" — would resolve to jasmine-rice by name — but
          // carries gochujang, which must win.
          name: 'rice',
          quantity: 10,
          unit: 'g',
          calories: 0,
          proteinG: 0,
          carbsG: 0,
          fatG: 0,
          isManualAddition: false,
          canonicalId: 'gochujang',
        },
      ],
    });

    const summary = await depleteForMeal(meal);
    expect(summary.names).toEqual(['Gochujang']);

    const rebalancedGochujang = await getPantryItem(gochujang.id);
    const untouchedRice = await getPantryItem(rice.id);
    expect(rebalancedGochujang?.usesCount).toBe(1);
    expect(untouchedRice?.qtyRemaining).toBe(1000);
  });

  test('photographing the finished dish overrides the suggestion figures, not merges with them', async () => {
    const gochujang = await insertPantryItem({
      canonicalId: 'gochujang',
      locationId: 'fridge',
      qtyRemaining: 200,
      qtyUnit: 'g',
    });
    const chicken = await insertPantryItem({
      canonicalId: 'chicken-breast',
      locationId: 'fridge',
      qtyRemaining: 1000,
      qtyUnit: 'g',
    });

    // Cooked from a suggestion: carried identity, no mass on the seasoning.
    const meal = await insertMeal({
      loggedAt: new Date().toISOString(),
      localDate: '2026-06-01',
      mealType: 'dinner',
      name: 'Gochujang pork belly stir-fry',
      photoUri: null,
      source: 'suggestion',
      confidence: null,
      items: [
        {
          name: 'Gochujang pork belly stir-fry',
          quantity: 1,
          unit: 'serving',
          calories: 620,
          proteinG: 0,
          carbsG: 0,
          fatG: 0,
          isManualAddition: false,
        },
        {
          name: 'Gochujang',
          quantity: 30,
          unit: 'g',
          calories: 0,
          proteinG: 0,
          carbsG: 0,
          fatG: 0,
          isManualAddition: false,
          canonicalId: 'gochujang',
        },
      ],
    });
    const initial = await depleteForMeal(meal);
    expect(initial.names).toEqual(['Gochujang']);
    expect((await getPantryItem(gochujang.id))?.usesCount).toBe(1);

    // The user then photographs the actual finished plate, replacing the
    // logged items outright — the existing edit path (reverse, then
    // reapply), not a parallel one (task 7.3).
    const canonicals = new Map((await getAllCanonicals()).map((c) => [c.id, c]));
    const photographed = planDepletion({
      venue: 'home',
      servingsMult: 1,
      ingredients: [{ canonicalId: 'chicken-breast', quantity: 180, unit: 'g', kind: 'meal_item' }],
      catalogue: await listPantryItems(),
      canonicals,
    });
    await reapplyDepletion(meal.id, photographed, 1);

    // The suggestion's gochujang use is gone, not merely added to.
    expect((await getPantryItem(gochujang.id))?.usesCount).toBe(0);
    expect((await getPantryItem(chicken.id))?.qtyRemaining).toBe(820);
  });
});
