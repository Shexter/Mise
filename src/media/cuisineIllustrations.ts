import type { ImageSourcePropType } from "react-native";

/**
 * Artwork for the chooser's cuisine filters, keyed by stable cuisine id.
 *
 * These are **filter symbols, not dish claims**. A plate of nigiri labels
 * Japanese; it does not say the recipe you pick will be sushi. That is the
 * whole difference between this registry and `DISH_ILLUSTRATIONS`, where a
 * picture is a claim about one specific authored recipe and may only depict
 * ingredients that recipe actually lists.
 *
 * The registry is not the source of truth for which cuisines exist — that is
 * `src/logic/cuisines.ts`, which reads the reviewed recipes. A cuisine with no
 * entry here still appears in the rail, with its label on a plain tile, because
 * the coverage is real whether or not the painting has been accepted yet.
 *
 * Generated block of static `require()` literals, rewritten by
 * `scripts/generate-illustrations.ts --promote` and held to
 * `assets/illustrations/manifest.json` by `test/illustration-registries.test.ts`.
 * It is empty until a named human accepts the candidates; staged art is never
 * referenced from here.
 */

export const CUISINE_ILLUSTRATIONS: Record<string, ImageSourcePropType> = {
  "chinese": require("../../assets/illustrations/cuisine/chinese.webp"),
  "international": require("../../assets/illustrations/cuisine/international.webp"),
  "italian": require("../../assets/illustrations/cuisine/italian.webp"),
  "japanese": require("../../assets/illustrations/cuisine/japanese.webp"),
  "mediterranean": require("../../assets/illustrations/cuisine/mediterranean.webp"),
};

/**
 * The artwork for a cuisine, or `null` when it has none.
 *
 * `null` is the ordinary answer while a pack is still in review, and the
 * caller's job is to render the labelled fallback rather than to borrow another
 * cuisine's picture.
 */
export function cuisineIllustrationFor(cuisineId?: string | null): ImageSourcePropType | null {
  if (!cuisineId) return null;
  return CUISINE_ILLUSTRATIONS[cuisineId] ?? null;
}
