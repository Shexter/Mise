import { beforeEach, describe, expect, test } from 'vitest';

import {
  applyDepletion,
  getConsumptionEvents,
  getMeal,
  getPantryItem,
  insertMeal,
  insertPantryItem,
  loadSeedData,
  updateMealWithDepletion,
  type MealEditFailureStage,
} from '../src/db/queries';
import type { Decrement } from '../src/logic/deplete';
import { saveEditedMeal } from '../src/logic/depletionService';
import type { MealWithItems } from '../src/types';
import { openTestDatabase } from './stubs/db';

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
});

async function fixture(): Promise<{
  meal: MealWithItems;
  pantryId: string;
  decrement: Decrement;
}> {
  const pantry = await insertPantryItem({
    canonicalId: 'jasmine-rice', locationId: 'pantry',
    qtyRemaining: 1000, qtyUnit: 'g',
  });
  const meal = await insertMeal({
    loggedAt: '2026-08-08T19:00:00.000Z', localDate: '2026-08-08',
    mealType: 'dinner', name: 'Rice', photoUri: 'file:///rice.jpg',
    source: 'photo', confidence: 'medium', venue: 'home', servingsMult: 1,
    items: [{
      name: 'Rice', quantity: 100, unit: 'g', calories: 130,
      proteinG: 2, carbsG: 28, fatG: 0, isManualAddition: false,
      canonicalId: 'jasmine-rice',
    }],
  });
  const decrement: Decrement = {
    pantryItemId: pantry.id, canonicalId: 'jasmine-rice', qty: 100,
    unit: 'g', uses: 1, kind: 'meal_item',
  };
  await applyDepletion(meal.id, [decrement], 1);
  return { meal, pantryId: pantry.id, decrement };
}

describe('atomic meal editing', () => {
  test('plans against virtually restored stock when the old meal marked it out', async () => {
    const pantry = await insertPantryItem({
      canonicalId: 'jasmine-rice', locationId: 'pantry',
      qtyRemaining: 100, qtyUnit: 'g',
    });
    const meal = await insertMeal({
      loggedAt: '2026-08-08T19:00:00.000Z', localDate: '2026-08-08',
      mealType: 'dinner', name: 'Rice', photoUri: null, source: 'manual',
      confidence: null, venue: 'home', servingsMult: 1,
      items: [{ name: 'Rice', quantity: 100, unit: 'g', calories: 130,
        proteinG: 2, carbsG: 28, fatG: 0, isManualAddition: true,
        canonicalId: 'jasmine-rice' }],
    });
    await applyDepletion(meal.id, [{
      pantryItemId: pantry.id, canonicalId: 'jasmine-rice', qty: 100,
      unit: 'g', uses: 1, kind: 'meal_item',
    }], 1);
    expect((await getPantryItem(pantry.id))?.status).toBe('out');

    await saveEditedMeal({
      ...meal,
      items: [{ ...meal.items[0]!, quantity: 50 }],
    });
    expect((await getPantryItem(pantry.id))?.qtyRemaining).toBe(50);
  });

  test('replaces metadata and ordered items while preserving provenance', async () => {
    const { meal, pantryId, decrement } = await fixture();
    const added = { ...meal.items[0]!, id: 'added-item', name: 'Egg', canonicalId: null };
    const edited = {
      ...meal,
      name: 'Corrected bowl', mealType: 'lunch' as const, servingsMult: 2,
      items: [added, { ...meal.items[0]!, quantity: 150 }],
    };
    const corrected = { ...decrement, qty: 300 };
    const stored = await updateMealWithDepletion(edited, [corrected]);

    expect(stored.items.map((item) => [item.id, item.sortOrder])).toEqual([
      ['added-item', 0], [meal.items[0]!.id, 1],
    ]);
    expect(stored).toMatchObject({
      id: meal.id, loggedAt: meal.loggedAt, localDate: meal.localDate,
      source: meal.source, confidence: meal.confidence, photoUri: meal.photoUri,
      createdAt: meal.createdAt, name: 'Corrected bowl', mealType: 'lunch',
    });
    expect((await getPantryItem(pantryId))?.qtyRemaining).toBe(700);
    expect(await getConsumptionEvents(meal.id)).toHaveLength(1);
  });

  test.each(['out', 'leftovers'] as const)(
    'home to %s restores old depletion and forces servings to one',
    async (venue) => {
      const { meal, pantryId } = await fixture();
      const stored = await updateMealWithDepletion(
        { ...meal, venue, servingsMult: 8 },
        [],
      );
      expect(stored.servingsMult).toBe(1);
      expect((await getPantryItem(pantryId))?.qtyRemaining).toBe(1000);
      expect(await getConsumptionEvents(meal.id)).toEqual([]);
    },
  );

  test.each(['out', 'leftovers'] as const)(
    '%s to home applies corrected depletion',
    async (startingVenue) => {
      const pantry = await insertPantryItem({
        canonicalId: 'jasmine-rice', locationId: 'pantry',
        qtyRemaining: 1000, qtyUnit: 'g',
      });
      const meal = await insertMeal({
        loggedAt: '2026-08-08T19:00:00.000Z', localDate: '2026-08-08',
        mealType: 'dinner', name: 'Rice', photoUri: null, source: 'manual',
        confidence: null, venue: startingVenue, servingsMult: 7,
        items: [{ name: 'Rice', quantity: 100, unit: 'g', calories: 130,
          proteinG: 2, carbsG: 28, fatG: 0, isManualAddition: true,
          canonicalId: 'jasmine-rice' }],
      });
      await updateMealWithDepletion(
        { ...meal, venue: 'home', servingsMult: 2 },
        [{ pantryItemId: pantry.id, canonicalId: 'jasmine-rice', qty: 200,
          unit: 'g', uses: 2, kind: 'meal_item' }],
      );
      expect((await getPantryItem(pantry.id))?.qtyRemaining).toBe(800);
    },
  );

  test('replaces rather than appends the item set', async () => {
    const { meal, decrement } = await fixture();
    const replacement = {
      ...meal.items[0]!, id: 'replacement-item', name: 'Egg',
      canonicalId: null, quantity: 2,
    };
    await updateMealWithDepletion({ ...meal, items: [replacement] }, [decrement]);
    const stored = await getMeal(meal.id);
    expect(stored?.items.map((item) => item.id)).toEqual(['replacement-item']);
  });

  test.each<MealEditFailureStage>(['meal', 'item', 'pantry', 'event'])(
    'rolls back every row when the %s stage fails',
    async (failAt) => {
      const { meal, pantryId, decrement } = await fixture();
      const beforeMeal = await getMeal(meal.id);
      const beforePantry = await getPantryItem(pantryId);
      const beforeEvents = await getConsumptionEvents(meal.id);

      await expect(
        updateMealWithDepletion(
          { ...meal, name: 'Should roll back', items: [{ ...meal.items[0]!, quantity: 250 }] },
          [{ ...decrement, qty: 250 }],
          { failAt },
        ),
      ).rejects.toThrow('Injected');

      expect(await getMeal(meal.id)).toEqual(beforeMeal);
      expect(await getPantryItem(pantryId)).toEqual(beforePantry);
      expect(await getConsumptionEvents(meal.id)).toEqual(beforeEvents);
    },
  );
});
