import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  getOnboardingSteps,
  stepIndex,
  useOnboardingStore,
} from '@/store/onboardingStore';
import { APPLIANCE_CATALOGUE, APPLIANCE_IDS } from '@/types';
import { COMMON_STARTER_PANTRY_ITEMS } from '@/logic/starterPantryItems';

describe('Meal-prep onboarding routes, states and accessibility', () => {
  describe('Dynamic step resolution', () => {
    test('resolves steps correctly for calories only', () => {
      const steps = getOnboardingSteps(['calories']);
      expect(steps).toEqual([
        'welcome',
        'sex',
        'age',
        'height',
        'weight',
        'activity',
        'goal',
        'api-key',
        'dietary',
        'results',
      ]);
      expect(stepIndex('sex', ['calories'])).toBe(1);
      expect(stepIndex('results', ['calories'])).toBe(9);
    });

    test('resolves steps correctly for meal prep only', () => {
      const steps = getOnboardingSteps(['meal_prep']);
      expect(steps).toEqual([
        'welcome',
        'dietary',
        'appliances',
        'starter-pantry',
        'first-plan',
      ]);
      expect(stepIndex('dietary', ['meal_prep'])).toBe(1);
      expect(stepIndex('appliances', ['meal_prep'])).toBe(2);
      expect(stepIndex('first-plan', ['meal_prep'])).toBe(4);
    });

    test('resolves steps correctly for both intents', () => {
      const steps = getOnboardingSteps(['calories', 'meal_prep'], 'calories', ['calories']);
      expect(steps).toEqual([
        'welcome',
        'sex',
        'age',
        'height',
        'weight',
        'activity',
        'goal',
        'api-key',
        'results',
        'dietary',
        'appliances',
        'starter-pantry',
        'first-plan',
      ]);
      expect(stepIndex('results', ['calories', 'meal_prep'], 'calories', ['calories'])).toBe(8);
      expect(stepIndex('first-plan', ['calories', 'meal_prep'], 'calories', ['calories'])).toBe(12);
    });

    test('orders both branches correctly for kitchen-first continuation', () => {
      expect(getOnboardingSteps(['meal_prep', 'calories'], 'meal_prep', ['meal_prep'])).toEqual([
        'welcome',
        'dietary',
        'appliances',
        'starter-pantry',
        'first-plan',
        'sex',
        'age',
        'height',
        'weight',
        'activity',
        'goal',
        'api-key',
        'results',
      ]);
    });
  });

  describe('Store intent and draft actions', () => {
    test('toggles intents and maintains at least one selected intent', () => {
      useOnboardingStore.getState().reset();
      expect(useOnboardingStore.getState().intents).toEqual(['calories']);

      // Toggle meal_prep on
      useOnboardingStore.getState().toggleIntent('meal_prep');
      expect(useOnboardingStore.getState().intents).toEqual(['calories', 'meal_prep']);

      // Toggle calories off
      useOnboardingStore.getState().toggleIntent('calories');
      expect(useOnboardingStore.getState().intents).toEqual(['meal_prep']);

      // Toggling off the last remaining intent is prevented
      useOnboardingStore.getState().toggleIntent('meal_prep');
      expect(useOnboardingStore.getState().intents).toEqual(['meal_prep']);
    });

    test('manages appliance selection and no-appliances toggle', () => {
      useOnboardingStore.getState().reset();
      expect(useOnboardingStore.getState().selectedAppliances).toEqual([]);
      expect(useOnboardingStore.getState().noAppliancesChosen).toBe(false);

      useOnboardingStore.getState().toggleAppliance('oven');
      useOnboardingStore.getState().toggleAppliance('air_fryer');
      expect(useOnboardingStore.getState().selectedAppliances).toEqual(['oven', 'air_fryer']);

      useOnboardingStore.getState().setNoAppliances(true);
      expect(useOnboardingStore.getState().noAppliancesChosen).toBe(true);
      expect(useOnboardingStore.getState().selectedAppliances).toEqual([]);
    });

    test('manages starter pantry draft and confirmation', () => {
      useOnboardingStore.getState().reset();
      expect(useOnboardingStore.getState().starterPantryDraftIds).toEqual([]);

      useOnboardingStore.getState().toggleStarterPantryDraft('chicken-breast');
      useOnboardingStore.getState().toggleStarterPantryDraft('jasmine-rice');
      expect(useOnboardingStore.getState().starterPantryDraftIds).toEqual(['chicken-breast', 'jasmine-rice']);

      useOnboardingStore.getState().confirmStarterPantry(['chicken-breast', 'jasmine-rice']);
      expect(useOnboardingStore.getState().starterPantryConfirmedIds).toEqual(['chicken-breast', 'jasmine-rice']);
      expect(useOnboardingStore.getState().starterPantryDraftIds).toEqual([]);
    });
  });

  describe('UI Accessibility and brand verification across new screens', () => {
    const root = process.cwd();
    const welcomeScreen = readFileSync(join(root, 'app/onboarding/welcome.tsx'), 'utf8');
    const appliancesScreen = readFileSync(join(root, 'app/onboarding/appliances.tsx'), 'utf8');
    const starterPantryScreen = readFileSync(join(root, 'app/onboarding/starter-pantry.tsx'), 'utf8');
    const firstPlanScreen = readFileSync(join(root, 'app/onboarding/first-plan.tsx'), 'utf8');
    const resultsScreen = readFileSync(join(root, 'app/onboarding/results.tsx'), 'utf8');

    test('welcome starting-point cards are accessible radio choices', () => {
      expect(welcomeScreen).toContain('accessibilityRole="radio"');
      expect(welcomeScreen).toContain('accessibilityState={{ checked: selected }}');
      expect(welcomeScreen).toContain('Daily calorie & macro target');
      expect(welcomeScreen).toContain('Kitchen & meal prep');
    });

    test('appliances screen has accessible roles, no-appliance toggle, and skip action', () => {
      expect(appliancesScreen).toContain('accessibilityRole="checkbox"');
      expect(appliancesScreen).toContain('No appliances / no-cook ideas');
      expect(appliancesScreen).toContain('secondaryLabel="Skip for now"');
      expect(appliancesScreen).toContain('deferMealPrep');
    });

    test('starter pantry screen includes confirmation modal/sheet and alternative intake links', () => {
      expect(starterPantryScreen).toContain('Confirm starter pantry');
      expect(starterPantryScreen).toContain('Scan items with camera');
      expect(starterPantryScreen).toContain('Add custom ingredient');
      expect(starterPantryScreen).toContain('/pantry-capture');
      expect(starterPantryScreen).toContain('/add-pantry-item');
    });

    test('first plan screen contains portions, durations, appliances, and handoff to review', () => {
      expect(firstPlanScreen).toContain('portions');
      expect(firstPlanScreen).toContain('mins');
      expect(firstPlanScreen).toContain('Cooking Guide');
      expect(firstPlanScreen).toContain('Review & log meal');
      expect(firstPlanScreen).toContain('/manual');
      expect(firstPlanScreen).toContain('Set up daily calorie target');
      expect(firstPlanScreen).toContain('Head straight to the app');
    });

    test('milestone screens persist their branch before continuing or entering the app', () => {
      expect(resultsScreen).toContain('Set up kitchen & meal prep');
      expect(resultsScreen).toContain('Head straight to the app');
      expect(resultsScreen).toContain("completeBranch('calories')");
      expect(resultsScreen).toContain("router.replace('/(tabs)')");
      expect(firstPlanScreen).toContain("completeBranch('meal_prep')");
      expect(firstPlanScreen).toContain("router.push('/onboarding/sex')");
      expect(firstPlanScreen).toContain("router.replace('/(tabs)')");
    });

    test('all starter pantry items have valid default locations', () => {
      for (const item of COMMON_STARTER_PANTRY_ITEMS) {
        expect(['fridge', 'freezer', 'pantry', 'counter']).toContain(item.defaultLocation);
        expect(item.canonicalId.length).toBeGreaterThan(0);
        expect(item.name.length).toBeGreaterThan(0);
      }
    });

    test('appliance catalogue matches APPLIANCE_IDS', () => {
      expect(APPLIANCE_CATALOGUE.map((a) => a.id)).toEqual([...APPLIANCE_IDS]);
    });
  });
});
