import { STARTER_MEAL_PREP_TEMPLATES } from './mealPrepTemplates';
import type {
  ApplianceId,
  MealPrepIngredient,
  MealPrepPlan,
  MealPrepTemplate,
} from '@/types';

export interface TemplateMatchScore {
  template: MealPrepTemplate;
  confirmedIngredients: MealPrepIngredient[];
  missingIngredients: MealPrepIngredient[];
  score: number; // Matched required ingredient count
  matchRatio: number; // Matched / total non-optional ingredients
}

/**
 * Checks if a template can be cooked with the owned appliances and dietary rules.
 */
export function isTemplateEligible(
  template: MealPrepTemplate,
  ownedAppliances: ReadonlySet<ApplianceId>,
  excludedCanonicalIds: ReadonlySet<string> = new Set(),
): boolean {
  // 1. Appliance check: all required appliances must be owned
  const hasAppliances = template.requiredAppliances.every((appliance) =>
    ownedAppliances.has(appliance),
  );
  if (!hasAppliances) return false;

  // 2. Dietary check: no ingredient may be in the excluded canonical items set
  const hasDietaryConflict = template.ingredients.some((ingredient) =>
    excludedCanonicalIds.has(ingredient.canonicalId),
  );
  if (hasDietaryConflict) return false;

  return true;
}

/**
 * Matches a template against confirmed pantry items.
 */
export function matchTemplateToPantry(
  template: MealPrepTemplate,
  confirmedPantryCanonicalIds: ReadonlySet<string>,
): TemplateMatchScore {
  const confirmedIngredients: MealPrepIngredient[] = [];
  const missingIngredients: MealPrepIngredient[] = [];

  for (const item of template.ingredients) {
    const isPresent = confirmedPantryCanonicalIds.has(item.canonicalId);
    const ingredientObj: MealPrepIngredient = {
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      canonicalId: item.canonicalId,
    };

    if (isPresent) {
      confirmedIngredients.push(ingredientObj);
    } else {
      missingIngredients.push(ingredientObj);
    }
  }

  const requiredCount = template.ingredients.filter((i) => !i.optional).length || 1;
  const matchedCount = confirmedIngredients.length;
  const matchRatio = matchedCount / requiredCount;

  return {
    template,
    confirmedIngredients,
    missingIngredients,
    score: matchedCount,
    matchRatio,
  };
}

/**
 * Builds a concrete MealPrepPlan from an eligible template and pantry state.
 */
export function buildMealPrepPlan(
  template: MealPrepTemplate,
  confirmedPantryCanonicalIds: ReadonlySet<string>,
): MealPrepPlan {
  const match = matchTemplateToPantry(template, confirmedPantryCanonicalIds);

  return {
    id: `plan-${template.id}`,
    templateId: template.id,
    title: template.title,
    portions: template.portions,
    durationMinutes: template.durationMinutes,
    confirmedIngredients: match.confirmedIngredients,
    missingIngredients: match.missingIngredients,
    requiredAppliances: [...template.requiredAppliances],
    steps: [...template.steps],
  };
}

/**
 * Finds all eligible templates, ranks them by pantry coverage, and returns built plans.
 */
export function findEligibleMealPrepPlans(params: {
  ownedAppliances: ReadonlySet<ApplianceId>;
  confirmedPantryCanonicalIds: ReadonlySet<string>;
  excludedCanonicalIds?: ReadonlySet<string>;
  templates?: readonly MealPrepTemplate[];
}): MealPrepPlan[] {
  const {
    ownedAppliances,
    confirmedPantryCanonicalIds,
    excludedCanonicalIds = new Set(),
    templates = STARTER_MEAL_PREP_TEMPLATES,
  } = params;

  const eligible = templates.filter((template) =>
    isTemplateEligible(template, ownedAppliances, excludedCanonicalIds),
  );

  const scored = eligible.map((template) =>
    matchTemplateToPantry(template, confirmedPantryCanonicalIds),
  );

  // Sort by highest match score first, then highest ratio, then shortest duration
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.matchRatio !== a.matchRatio) return b.matchRatio - a.matchRatio;
    return (a.template.durationMinutes ?? 999) - (b.template.durationMinutes ?? 999);
  });

  return scored.map((match) => ({
    id: `plan-${match.template.id}`,
    templateId: match.template.id,
    title: match.template.title,
    portions: match.template.portions,
    durationMinutes: match.template.durationMinutes,
    confirmedIngredients: match.confirmedIngredients,
    missingIngredients: match.missingIngredients,
    requiredAppliances: [...match.template.requiredAppliances],
    steps: [...match.template.steps],
  }));
}
