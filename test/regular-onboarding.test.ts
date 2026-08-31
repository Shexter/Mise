import { expect, test } from 'vitest';

import { energyTargets } from '../src/logic/bmr';
import { ONBOARDING_ENTRY_ROUTES, ONBOARDING_STEPS } from '../src/store/onboardingStore';

test('the calorie-first route order and calculation remain unchanged', () => {
  expect(ONBOARDING_STEPS).toEqual([
    'welcome', 'sex', 'age', 'height', 'weight', 'activity', 'goal', 'api-key', 'dietary', 'results',
  ]);
  expect(energyTargets({ sex: 'female', age: 30, heightCm: 170, weightKg: 70 }, 'moderate', 'maintain')).toEqual({ maintenance: 2250, target: 2250 });
});

test('the age, height, weight flow is the default and energy sources are opt-in', () => {
  expect(ONBOARDING_ENTRY_ROUTES.estimated).toBe('/onboarding/sex');
  expect(ONBOARDING_ENTRY_ROUTES.dexa).toBe('/onboarding/energy');
  expect(ONBOARDING_ENTRY_ROUTES.inbody).toBe('/onboarding/energy');
  expect(ONBOARDING_ENTRY_ROUTES.stated).toBe('/onboarding/energy');
});
