import type { MealType, MealVenue } from '@/types';

export const SERVINGS_MULTIPLIERS = [1, 2, 4] as const;

export type ServingsMultiplier = (typeof SERVINGS_MULTIPLIERS)[number];

export interface MealModifierState {
  mealType: MealType;
  venue: MealVenue;
  servingsMult: ServingsMultiplier;
}

export function createMealModifierState(
  mealType: MealType,
  venue: MealVenue = 'home',
  servingsMult: number = 1,
): MealModifierState {
  return {
    mealType,
    venue,
    servingsMult:
      venue === 'home' ? normalizeServingsMultiplier(servingsMult) : 1,
  };
}

export function transitionMealType(
  state: MealModifierState,
  mealType: MealType,
): MealModifierState {
  return { ...state, mealType };
}

export function transitionMealVenue(
  state: MealModifierState,
  venue: MealVenue,
): MealModifierState {
  return {
    ...state,
    venue,
    // Non-home meals cannot represent a pantry-depleting batch.
    servingsMult: venue === 'home' ? state.servingsMult : 1,
  };
}

export function transitionServingsMultiplier(
  state: MealModifierState,
  servingsMult: number,
): MealModifierState {
  if (state.venue !== 'home') return { ...state, servingsMult: 1 };
  return { ...state, servingsMult: normalizeServingsMultiplier(servingsMult) };
}

export function pantryDepletionEnabled(venue: MealVenue): boolean {
  return venue === 'home';
}

function normalizeServingsMultiplier(value: number): ServingsMultiplier {
  return SERVINGS_MULTIPLIERS.includes(value as ServingsMultiplier)
    ? (value as ServingsMultiplier)
    : 1;
}
