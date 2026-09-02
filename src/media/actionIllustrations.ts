import type { ImageSourcePropType } from "react-native";

/**
 * Artwork for the four ways into Mise, shown on the centre add sheet.
 *
 * Generated block of static `require()` literals, rewritten by
 * `scripts/generate-illustrations.ts --promote` and held to
 * `assets/illustrations/manifest.json` by `test/illustration-registries.test.ts`.
 *
 * The scan framing corners around the meal row are vector chrome drawn by the
 * component, not painted into the artwork: they are functional UI that has to
 * stay crisp at any size and retint per theme, which a raster corner cannot do.
 */

export const ACTION_ILLUSTRATION_IDS = [
  "log-meal",
  "scan-receipt",
  "photograph-pantry",
  "speak-pantry",
] as const;

export type ActionIllustrationId = (typeof ACTION_ILLUSTRATION_IDS)[number];

export const ACTION_ILLUSTRATIONS: Record<ActionIllustrationId, ImageSourcePropType> = {
  "log-meal": require("../../assets/illustrations/action/log-meal.webp"),
  "photograph-pantry": require("../../assets/illustrations/action/photograph-pantry.webp"),
  "scan-receipt": require("../../assets/illustrations/action/scan-receipt.webp"),
  "speak-pantry": require("../../assets/illustrations/action/speak-pantry.webp"),
};
