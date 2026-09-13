import { randomUUID } from 'expo-crypto';

import { snapshotMealPrepTemplate } from '@/logic/plannerRecipe';
import type { CanonicalItem, MealPrepTemplate, PlannedMealType, PlannerRecipeSnapshot, Suggestion } from '@/types';

/**
 * Turns a dinner suggestion into a planner snapshot so it can fill a dated slot.
 *
 * Deliberately routed through the same `snapshotMealPrepTemplate` every other
 * recipe uses, so nutrition is recomputed from the catalogue against the stated
 * ingredient amounts rather than trusting the suggestion's own whole-dish
 * estimate. An ingredient the catalogue cannot price stays unknown.
 *
 * The suggestion's own `missing` list is not carried over: those are ingredients
 * the pantry lacks, and a planned meal is expected to need shopping.
 */
export function suggestionToSnapshot(params: {
  suggestion: Suggestion;
  canonicals: ReadonlyMap<string, CanonicalItem>;
  mealType: PlannedMealType;
}): PlannerRecipeSnapshot {
  const { suggestion, canonicals } = params;
  const template: MealPrepTemplate = {
    id: `dinner:${suggestion.dish}`,
    title: suggestion.dish,
    portions: Math.max(1, Math.round(suggestion.servings)),
    durationMinutes: suggestion.effortMinutes > 0 ? suggestion.effortMinutes : null,
    requiredAppliances: [],
    ingredients: suggestion.uses.map((use) => ({
      canonicalId: use.canonicalId,
      name: canonicals.get(use.canonicalId)?.displayName ?? use.canonicalId,
      quantity: use.qty,
      unit: use.unit,
    })),
    steps: suggestion.method.map((instruction, index) => ({
      stepNumber: index + 1,
      instruction,
      applianceId: null,
      actionType: 'cook' as const,
    })),
  };

  return snapshotMealPrepTemplate({
    template,
    canonicals,
    snapshotId: randomUUID(),
    ingredientId: randomUUID,
    mealTypes: [params.mealType],
    cuisines: [],
  });
}
