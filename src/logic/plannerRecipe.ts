import type { ExclusionSet } from '@/logic/dietary';
import { normalise } from '@/logic/normalise';
import { catalogueNutrition } from '@/logic/nutrition';
import { sumNutrition, scaleNutrition } from '@/logic/plannerNutrition';
import type {
  ApplianceId,
  CanonicalItem,
  CookingGuideStep,
  MealPrepTemplate,
  PlannedMealType,
  PlannerNutrition,
  PlannerRecipeIngredientSnapshot,
  PlannerRecipeSnapshot,
  RecipeWithIngredients,
} from '@/types';

const UNKNOWN_NUTRITION: PlannerNutrition = {
  calories: null, proteinG: null, carbsG: null, fatG: null, fibreG: null, source: null,
};

function ingredientNutrition(
  canonical: CanonicalItem | undefined,
  quantity: number | null,
  unit: PlannerRecipeIngredientSnapshot['unit'],
): PlannerNutrition {
  if (!canonical || quantity === null || unit === null) return { ...UNKNOWN_NUTRITION };
  const result = catalogueNutrition(canonical, quantity, unit);
  if (!result) return { ...UNKNOWN_NUTRITION };
  return {
    calories: result.values.calories,
    proteinG: result.values.proteinG,
    carbsG: result.values.carbsG,
    fatG: result.values.fatG,
    fibreG: result.values.fibreG ?? null,
    source: 'canonical_catalogue',
  };
}

function finishSnapshot(
  snapshot: Omit<PlannerRecipeSnapshot, 'nutritionPerPortion'>,
): PlannerRecipeSnapshot {
  const included = snapshot.ingredients.filter((ingredient) => ingredient.included);
  const total = sumNutrition(included.map((ingredient) => ingredient.nutrition));
  return { ...snapshot, nutritionPerPortion: scaleNutrition(total, 1 / snapshot.baseYield) };
}

export function snapshotMealPrepTemplate(params: {
  template: MealPrepTemplate;
  canonicals: ReadonlyMap<string, CanonicalItem>;
  snapshotId: string;
  ingredientId: () => string;
  mealTypes: readonly PlannedMealType[];
  cuisines?: readonly string[];
  createdAt?: string;
}): PlannerRecipeSnapshot {
  const { template, canonicals } = params;
  if (!Number.isFinite(template.portions) || template.portions <= 0) throw new Error('Recipe yield must be reviewed');
  const ingredients = template.ingredients.map((ingredient): PlannerRecipeIngredientSnapshot => ({
    id: params.ingredientId(), canonicalId: ingredient.canonicalId, name: ingredient.name,
    quantity: ingredient.quantity, unit: ingredient.unit, preparation: null,
    optional: ingredient.optional ?? false, included: true,
    nutrition: ingredientNutrition(canonicals.get(ingredient.canonicalId), ingredient.quantity, ingredient.unit),
  }));
  return finishSnapshot({
    id: params.snapshotId, sourceKind: 'starter', sourceId: template.id,
    sourceVersion: '1', title: template.title, mealTypes: params.mealTypes,
    cuisines: params.cuisines ?? [], baseYield: template.portions,
    durationMinutes: template.durationMinutes, requiredAppliances: template.requiredAppliances,
    ingredients, steps: template.steps, createdAt: params.createdAt ?? new Date().toISOString(),
  });
}

export function snapshotSavedRecipe(params: {
  recipe: RecipeWithIngredients;
  reviewedYield: number;
  canonicals: ReadonlyMap<string, CanonicalItem>;
  snapshotId: string;
  ingredientId: () => string;
  mealTypes: readonly PlannedMealType[];
  cuisines?: readonly string[];
  createdAt?: string;
}): PlannerRecipeSnapshot {
  if (!Number.isFinite(params.reviewedYield) || params.reviewedYield <= 0) throw new Error('Recipe yield must be reviewed');
  const ingredients = params.recipe.ingredients.map((ingredient): PlannerRecipeIngredientSnapshot => ({
    id: params.ingredientId(), canonicalId: ingredient.canonicalId, name: ingredient.name,
    quantity: ingredient.quantity, unit: ingredient.unit, preparation: null,
    optional: false, included: true,
    nutrition: ingredientNutrition(ingredient.canonicalId ? params.canonicals.get(ingredient.canonicalId) : undefined, ingredient.quantity, ingredient.unit),
  }));
  const steps: CookingGuideStep[] = params.recipe.steps.map((instruction, index) => ({
    stepNumber: index + 1, instruction, applianceId: null, actionType: 'cook', durationMinutes: null,
  }));
  return finishSnapshot({
    id: params.snapshotId, sourceKind: 'saved_recipe', sourceId: params.recipe.id,
    sourceVersion: params.recipe.updatedAt, title: params.recipe.title,
    mealTypes: params.mealTypes, cuisines: params.cuisines ?? [], baseYield: params.reviewedYield,
    durationMinutes: null, requiredAppliances: [], ingredients, steps,
    createdAt: params.createdAt ?? new Date().toISOString(),
  });
}

