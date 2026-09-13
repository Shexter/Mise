import { projectRecipeQuantity, scaleNutrition } from '@/logic/plannerNutrition';
import type { NewMeal } from '@/db/queries';
import type { PlannedMealSlot, PlannerRecipeSnapshot } from '@/types';

export type PlannerMealReview =
  | { status: 'needs_review'; missingIngredientIds: readonly string[] }
  | { status: 'ready'; meal: NewMeal; eatenPortions: number; productionPortions: number };

/** Adapts a reviewed snapshot into the ordinary meal editor without inventing quantities. */
export function plannerMealReview(params: {
  snapshot: PlannerRecipeSnapshot;
  slot: PlannedMealSlot;
  actualLocalDate: string;
  actualLoggedAt: string;
  eatenPortions: number;
  productionPortions: number;
  venue?: NewMeal['venue'];
}): PlannerMealReview {
  if (![params.eatenPortions, params.productionPortions].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error('Consumed and produced portions must be positive');
  }
  const included = params.snapshot.ingredients.filter((ingredient) => ingredient.included);
  const missingIngredientIds = included
    .filter((ingredient) => ingredient.quantity === null || ingredient.unit === null)
    .map((ingredient) => ingredient.id);
  if (missingIngredientIds.length > 0) return { status: 'needs_review', missingIngredientIds };
  return {
    status: 'ready', eatenPortions: params.eatenPortions, productionPortions: params.productionPortions,
    meal: {
      loggedAt: params.actualLoggedAt,
      localDate: params.actualLocalDate,
      mealType: params.slot.mealType,
      name: params.snapshot.title,
      photoUri: null,
      source: 'recipe',
      confidence: null,
      venue: params.venue ?? 'home',
      servingsMult: params.productionPortions,
      items: included.map((ingredient) => {
        const nutrition = scaleNutrition(ingredient.nutrition, params.eatenPortions / params.snapshot.baseYield);
        return {
          name: ingredient.name,
          quantity: projectRecipeQuantity(ingredient.quantity, params.snapshot.baseYield, params.eatenPortions)!,
          unit: ingredient.unit!,
          calories: nutrition.calories,
          proteinG: nutrition.proteinG,
          carbsG: nutrition.carbsG,
          fatG: nutrition.fatG,
          fibreG: nutrition.fibreG,
          isManualAddition: false,
          canonicalId: ingredient.canonicalId,
        };
      }),
    },
  };
}
