import type { ImageSourcePropType } from "react-native";

import type { ApplianceId } from "@/types";

/**
 * Bundled onboarding artwork: the two goal-card illustrations and one per
 * appliance in `APPLIANCE_CATALOGUE`.
 *
 * Both maps are generated blocks of static `require()` literals. Metro cannot
 * bundle a computed path, so no screen builds an asset path of its own — it asks
 * here. `scripts/generate-illustrations.ts --promote` rewrites these blocks, and
 * `test/illustration-registries.test.ts` holds them to
 * `assets/illustrations/manifest.json` in both directions so the two cannot
 * drift.
 *
 * The illustrations are card artwork, never a control. Checkboxes, ticks, and
 * every selected state stay vector UI drawn from theme tokens.
 */

export const GOAL_ILLUSTRATION_IDS = ["track-calories-goal", "meal-prep-goal"] as const;

export type GoalIllustrationId = (typeof GOAL_ILLUSTRATION_IDS)[number];

/** Which artwork belongs to which `OnboardingIntent`. */
export const GOAL_ILLUSTRATION_BY_INTENT = {
  calories: "track-calories-goal",
  meal_prep: "meal-prep-goal",
} as const satisfies Record<string, GoalIllustrationId>;

export const GOAL_ILLUSTRATIONS: Record<GoalIllustrationId, ImageSourcePropType> = {
  "meal-prep-goal": require("../../assets/illustrations/onboarding/meal-prep-goal.webp"),
  "track-calories-goal": require("../../assets/illustrations/onboarding/track-calories-goal.webp"),
};

export const APPLIANCE_ILLUSTRATIONS: Record<ApplianceId, ImageSourcePropType> = {
  "air_fryer": require("../../assets/illustrations/appliance/air_fryer.webp"),
  "blender": require("../../assets/illustrations/appliance/blender.webp"),
  "cooktop": require("../../assets/illustrations/appliance/cooktop.webp"),
  "microwave": require("../../assets/illustrations/appliance/microwave.webp"),
  "oven": require("../../assets/illustrations/appliance/oven.webp"),
  "rice_cooker": require("../../assets/illustrations/appliance/rice_cooker.webp"),
  "slow_cooker": require("../../assets/illustrations/appliance/slow_cooker.webp"),
};
