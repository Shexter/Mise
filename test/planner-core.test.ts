import { describe, expect, test } from 'vitest';

import { fitSingleMealPortion, projectedNutrition, projectRecipeQuantity, selectPlannerTarget } from '@/logic/plannerNutrition';
import { plannerRecipeEligible, snapshotMealPrepTemplate } from '@/logic/plannerRecipe';
import { copyWeekTemplate, moveSlot, PlannerConflictError, validateDraft } from '@/logic/plannerSchedule';
import type { PlannerNutrition, PlannerRecipeSnapshot, WeekTemplate } from '@/types';

const known = (calories: number, proteinG: number, carbsG: number, fatG: number): PlannerNutrition => ({
  calories, proteinG, carbsG, fatG, fibreG: 4, source: 'canonical_catalogue',
});

const snapshot: PlannerRecipeSnapshot = {
  id: 'source-snapshot', sourceKind: 'starter', sourceId: 'recipe', sourceVersion: '1',
  title: 'Fixture bowl', mealTypes: ['lunch'], cuisines: ['Asian'], baseYield: 4,
  durationMinutes: 20, requiredAppliances: ['cooktop'], ingredients: [], steps: [],
  nutritionPerPortion: known(400, 20, 50, 10), createdAt: '2026-09-07T00:00:00.000Z',
};

describe('planner schedule', () => {
  test('copied weeks get independent identities and clear operational state', () => {
    const template: WeekTemplate = {
      id: 't', name: 'Routine', createdAt: '', updatedAt: '',
      entries: [{ id: 'e', weekday: 0, mealType: 'lunch', snapshot, eatenPortions: 1, producedPortions: 4 }],
    };
    let next = 0;
    const copied = copyWeekTemplate(template, '2026-09-09', 'schedule', () => `new-${++next}`);
    expect(copied.slots[0]).toMatchObject({ localDate: '2026-09-07', status: 'planned', linkedMealId: null });
    expect(copied.batches[0]).toMatchObject({ producedPortions: 4, linkedFirstMealId: null });
    expect(copied.snapshots[0]?.id).not.toBe(snapshot.id);
  });

  test('occupied moves require explicit replacement', () => {
    const slots = [
      { id: 'a', scheduleId: 's', localDate: '2026-09-07', mealType: 'lunch' as const, batchId: 'b1', eatenPortions: 1, status: 'planned' as const, linkedMealId: null },
      { id: 'b', scheduleId: 's', localDate: '2026-09-08', mealType: 'lunch' as const, batchId: 'b2', eatenPortions: 1, status: 'planned' as const, linkedMealId: null },
    ];
    expect(() => moveSlot(slots, 'a', '2026-09-08', 'lunch')).toThrow(PlannerConflictError);
    expect(moveSlot(slots, 'a', '2026-09-08', 'lunch', true)).toHaveLength(1);
  });

  test('batch demand is separate from consumed portions and capacity is enforced', () => {
    const draft = {
      scheduleId: 's', weekStart: '2026-09-07', baseRevision: 1,
      snapshots: [snapshot],
      batches: [{ id: 'batch', scheduleId: 's', snapshotId: snapshot.id, cookDate: '2026-09-07', producedPortions: 4, linkedFirstMealId: null }],
      slots: [0, 1, 2, 3].map((day) => ({ id: `slot-${day}`, scheduleId: 's', localDate: `2026-09-${String(7 + day).padStart(2, '0')}`, mealType: 'lunch' as const, batchId: 'batch', eatenPortions: 1, status: 'planned' as const, linkedMealId: null })),
    };
    expect(() => validateDraft(draft)).not.toThrow();
    expect(() => validateDraft({ ...draft, slots: [...draft.slots, { ...draft.slots[3]!, id: 'extra', localDate: '2026-09-11' }] })).toThrow('exceed');
  });
});

describe('planner nutrition', () => {
  test('uses a dated target before the current profile projection', () => {
    const current = { targetCalories: 2000, proteinG: 100, carbsG: 250, fatG: 60, fibreG: 30 };
    const dated = { ...current, localDate: '2026-09-08', targetCalories: 1800 };
    expect(selectPlannerTarget('2026-09-08', [dated], current)).toEqual({ target: dated, kind: 'dated' });
    expect(selectPlannerTarget('2026-09-09', [dated], current)).toMatchObject({ kind: 'projected', target: { localDate: '2026-09-09' } });
  });
  test('production scaling uses the base yield once and preserves unknown quantities', () => {
    expect(projectRecipeQuantity(600, 4, 6)).toBe(900);
    expect(projectRecipeQuantity(null, 4, 6)).toBeNull();
    expect(() => projectRecipeQuantity(600, 0, 6)).toThrow();
  });
  test('linked logged meals are counted once in a projection', () => {
    const total = projectedNutrition(
      [{ mealId: 'meal-1', nutrition: known(500, 30, 60, 15) }],
      [{ id: 'slot', portions: 1, nutritionPerPortion: known(500, 30, 60, 15), linkedMealId: 'meal-1' }],
    );
    expect(total.calories).toBe(500);
  });

  test('unknown nutrition stays unknown and disables automatic fitting', () => {
    const unknown = { ...known(400, 20, 50, 10), proteinG: null };
    expect(projectedNutrition([], [{ id: 'x', portions: 1, nutritionPerPortion: unknown, linkedMealId: null }]).proteinG).toBeNull();
    expect(fitSingleMealPortion(unknown, known(1000, 40, 120, 30), { targetCalories: 2000, proteinG: 100, carbsG: 220, fatG: 70 })).toBeNull();
  });

  test('portion fit uses bounded quarter steps and reports improvement', () => {
    const fit = fitSingleMealPortion(
      known(400, 20, 50, 10), known(1200, 60, 150, 40),
      { targetCalories: 2000, proteinG: 100, carbsG: 250, fatG: 60 },
    );
    expect(fit).toEqual(expect.objectContaining({ multiplier: 2, improved: true }));
  });
});

describe('planner recipe selection', () => {
  test('works with an empty pantry while preserving incomplete nutrition', () => {
    let id = 0;
    const recipe = snapshotMealPrepTemplate({
      template: {
        id: 'haul', title: 'Grocery haul bowl', portions: 2, durationMinutes: 15,
        requiredAppliances: ['cooktop'], dietaryTags: [], steps: [],
        ingredients: [{ canonicalId: 'unknown-food', name: 'Ingredient', quantity: 200, unit: 'g' }],
      },
      canonicals: new Map(), snapshotId: 'snapshot', ingredientId: () => `ingredient-${++id}`,
      mealTypes: ['lunch'], cuisines: ['Asian'], createdAt: '2026-09-07T00:00:00.000Z',
    });
    expect(plannerRecipeEligible({ recipe, mealType: 'lunch', cuisine: 'asian', ownedAppliances: new Set(['cooktop']) })).toBe(true);
    expect(recipe.nutritionPerPortion.calories).toBeNull();
    expect(plannerRecipeEligible({ recipe, excludedCanonicalIds: new Set(['unknown-food']) })).toBe(false);
  });
});
