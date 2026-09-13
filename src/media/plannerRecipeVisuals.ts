import type { ImageSourcePropType } from "react-native";

import canonicalSeed from "../../assets/canonical-items.json";
import { dishIllustrationFor } from "@/media/dishIllustrations";
import { PLANNER_CATALOGUE } from "@/logic/plannerCatalogue";
import { STARTER_MEAL_PREP_TEMPLATES } from "@/logic/mealPrepTemplates";
import type { FoodClass, PlannerRecipeSnapshot } from "@/types";

/**
 * Which picture a planner recipe gets, decided from its stable identity.
 *
 * The rule the rest of the planner depends on: **artwork is claimed by id, not
 * by name.** Two recipes can be called "Miso soup with tofu" — one the app
 * authored and one someone saved from a friend — and only the authored one has
 * a painting of itself. Renaming the authored one does not lose its art either,
 * because the title was never what selected it.
 *
 * The order is photo, authored artwork, then the procedural plate. A photo is
 * the person's own record of the dish and outranks anything shipped; the plate
 * is the honest bottom, stating only the food classes the recipe's ingredients
 * actually resolve to.
 */

/** Every id that may claim authored dish art. Nothing outside these two lists. */
export const AUTHORED_DISH_IDS: ReadonlySet<string> = new Set([
  ...STARTER_MEAL_PREP_TEMPLATES.map((template) => template.id),
  ...PLANNER_CATALOGUE.map((recipe) => recipe.id),
]);

/**
 * Food class per shipped canonical ingredient, read from the bundled seed.
 *
 * The database holds the same classes and more besides, but a list row cannot
 * wait on a query to know whether to draw a green wedge or a red one. An
 * ingredient the seed does not know contributes nothing rather than a guess,
 * which is the same answer the plate gives for an unresolved ingredient.
 */
const SEED_FOOD_CLASS: ReadonlyMap<string, FoodClass> = new Map(
  (canonicalSeed as readonly { id: string; class: FoodClass }[]).map((item) => [item.id, item.class]),
);

export function foodClassOfCanonical(canonicalId?: string | null): FoodClass | null {
  if (!canonicalId) return null;
  return SEED_FOOD_CLASS.get(canonicalId) ?? null;
}

export interface PlannerRecipeVisualSource {
  /** The person's own photo of the dish. Always wins when it loads. */
  photoUri?: string | null;
  /** `starter` is the app's own authored collection; `saved_recipe` is theirs. */
  sourceKind?: PlannerRecipeSnapshot["sourceKind"] | null;
  /** The stable id the plan was built from. Never the title. */
  sourceId?: string | null;
  /** Used only to derive a stable plating angle for the procedural fallback. */
  title?: string | null;
  /** Canonical ids of the ingredients actually in the dish. */
  canonicalIds?: readonly (string | null | undefined)[];
}

export type ResolvedPlannerRecipeVisual =
  | { kind: "photo"; uri: string }
  | { kind: "authored"; assetId: string; source: ImageSourcePropType }
  | { kind: "plate"; title: string | null; foodClasses: readonly (FoodClass | null)[] };

/**
 * The authored artwork id for a recipe, or `null`.
 *
 * Two independent gates, both required: the snapshot must say it came from the
 * authored collection, and the id must be in the bounded set that collection
 * actually publishes. A saved recipe cannot reach artwork, and neither can a
 * `starter` id that no longer exists.
 */
export function authoredDishArtIdFor(
  sourceKind?: PlannerRecipeSnapshot["sourceKind"] | null,
  sourceId?: string | null,
): string | null {
  if (sourceKind !== "starter" || !sourceId) return null;
  return AUTHORED_DISH_IDS.has(sourceId) ? sourceId : null;
}

/**
 * The best visual this recipe can honestly show, skipping any tier whose key is
 * in `failed`.
 *
 * `failed` is how a broken photo file or a missing bundled asset reaches the
 * next tier instead of leaving a hole: the component records the key that
 * errored and asks again.
 */
export function resolvePlannerRecipeVisual(
  source: PlannerRecipeVisualSource,
  failed: ReadonlySet<string> = new Set(),
): ResolvedPlannerRecipeVisual {
  const photoUri = source.photoUri?.trim();
  if (photoUri && !failed.has(photoUri)) {
    return { kind: "photo", uri: photoUri };
  }

  const assetId = authoredDishArtIdFor(source.sourceKind, source.sourceId);
  if (assetId && !failed.has(authoredVisualKey(assetId))) {
    const art = dishIllustrationFor(assetId);
    if (art) return { kind: "authored", assetId, source: art };
  }

  return {
    kind: "plate",
    title: source.title ?? null,
    foodClasses: (source.canonicalIds ?? []).map((id) => foodClassOfCanonical(id)),
  };
}

/** The `failed` key for a piece of bundled artwork, kept distinct from a URI. */
export function authoredVisualKey(assetId: string): string {
  return `authored:${assetId}`;
}

/** The visual identity of a scheduled meal, taken from its stored snapshot. */
export function plannerVisualFromSnapshot(
  snapshot: PlannerRecipeSnapshot,
  photoUri?: string | null,
): PlannerRecipeVisualSource {
  return {
    photoUri,
    sourceKind: snapshot.sourceKind,
    sourceId: snapshot.sourceId,
    title: snapshot.title,
    canonicalIds: snapshot.ingredients
      .filter((ingredient) => ingredient.included)
      .map((ingredient) => ingredient.canonicalId),
  };
}

/**
 * The identity a collection recipe carries before it is snapshotted. Structural
 * on purpose, so both the authored catalogue and the starter templates fit it.
 */
export interface AuthoredRecipeIdentity {
  id: string;
  title: string;
  ingredients: readonly { canonicalId: string }[];
}

/** The visual identity of a collection recipe, before anything is scheduled. */
export function plannerVisualFromCatalogue(
  recipe: AuthoredRecipeIdentity,
): PlannerRecipeVisualSource {
  return {
    sourceKind: "starter",
    sourceId: recipe.id,
    title: recipe.title,
    canonicalIds: recipe.ingredients.map((ingredient) => ingredient.canonicalId),
  };
}
