import { describe, expect, test } from 'vitest';

import { isOnboardingComplete } from '../src/logic/onboardingGuards';
import type { CookingPreferences, Profile } from '../src/types';

const MOCK_PROFILE: Profile = {
  sex: 'female',
  age: 28,
  heightCm: 165,
  weightKg: 62,
  activityLevel: 'moderate',
  goal: 'maintain',
  targetCalories: 2000,
  targetSource: 'estimated',
  statedCalories: null,
  statedFigureKind: null,
  proteinPct: 0.3,
  carbsPct: 0.4,
  fatPct: 0.3,
  fibreTargetG: 30,
  units: 'metric',
  onboardedAt: '2026-08-30T12:00:00.000Z',
  targetWeightKg: null,
  weightGoalRateKgPerWeek: null,
};

const MOCK_COOKING_PREFERENCES_COMPLETED: CookingPreferences = {
  intents: ['meal_prep'],
  mealPrepStatus: 'completed',
  createdAt: '2026-08-30T12:00:00.000Z',
  updatedAt: '2026-08-30T12:05:00.000Z',
  completedAt: '2026-08-30T12:05:00.000Z',
  deferredAt: null,
};

const MOCK_COOKING_PREFERENCES_DEFERRED: CookingPreferences = {
  intents: ['meal_prep'],
  mealPrepStatus: 'deferred',
  createdAt: '2026-08-30T12:00:00.000Z',
  updatedAt: '2026-08-30T12:02:00.000Z',
  completedAt: null,
  deferredAt: '2026-08-30T12:02:00.000Z',
};

const MOCK_COOKING_PREFERENCES_NOT_STARTED: CookingPreferences = {
  intents: ['meal_prep'],
  mealPrepStatus: 'not_started',
  createdAt: '2026-08-30T12:00:00.000Z',
  updatedAt: '2026-08-30T12:00:00.000Z',
  completedAt: null,
  deferredAt: null,
};

describe('Onboarding completion guard matrix', () => {
  test('fresh install (no profile, no cooking preferences) is incomplete', () => {
    expect(
      isOnboardingComplete({
        profile: null,
        cookingPreferences: null,
      }),
    ).toBe(false);
  });

  test('calorie-only flow: completed profile enters app without cooking preferences', () => {
    expect(
      isOnboardingComplete({
        profile: MOCK_PROFILE,
        cookingPreferences: null,
      }),
    ).toBe(true);
  });

  test('meal-prep-only flow: completed meal prep enters app without nutrition profile', () => {
    expect(
      isOnboardingComplete({
        profile: null,
        cookingPreferences: MOCK_COOKING_PREFERENCES_COMPLETED,
      }),
    ).toBe(true);
  });

  test('meal-prep-only flow: deferred setup enters app without nutrition profile', () => {
    expect(
      isOnboardingComplete({
        profile: null,
        cookingPreferences: MOCK_COOKING_PREFERENCES_DEFERRED,
      }),
    ).toBe(true);
  });

  test('meal-prep-only flow: not started state does not bypass onboarding', () => {
    expect(
      isOnboardingComplete({
        profile: null,
        cookingPreferences: MOCK_COOKING_PREFERENCES_NOT_STARTED,
      }),
    ).toBe(false);
  });

  test('combined flow: profile created and meal prep completed enters app', () => {
    expect(
      isOnboardingComplete({
        profile: MOCK_PROFILE,
        cookingPreferences: {
          ...MOCK_COOKING_PREFERENCES_COMPLETED,
          intents: ['calories', 'meal_prep'],
        },
      }),
    ).toBe(true);
  });

  test('combined flow: profile created and meal prep deferred enters app', () => {
    expect(
      isOnboardingComplete({
        profile: MOCK_PROFILE,
        cookingPreferences: {
          ...MOCK_COOKING_PREFERENCES_DEFERRED,
          intents: ['calories', 'meal_prep'],
        },
      }),
    ).toBe(true);
  });
});
