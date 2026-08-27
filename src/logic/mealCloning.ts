import type { NewMeal } from '@/db/queries';
import type { MealVenue, MealWithItems } from '@/types';

export type QuickRelogVenue = Extract<MealVenue, 'home' | 'leftovers'>;

/** Creates a new editable review draft without carrying historical row ids. */
export function cloneMealForLogging(
  meal: MealWithItems,
  targetDate: string,
  venue: QuickRelogVenue = 'leftovers',
  now: Date = new Date(),
): NewMeal {
  return {
    loggedAt: now.toISOString(),
    localDate: targetDate,
    mealType: meal.mealType,
    name: meal.name,
    photoUri: null,
    source: 'manual',
    confidence: null,
    venue,
    servingsMult: venue === 'home' ? Math.max(1, meal.servingsMult) : 1,
    items: meal.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      calories: item.calories,
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
      fibreG: item.fibreG,
      isManualAddition: item.isManualAddition,
      canonicalId: item.canonicalId,
    })),
  };
}
