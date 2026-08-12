import { mealFromSuggestion } from '@/logic/suggestionService';
import type { CanonicalItem, PantryItem, RecipeWithIngredients, Suggestion } from '@/types';

/** Current, deliberately non-persisted coverage for a saved recipe. */
export interface RecipeCoverage {
  held: readonly string[];
  missing: readonly string[];
  unresolved: readonly string[];
}

/**
 * Coverage is derived at view time. An unresolved ingredient can never be
 * reported as held: no canonical identity means there is no honest comparison.
 */
export function coverageForRecipe(
  recipe: RecipeWithIngredients,
  pantry: readonly PantryItem[],
): RecipeCoverage {
  const heldIds = new Set(
    pantry
      .filter((item) => item.status === 'in_stock' || item.status === 'running_low')
      .map((item) => item.canonicalId),
  );
  const held: string[] = [];
  const missing: string[] = [];
  const unresolved: string[] = [];
  for (const ingredient of recipe.ingredients) {
    if (!ingredient.canonicalId) {
      unresolved.push(ingredient.name);
    } else if (heldIds.has(ingredient.canonicalId)) {
      held.push(ingredient.name);
    } else {
      missing.push(ingredient.name);
    }
  }
  return { held, missing, unresolved };
}

/**
 * Converts stated, resolved recipe ingredients into the ordinary meal shape.
 * Ingredients without a quantity stay in the recipe but are omitted here so
 * cooking never guesses a depletion amount.
 */
export function mealFromRecipe(input: {
  recipe: RecipeWithIngredients;
  localDate: string;
  servingsMade?: number;
  canonicals: ReadonlyMap<string, CanonicalItem>;
}) {
  const stated = input.recipe.ingredients.filter(
    (ingredient): ingredient is typeof ingredient & { quantity: number; unit: NonNullable<typeof ingredient.unit>; canonicalId: string } =>
      ingredient.quantity !== null && ingredient.unit !== null && ingredient.canonicalId !== null,
  );
  const suggestion: Suggestion = {
    dish: input.recipe.title,
    reasons: [],
    kcalPerServing: 0,
    servings: 1,
    effortMinutes: 0,
    uses: stated.map((ingredient) => ({
      canonicalId: ingredient.canonicalId,
      qty: ingredient.quantity,
      unit: ingredient.unit,
    })),
    missing: [],
    method: [],
  };
  // Keep the existing meal construction and depletion-compatible item shape;
  // only provenance differs, so history can tell a saved recipe from an idea.
  return { ...mealFromSuggestion({ suggestion, servingsMade: input.servingsMade ?? 1, localDate: input.localDate, canonicals: input.canonicals }), source: 'recipe' as const };
}
