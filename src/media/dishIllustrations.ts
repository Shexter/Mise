import type { ImageSourcePropType } from "react-native";

/**
 * Artwork for the dishes Mise itself proposes, keyed by meal-prep template id.
 *
 * **Only authored templates belong here.** `docs/asset-pipeline.md` records that
 * per-dish art is not generable because dishes are unbounded — which is true of
 * a recipe someone saved or a dinner a provider proposed, and not true of
 * `STARTER_MEAL_PREP_TEMPLATES`, which is a fixed list the project wrote down. A bounded
 * set of authored dishes can be drawn once and shipped; everything else keeps
 * the procedural `DishVisual` plate, composed from the food classes its own
 * ingredients belong to.
 *
 * So this registry is deliberately small and deliberately keyed by template id
 * rather than by dish title. A title is free text and two templates could drift
 * into sharing one; an id is the thing the plan was actually built from.
 *
 * Generated block of static `require()` literals, rewritten by
 * `scripts/generate-illustrations.ts --promote` and held to
 * `assets/illustrations/manifest.json` by `test/illustration-registries.test.ts`.
 */

export const DISH_ILLUSTRATIONS: Record<string, ImageSourcePropType> = {
  "air-fryer-crispy-tofu-bowl": require("../../assets/illustrations/dish/air-fryer-crispy-tofu-bowl.webp"),
  "microwave-steamed-salmon-greens": require("../../assets/illustrations/dish/microwave-steamed-salmon-greens.webp"),
  "no-cook-tofu-cucumber-bowl": require("../../assets/illustrations/dish/no-cook-tofu-cucumber-bowl.webp"),
  "rice-cooker-chicken-rice": require("../../assets/illustrations/dish/rice-cooker-chicken-rice.webp"),
  "sheet-pan-roasted-chicken-veg": require("../../assets/illustrations/dish/sheet-pan-roasted-chicken-veg.webp"),
  "slow-cooker-chicken-stew": require("../../assets/illustrations/dish/slow-cooker-chicken-stew.webp"),
  "stovetop-egg-fried-rice": require("../../assets/illustrations/dish/stovetop-egg-fried-rice.webp"),
};

/**
 * The artwork for a proposed dish, or `null` when it has none.
 *
 * `null` is the honest answer for every dish outside the authored set, and the
 * caller's job is to fall back to `DishVisual` rather than to borrow a picture
 * of a different dish.
 */
export function dishIllustrationFor(templateId?: string | null): ImageSourcePropType | null {
  if (!templateId) return null;
  return DISH_ILLUSTRATIONS[templateId] ?? null;
}
