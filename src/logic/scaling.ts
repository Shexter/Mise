import { EMPTY_MACROS, addMacros } from '@/logic/macros';
import type { Macros, MealItem, MealWithItems } from '@/types';

/**
 * Rescale an item to a new quantity. Calories and macros are stored for the whole
 * row, so they scale linearly with quantity.
 *
 * Preconditions:
 * item.quantity is greater than zero
 */
export function scaleItemQuantity(item: MealItem, nextQuantity: number): MealItem {
  if (item.quantity <= 0) return { ...item, quantity: nextQuantity };
  const factor = nextQuantity / item.quantity;
  return {
    ...item,
    quantity: nextQuantity,
    calories: item.calories * factor,
    proteinG: item.proteinG * factor,
    carbsG: item.carbsG * factor,
    fatG: item.fatG * factor,
  };
}

export function macrosOfItems(items: readonly MealItem[]): Macros {
  return items.reduce<Macros>(
    (acc, item) =>
      addMacros(acc, {
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
      }),
    EMPTY_MACROS,
  );
}

export function macrosOfMeals(meals: readonly MealWithItems[]): Macros {
  return meals.reduce<Macros>(
    (acc, meal) => addMacros(acc, macrosOfItems(meal.items)),
    EMPTY_MACROS,
  );
}

/** Display rounding: calories to integers, macro grams to one decimal. */
export function roundCalories(value: number): number {
  return Math.round(value);
}

export function roundGrams(value: number): number {
  return Math.round(value * 10) / 10;
}

export function formatGrams(value: number): string {
  const rounded = roundGrams(value);
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

/** Quantity display: drop the decimal when it adds nothing. */
export function formatQuantity(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded}`;
}
