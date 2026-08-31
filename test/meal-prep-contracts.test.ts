import { describe, expect, test } from 'vitest';

import {
  APPLIANCE_CATALOGUE,
  APPLIANCE_IDS,
  isApplianceId,
  MEAL_PREP_STATUSES,
  ONBOARDING_INTENTS,
  type ApplianceId,
  type CookingGuideStep,
  type CookingPreferences,
  type MealPrepPlan,
  type MealPrepTemplate,
  type OwnedAppliance,
} from '../src/types';

describe('Meal-prep contracts', () => {
  describe('OnboardingIntent', () => {
    test('contains exact controlled values', () => {
      expect(ONBOARDING_INTENTS).toEqual(['calories', 'meal_prep']);
    });
  });

  describe('MealPrepStatus', () => {
    test('contains exact controlled states', () => {
      expect(MEAL_PREP_STATUSES).toEqual(['not_started', 'completed', 'deferred']);
    });
  });

  describe('ApplianceId and catalogue', () => {
    test('appliance IDs are controlled and non-empty', () => {
      expect(APPLIANCE_IDS).toEqual([
        'cooktop',
        'oven',
        'microwave',
        'air_fryer',
        'rice_cooker',
        'slow_cooker',
        'blender',
      ]);
    });

    test('isApplianceId validates known and unknown strings', () => {
      expect(isApplianceId('cooktop')).toBe(true);
      expect(isApplianceId('oven')).toBe(true);
      expect(isApplianceId('air_fryer')).toBe(true);
      expect(isApplianceId('toaster')).toBe(false);
      expect(isApplianceId('')).toBe(false);
      expect(isApplianceId(null)).toBe(false);
      expect(isApplianceId(123)).toBe(false);
    });

    test('catalogue covers all controlled appliance IDs with human labels', () => {
      const catalogueIds = APPLIANCE_CATALOGUE.map((item) => item.id);
      expect(catalogueIds).toEqual([...APPLIANCE_IDS]);
      for (const item of APPLIANCE_CATALOGUE) {
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.detail.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Contract shapes', () => {
    test('CookingPreferences shape satisfies contract', () => {
      const prefs: CookingPreferences = {
        intents: ['meal_prep'],
        mealPrepStatus: 'completed',
        createdAt: '2026-08-30T12:00:00.000Z',
        updatedAt: '2026-08-30T12:00:00.000Z',
        completedAt: '2026-08-30T12:00:00.000Z',
        deferredAt: null,
      };
      expect(prefs.intents).toContain('meal_prep');
      expect(prefs.mealPrepStatus).toBe('completed');
    });

    test('OwnedAppliance shape satisfies contract', () => {
      const appliance: OwnedAppliance = {
        applianceId: 'air_fryer',
        owned: true,
        updatedAt: '2026-08-30T12:00:00.000Z',
      };
      expect(appliance.applianceId).toBe('air_fryer');
      expect(appliance.owned).toBe(true);
    });

    test('CookingGuideStep and MealPrepPlan shape satisfies contract', () => {
      const step: CookingGuideStep = {
        stepNumber: 1,
        instruction: 'Preheat air fryer to 200°C',
        applianceId: 'air_fryer',
        actionType: 'prep',
        durationMinutes: 3,
      };
      const plan: MealPrepPlan = {
        id: 'plan-1',
        templateId: 'air-fryer-tofu',
        title: 'Crispy Air-Fried Tofu & Veggies',
        portions: 2,
        durationMinutes: 20,
        confirmedIngredients: [
          { name: 'Tofu', quantity: 300, unit: 'g', canonicalId: 'tofu' },
        ],
        missingIngredients: [
          { name: 'Soy Sauce', quantity: 15, unit: 'ml', canonicalId: 'soy-sauce-light' },
        ],
        requiredAppliances: ['air_fryer'],
        steps: [step],
      };
      expect(plan.portions).toBe(2);
      expect(plan.steps).toHaveLength(1);
      expect(plan.requiredAppliances).toEqual(['air_fryer']);
    });

    test('MealPrepTemplate shape satisfies contract', () => {
      const template: MealPrepTemplate = {
        id: 'no-cook-salad',
        title: 'Fresh Mediterranean Salad',
        portions: 2,
        durationMinutes: 10,
        requiredAppliances: [],
        ingredients: [
          { canonicalId: 'cucumber', name: 'Cucumber', quantity: 1, unit: 'piece' },
          { canonicalId: 'tomato', name: 'Tomato', quantity: 2, unit: 'piece' },
        ],
        steps: [
          {
            stepNumber: 1,
            instruction: 'Chop cucumber and tomato into bite-sized pieces.',
            applianceId: null,
            actionType: 'prep',
          },
        ],
        dietaryTags: ['vegan', 'vegetarian', 'dairy_free', 'gluten_free'],
      };
      expect(template.requiredAppliances).toHaveLength(0);
      expect(template.ingredients).toHaveLength(2);
      expect(template.dietaryTags).toContain('vegan');
    });
  });
});
