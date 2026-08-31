import type { CookingPreferences, Profile } from '@/types';

/**
 * Evaluates whether onboarding has been completed or deferred such that the app
 * should navigate into the main tabs rather than the onboarding flow.
 *
 * Rules:
 * 1. If a valid calorie Profile is saved -> onboarding is complete.
 * 2. If CookingPreferences records mealPrepStatus as 'completed' or 'deferred' -> onboarding is complete.
 * 3. Otherwise (fresh install, or not started) -> onboarding is incomplete.
 */
export function isOnboardingComplete(params: {
  profile: Profile | null;
  cookingPreferences: CookingPreferences | null;
}): boolean {
  if (params.profile !== null) return true;
  if (
    params.cookingPreferences !== null &&
    (params.cookingPreferences.mealPrepStatus === 'completed' ||
      params.cookingPreferences.mealPrepStatus === 'deferred')
  ) {
    return true;
  }
  return false;
}
