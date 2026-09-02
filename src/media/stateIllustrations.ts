import type { ImageSourcePropType } from "react-native";

/**
 * Bundled artwork for the four named state roles `docs/brand-system.md`
 * approves. A fifth role needs an approved brief first — these are not a
 * general-purpose decoration pool.
 *
 * Generated block of static `require()` literals, rewritten by
 * `scripts/generate-illustrations.ts --promote` and held to
 * `assets/illustrations/manifest.json` by `test/illustration-registries.test.ts`.
 *
 * Each role names a state the app is genuinely in. None of them means "loading"
 * or "something failed": an empty shelf drawn while a query is still running, or
 * after it errored, tells the user something untrue.
 */

export const STATE_ILLUSTRATION_IDS = [
  "empty-pantry",
  "first-saved-meal",
  "capture-needs-better-photo",
  "no-dinner-suggestion",
] as const;

export type StateIllustrationId = (typeof STATE_ILLUSTRATION_IDS)[number];

export const STATE_ILLUSTRATIONS: Record<StateIllustrationId, ImageSourcePropType> = {
  "capture-needs-better-photo": require("../../assets/illustrations/state/capture-needs-better-photo.webp"),
  "empty-pantry": require("../../assets/illustrations/state/empty-pantry.webp"),
  "first-saved-meal": require("../../assets/illustrations/state/first-saved-meal.webp"),
  "no-dinner-suggestion": require("../../assets/illustrations/state/no-dinner-suggestion.webp"),
};