/**
 * What a person should see before a recipe goes onto their plan.
 *
 * Three separate answers, kept apart because they mean different things: an
 * ingredient a recorded rule actually excludes, an ingredient whose identity is
 * unresolved and therefore *cannot* be checked, and equipment the recipe needs
 * that is not recorded as owned. The second is the one this app refuses to
 * collapse into either of the others — "we could not check this" is not
 * "this is fine", and it is not "this is excluded" either.
 *
 * Nothing here filters. Planning is the person's choice and every recipe stays
 * selectable; this only makes sure the choice is informed.
 */
export interface PlannerRecipeReview {
  /** Ingredients a recorded allergen or restriction excludes. */
  excluded: readonly { name: string; canonicalId: string | null }[];
  /** Ingredients whose identity did not resolve, so no rule could be applied. */
  unverified: readonly string[];
  /** Required appliances not recorded as owned. Empty when ownership is unknown. */
  missingAppliances: readonly ApplianceId[];
  /** False when no appliance ownership has ever been recorded. */
  applianceOwnershipKnown: boolean;
}

export function reviewPlannerRecipe(params: {
  recipe: PlannerRecipeSnapshot;
  exclusions: ExclusionSet;
  /** Null when the person has never answered the appliance question. */
  ownedApplianceIds: ReadonlySet<ApplianceId> | null;
}): PlannerRecipeReview {
  const excluded: { name: string; canonicalId: string | null }[] = [];
  const unverified: string[] = [];

  for (const ingredient of params.recipe.ingredients) {
    if (!ingredient.included) continue;
    if (ingredient.canonicalId !== null) {
      if (params.exclusions.canonicalIds.has(ingredient.canonicalId)) {
        excluded.push({ name: ingredient.name, canonicalId: ingredient.canonicalId });
      }
      continue;
    }
    if (params.exclusions.unresolvedText.has(normalise(ingredient.name))) {
      excluded.push({ name: ingredient.name, canonicalId: null });
      continue;
    }
    // Unresolved, so no rule could be applied to it. Marked unverified rather
    // than assumed compatible.
    unverified.push(ingredient.name);
  }

  const applianceOwnershipKnown = params.ownedApplianceIds !== null;
  const missingAppliances = applianceOwnershipKnown
    ? params.recipe.requiredAppliances.filter((id) => !params.ownedApplianceIds!.has(id))
    : [];

  return { excluded, unverified, missingAppliances, applianceOwnershipKnown };
}

export function plannerRecipeEligible(params: {
  recipe: PlannerRecipeSnapshot;
  mealType?: PlannedMealType;
  cuisine?: string;
  ownedAppliances?: ReadonlySet<string>;
  excludedCanonicalIds?: ReadonlySet<string>;
}): boolean {
  const { recipe } = params;
  if (params.mealType && !recipe.mealTypes.includes(params.mealType)) return false;
  if (params.cuisine && !recipe.cuisines.some((cuisine) => cuisine.toLowerCase() === params.cuisine!.toLowerCase())) return false;
  if (params.ownedAppliances && !recipe.requiredAppliances.every((id) => params.ownedAppliances!.has(id))) return false;
  if (params.excludedCanonicalIds && recipe.ingredients.some((ingredient) =>
    ingredient.included && (ingredient.canonicalId === null || params.excludedCanonicalIds!.has(ingredient.canonicalId)))) return false;
  return true;
}
