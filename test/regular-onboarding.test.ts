import { expect, test } from 'vitest';

import { energyTargets } from '../src/logic/bmr';
import { ONBOARDING_STEPS } from '../src/store/onboardingStore';

test('the regular onboarding route order and calculation remain unchanged', () => {
  expect(ONBOARDING_STEPS).toEqual([
    'welcome', 'sex', 'age', 'height', 'weight', 'activity', 'goal', 'api-key', 'dietary', 'results',
  ]);
  expect(energyTargets({ sex: 'female', age: 30, heightCm: 170, weightKg: 70 }, 'moderate', 'maintain')).toEqual({ maintenance: 2250, target: 2250 });
});
