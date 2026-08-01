import { beforeEach, describe, expect, test } from 'vitest';

import hiddenIngredients from '../assets/hidden-ingredients.json';
import {
  getAllCanonicals,
  getConsumptionEvents,
  getPantryItem,
  insertMeal,
  insertPantryItem,
  loadSeedData,
} from '../src/db/queries';
import { depleteForMeal } from '../src/logic/depletionService';
import type { HiddenIngredient, MealWithItems } from '../src/types';
import { openTestDatabase } from './stubs/db';

/**
 * Hidden-ingredient quick-picks are the seasoning path that actually
 * carries data: tapping "Olive oil, 1 tbsp" already adds calories, and it
 * must also debit the oil (decision 13).
 */

const QUICK_PICKS = hiddenIngredients as HiddenIngredient[];

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
});

async function commitMeal(
  items: { name: string; quantity: number; unit: 'tbsp' | 'g'; calories: number }[],
): Promise<MealWithItems> {
  const meal = await insertMeal({
    loggedAt: new Date().toISOString(),
    localDate: '2026-06-01',
    mealType: 'dinner',
    name: 'Test meal',
    photoUri: null,
    source: 'manual',
    confidence: null,
    venue: 'home',
    items: items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      calories: item.calories,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      isManualAddition: true,
    })),
  });
  await depleteForMeal(meal);
  return meal;
}

describe('quick-picks carry their pantry side', () => {
  test('every shipped quick-pick points at a canonical that exists', async () => {
    const ids = new Set((await getAllCanonicals()).map((c) => c.id));
    for (const pick of QUICK_PICKS) {
      if (pick.canonicalId) {
        expect(ids, `${pick.name} → ${pick.canonicalId}`).toContain(
          pick.canonicalId,
        );
      }
    }
  });

  test('adding the olive oil quick-pick debits the oil', async () => {
    const oil = await insertPantryItem({
      canonicalId: 'olive-oil',
      locationId: 'pantry',
      qtyRemaining: 750,
      qtyUnit: 'ml',
    });

    const meal = await commitMeal([
      { name: 'Olive oil', quantity: 1, unit: 'tbsp', calories: 119 },
    ]);

    // 1 tbsp = 15 ml, straight off the fixed volume table.
    const after = await getPantryItem(oil.id);
    expect(after?.qtyRemaining).toBeCloseTo(735);

    const events = await getConsumptionEvents(meal.id);
    expect(events.length).toBe(1);
    expect(events[0]?.kind).toBe('hidden_ingredient');
    expect(events[0]?.pantryItemId).toBe(oil.id);
  });

  test('the calories are the meal’s regardless of what the pantry does', async () => {
    // No olive oil in the catalogue at all.
    const meal = await commitMeal([
      { name: 'Olive oil', quantity: 1, unit: 'tbsp', calories: 119 },
    ]);
    expect(meal.items[0]?.calories).toBe(119);

    // Recorded against the canonical, with no item and nothing created.
    const events = await getConsumptionEvents(meal.id);
    expect(events[0]?.pantryItemId).toBeNull();
    expect(events[0]?.canonicalId).toBe('olive-oil');
  });

  test('an unmapped quick-pick contributes calories and decrements nothing', async () => {
    const oil = await insertPantryItem({
      canonicalId: 'olive-oil',
      locationId: 'pantry',
      qtyRemaining: 750,
      qtyUnit: 'ml',
    });

    // A name no quick-pick and no alias knows.
    const meal = await commitMeal([
      { name: 'Grandmother’s secret sauce', quantity: 1, unit: 'tbsp', calories: 80 },
    ]);

    expect(meal.items[0]?.calories).toBe(80);
    expect((await getPantryItem(oil.id))?.qtyRemaining).toBe(750);
  });
});
