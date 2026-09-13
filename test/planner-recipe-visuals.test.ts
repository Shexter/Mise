import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { PLANNER_CATALOGUE } from '@/logic/plannerCatalogue';
import { STARTER_MEAL_PREP_TEMPLATES } from '@/logic/mealPrepTemplates';
import { DISH_ILLUSTRATIONS } from '@/media/dishIllustrations';
import {
  AUTHORED_DISH_IDS,
  authoredDishArtIdFor,
  authoredVisualKey,
  foodClassOfCanonical,
  plannerVisualFromCatalogue,
  plannerVisualFromSnapshot,
  resolvePlannerRecipeVisual,
} from '@/media/plannerRecipeVisuals';
import type { PlannerRecipeSnapshot } from '@/types';

const read = (path: string) => readFileSync(path, 'utf8');

/** A promoted id, so the `authored` tier is actually reachable in these tests. */
const SHIPPED_ID = Object.keys(DISH_ILLUSTRATIONS)[0]!;

function snapshot(overrides: Partial<PlannerRecipeSnapshot> = {}): PlannerRecipeSnapshot {
  return {
    id: 'snap', sourceKind: 'starter', sourceId: SHIPPED_ID, sourceVersion: '1',
    title: 'Rice cooker chicken rice', mealTypes: ['dinner'], cuisines: ['Chinese'],
    baseYield: 4, durationMinutes: 30, requiredAppliances: ['rice_cooker'],
    ingredients: [
      {
        id: 'i1', canonicalId: 'chicken-breast', name: 'Chicken breast', quantity: 600, unit: 'g',
        preparation: 'raw', optional: false, included: true,
        nutrition: { calories: null, proteinG: null, carbsG: null, fatG: null, fibreG: null, source: null },
      },
      {
        id: 'i2', canonicalId: 'bok-choy', name: 'Bok choy', quantity: 200, unit: 'g',
        preparation: 'raw', optional: false, included: true,
        nutrition: { calories: null, proteinG: null, carbsG: null, fatG: null, fibreG: null, source: null },
      },
    ],
    steps: [],
    nutritionPerPortion: { calories: null, proteinG: null, carbsG: null, fatG: null, fibreG: null, source: null },
    createdAt: '2026-09-08T00:00:00.000Z',
    ...overrides,
  };
}

describe('authored dish artwork is claimed by id, never by name', () => {
  test('the bounded set is exactly the two authored collections', () => {
    const expected = new Set([
      ...STARTER_MEAL_PREP_TEMPLATES.map((template) => template.id),
      ...PLANNER_CATALOGUE.map((recipe) => recipe.id),
    ]);
    expect([...AUTHORED_DISH_IDS].sort()).toEqual([...expected].sort());
    expect(AUTHORED_DISH_IDS.size).toBe(STARTER_MEAL_PREP_TEMPLATES.length + PLANNER_CATALOGUE.length);
  });

  test('a saved or provider recipe cannot reach artwork at all', () => {
    expect(authoredDishArtIdFor('saved_recipe', SHIPPED_ID)).toBeNull();
    expect(authoredDishArtIdFor('starter', 'spicy-peanut-noodles')).toBeNull();
    expect(authoredDishArtIdFor('starter', null)).toBeNull();
    expect(authoredDishArtIdFor(null, SHIPPED_ID)).toBeNull();
    // Not addressable by title.
    expect(authoredDishArtIdFor('starter', 'Rice cooker chicken rice')).toBeNull();
  });

  test('a renamed authored recipe keeps its artwork, and a namesake does not inherit it', () => {
    const renamed = resolvePlannerRecipeVisual(
      plannerVisualFromSnapshot(snapshot({ title: 'Poached chicken over rice' })),
    );
    expect(renamed.kind).toBe('authored');

    const namesake = resolvePlannerRecipeVisual(plannerVisualFromSnapshot(snapshot({
      sourceKind: 'saved_recipe', sourceId: 'saved-1', title: 'Rice cooker chicken rice',
    })));
    expect(namesake.kind).toBe('plate');
  });
});

