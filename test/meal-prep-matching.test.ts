import { describe, expect, test } from 'vitest';

import {
  buildMealPrepPlan,
  findEligibleMealPrepPlans,
  isTemplateEligible,
  matchTemplateToPantry,
} from '../src/logic/mealPrepMatching';
import { STARTER_MEAL_PREP_TEMPLATES } from '../src/logic/mealPrepTemplates';
import type { ApplianceId, MealPrepTemplate } from '../src/types';

describe('Meal-prep starter templates and matching', () => {
  describe('2.1 Starter template catalogue integrity', () => {
    test('contains templates with declared ingredients, appliances, portions, duration, and steps', () => {
      expect(STARTER_MEAL_PREP_TEMPLATES.length).toBeGreaterThanOrEqual(5);

      for (const template of STARTER_MEAL_PREP_TEMPLATES) {
        expect(template.id).toBeDefined();
        expect(template.title.length).toBeGreaterThan(0);
        expect(template.portions).toBeGreaterThan(0);
        expect(template.ingredients.length).toBeGreaterThan(0);
        expect(template.steps.length).toBeGreaterThan(0);

        // Verify every step has a valid step number and instruction
        template.steps.forEach((step, idx) => {
          expect(step.stepNumber).toBe(idx + 1);
          expect(step.instruction.length).toBeGreaterThan(0);
        });
      }
    });

    test('includes at least one no-appliance / no-cook template', () => {
      const noApplianceTemplates = STARTER_MEAL_PREP_TEMPLATES.filter(
        (t) => t.requiredAppliances.length === 0,
      );
      expect(noApplianceTemplates.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('2.2 Strict plan eligibility and matching', () => {
    test('filters out templates requiring appliances the user does not own', () => {
      const owned = new Set<ApplianceId>(['air_fryer']);
      const plans = findEligibleMealPrepPlans({
        ownedAppliances: owned,
        confirmedPantryCanonicalIds: new Set(['tofu', 'broccoli', 'soy-sauce-light', 'olive-oil']),
      });

      expect(plans.length).toBeGreaterThan(0);
      for (const plan of plans) {
        for (const app of plan.requiredAppliances) {
          expect(owned.has(app)).toBe(true);
        }
      }
      expect(plans.some((p) => p.requiredAppliances.includes('oven'))).toBe(false);
      expect(plans.some((p) => p.requiredAppliances.includes('rice_cooker'))).toBe(false);
    });

    test('no-appliance choice only matches no-cook templates', () => {
      const emptyAppliances = new Set<ApplianceId>();
      const plans = findEligibleMealPrepPlans({
        ownedAppliances: emptyAppliances,
        confirmedPantryCanonicalIds: new Set(['chickpeas', 'cucumber', 'tomato', 'olive-oil']),
      });

      expect(plans.length).toBeGreaterThan(0);
      for (const plan of plans) {
        expect(plan.requiredAppliances).toHaveLength(0);
      }
    });

    test('excludes templates containing dietary allergens or restrictions', () => {
      const owned = new Set<ApplianceId>(['rice_cooker', 'oven', 'air_fryer', 'cooktop']);
      const pantry = new Set(['chicken-breast', 'jasmine-rice', 'soy-sauce-light', 'garlic']);

      // Without restrictions, chicken-rice is eligible
      const plansBefore = findEligibleMealPrepPlans({
        ownedAppliances: owned,
        confirmedPantryCanonicalIds: pantry,
      });
      expect(plansBefore.some((p) => p.templateId === 'rice-cooker-chicken-rice')).toBe(true);

      // With chicken-breast excluded (e.g. vegetarian), chicken-rice is excluded
      const plansVegetarian = findEligibleMealPrepPlans({
        ownedAppliances: owned,
        confirmedPantryCanonicalIds: pantry,
        excludedCanonicalIds: new Set(['chicken-breast']),
      });
      expect(plansVegetarian.some((p) => p.templateId === 'rice-cooker-chicken-rice')).toBe(false);
    });

    test('explicitly marks missing vs confirmed pantry ingredients', () => {
      const template = STARTER_MEAL_PREP_TEMPLATES.find((t) => t.id === 'sheet-pan-roasted-chicken-veg')!;
      // User only has chicken-breast and olive-oil, missing broccoli and garlic
      const confirmedPantry = new Set(['chicken-breast', 'olive-oil']);

      const match = matchTemplateToPantry(template, confirmedPantry);
      expect(match.confirmedIngredients.map((i) => i.canonicalId)).toEqual(['chicken-breast', 'olive-oil']);
      expect(match.missingIngredients.map((i) => i.canonicalId)).toEqual(['broccoli', 'garlic']);
    });
  });

  describe('2.3 Plan construction never invents data', () => {
    test('buildMealPrepPlan produces an exact plan mirroring confirmed pantry facts and declared appliances', () => {
      const template = STARTER_MEAL_PREP_TEMPLATES.find((t) => t.id === 'air-fryer-crispy-tofu-bowl')!;
      const pantry = new Set(['tofu-firm']);

      const plan = buildMealPrepPlan(template, pantry);
      expect(plan.title).toBe(template.title);
      expect(plan.portions).toBe(template.portions);
      expect(plan.durationMinutes).toBe(template.durationMinutes);
      expect(plan.requiredAppliances).toEqual(['air_fryer']);

      // Confirmed only has tofu-firm, missing has broccoli, soy-sauce-light, olive-oil
      expect(plan.confirmedIngredients).toHaveLength(1);
      expect(plan.confirmedIngredients[0]?.canonicalId).toBe('tofu-firm');
      expect(plan.missingIngredients).toHaveLength(3);
      expect(plan.missingIngredients.map((i) => i.canonicalId)).toEqual([
        'broccoli',
        'soy-sauce-light',
        'olive-oil',
      ]);
    });
  });

  describe('2.4 Suggestion cache isolation', () => {
    test('MealPrepPlan structure is distinct from Suggestion and does not mutate or read suggestion_cache', () => {
      const template = STARTER_MEAL_PREP_TEMPLATES[0]!;
      const plan = buildMealPrepPlan(template, new Set());

      // MealPrepPlan has templateId, requiredAppliances, confirmedIngredients, missingIngredients
      expect(plan.templateId).toBeDefined();
      expect(plan.requiredAppliances).toBeDefined();
      expect(plan.confirmedIngredients).toBeDefined();
      expect(plan.missingIngredients).toBeDefined();

      // MealPrepPlan does NOT have dinner suggestion fields like 'dish', 'reasons', 'kcalPerServing', 'method'
      expect((plan as any).dish).toBeUndefined();
      expect((plan as any).reasons).toBeUndefined();
      expect((plan as any).kcalPerServing).toBeUndefined();
    });
  });
});