describe('visual tiers fall through in the right order', () => {
  test('a photo outranks bundled artwork', () => {
    const resolved = resolvePlannerRecipeVisual(
      plannerVisualFromSnapshot(snapshot(), 'file:///photo.jpg'),
    );
    expect(resolved).toEqual({ kind: 'photo', uri: 'file:///photo.jpg' });
  });

  test('a photo that will not decode falls to the artwork rather than a hole', () => {
    const resolved = resolvePlannerRecipeVisual(
      plannerVisualFromSnapshot(snapshot(), 'file:///broken.jpg'),
      new Set(['file:///broken.jpg']),
    );
    expect(resolved.kind).toBe('authored');
  });

  test('artwork that will not load falls to the plate, keeping the known classes', () => {
    const resolved = resolvePlannerRecipeVisual(
      plannerVisualFromSnapshot(snapshot()),
      new Set([authoredVisualKey(SHIPPED_ID)]),
    );
    expect(resolved.kind).toBe('plate');
    if (resolved.kind !== 'plate') throw new Error('unreachable');
    // The ingredients are known, so the plate is composed rather than empty.
    expect(resolved.foodClasses.filter((value) => value !== null).length).toBe(2);
  });

  test('an unknown snapshot renders an honestly empty plate', () => {
    const resolved = resolvePlannerRecipeVisual(plannerVisualFromSnapshot(snapshot({
      sourceKind: 'saved_recipe', sourceId: 'saved-2',
      ingredients: [{
        id: 'i1', canonicalId: null, name: 'Something', quantity: null, unit: null,
        preparation: null, optional: false, included: true,
        nutrition: { calories: null, proteinG: null, carbsG: null, fatG: null, fibreG: null, source: null },
      }],
    })));
    expect(resolved.kind).toBe('plate');
    if (resolved.kind !== 'plate') throw new Error('unreachable');
    expect(resolved.foodClasses).toEqual([null]);
  });

  test('excluded ingredients do not colour the plate', () => {
    const resolved = resolvePlannerRecipeVisual(plannerVisualFromSnapshot(snapshot({
      sourceKind: 'saved_recipe', sourceId: 'saved-3',
      ingredients: snapshot().ingredients.map((ingredient, index) => ({
        ...ingredient, included: index === 0,
      })),
    })));
    if (resolved.kind !== 'plate') throw new Error('unreachable');
    expect(resolved.foodClasses).toHaveLength(1);
  });

  test('food classes come from the shipped catalogue, not from a guess', () => {
    expect(foodClassOfCanonical('chicken-breast')).not.toBeNull();
    expect(foodClassOfCanonical('bok-choy')).not.toBeNull();
    expect(foodClassOfCanonical('a-food-nobody-shipped')).toBeNull();
    expect(foodClassOfCanonical(null)).toBeNull();
  });

  test('a catalogue recipe carries its own ingredients into the picker row', () => {
    const recipe = PLANNER_CATALOGUE[0]!;
    const identity = plannerVisualFromCatalogue({
      id: recipe.id,
      title: recipe.title,
      ingredients: recipe.ingredients.map((ingredient) => ({ canonicalId: ingredient.canonicalId })),
    });
    expect(identity.sourceKind).toBe('starter');
    expect(identity.sourceId).toBe(recipe.id);
    expect(identity.canonicalIds).toHaveLength(recipe.ingredients.length);
  });
});

describe('every planner surface uses the shared resolver', () => {
  const surfaces = [
    'app/plan/picker.tsx',
    'app/plan/recipe.tsx',
    'app/plan/meal.tsx',
    'src/components/planner/MealSlotRow.tsx',
    'src/components/planner/PlannerHome.tsx',
    'src/components/planner/RecipeChoiceRow.tsx',
  ];

  test.each(surfaces)('%s resolves artwork through PlannerRecipeVisual', (path) => {
    const source = read(path);
    expect(source).toMatch(/PlannerRecipeVisual|plannerVisualFrom/);
    // No surface reaches past the resolver to the raw registry.
    expect(source).not.toContain('dishIllustrationFor');
    expect(source).not.toContain('<DishVisual');
  });

  test('Up next, the agenda row and the cooking guide all show authored art', () => {
    expect(read('src/components/planner/PlannerHome.tsx'))
      .toContain('<PlannerRecipeVisual snapshot={next.snapshot}');
    expect(read('src/components/planner/MealSlotRow.tsx'))
      .toContain('<PlannerRecipeVisual snapshot={snapshot}');
    expect(read('app/plan/meal.tsx'))
      .toContain('<PlannerRecipeVisual snapshot={snapshot}');
  });

  test('the component reaches the next tier when an image errors', () => {
    const component = read('src/components/planner/PlannerRecipeVisual.tsx');
    expect(component).toContain('onError={() => setFailed');
    expect(component).toContain('authoredVisualKey(resolved.assetId)');
    expect(component).toContain('<DishVisual');
  });

  test('surfaces for unbounded dishes still keep the procedural plate', () => {
    for (const path of ['app/dinner.tsx', 'src/components/recipes/SavedRecipesSection.tsx']) {
      const source = read(path);
      expect(source, path).toContain('<DishVisual');
      expect(source, path).not.toContain('PlannerRecipeVisual');
    }
  });
});
