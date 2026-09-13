import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { deleteMeal, getMealScheduleForWeek, insertPlannedMeal, saveMealSchedule } from '@/db/queries';
import { plannerMealReview } from '@/logic/plannerMeal';
import type { PlannerDraft, PlannerRecipeSnapshot } from '@/types';
import { closeTestDatabase, openTestDatabase } from './stubs/db';

const unknownNutrition = { calories: null, proteinG: null, carbsG: null, fatG: null, fibreG: null, source: null } as const;
const snapshot: PlannerRecipeSnapshot = {
  id: 'snapshot', sourceKind: 'saved_recipe', sourceId: 'recipe', sourceVersion: '1',
  title: 'Planned soup', mealTypes: ['lunch'], cuisines: [], baseYield: 2,
  durationMinutes: 30, requiredAppliances: [], steps: [],
  ingredients: [{ id: 'ingredient', canonicalId: null, name: 'Beans', quantity: 400, unit: 'g', preparation: null, optional: false, included: true, nutrition: unknownNutrition }],
  nutritionPerPortion: unknownNutrition, createdAt: '2026-09-07T00:00:00.000Z',
};

async function plan() {
  const draft: PlannerDraft = {
    scheduleId: null, weekStart: '2026-09-07', baseRevision: null, snapshots: [snapshot],
    batches: [{ id: 'batch', scheduleId: '', snapshotId: snapshot.id, cookDate: '2026-09-07', producedPortions: 2, linkedFirstMealId: null }],
    slots: [
      { id: 'slot-1', scheduleId: '', localDate: '2026-09-07', mealType: 'lunch', batchId: 'batch', eatenPortions: 1, status: 'planned', linkedMealId: null },
      { id: 'slot-2', scheduleId: '', localDate: '2026-09-08', mealType: 'lunch', batchId: 'batch', eatenPortions: 1, status: 'planned', linkedMealId: null },
    ],
  };
  return saveMealSchedule(draft);
}

describe('planned meal logging', () => {
  beforeEach(() => openTestDatabase());
  afterEach(() => closeTestDatabase());

  test('review preserves unknown nutrients instead of displaying zero', () => {
    const result = plannerMealReview({
      snapshot, slot: { id: 'slot', scheduleId: '', localDate: '2026-09-07', mealType: 'lunch', batchId: 'batch', eatenPortions: 1, status: 'planned', linkedMealId: null },
      actualLocalDate: '2026-09-07', actualLoggedAt: '2026-09-07T12:00:00.000Z', eatenPortions: 1, productionPortions: 2,
    });
    expect(result.status).toBe('ready');
    if (result.status === 'ready') expect(result.meal.items[0]).toMatchObject({ quantity: 200, calories: null, proteinG: null });
  });

  test('atomic link is idempotent and later batch portions become leftovers', async () => {
    await plan();
    const mealInput = { loggedAt: '2026-09-07T12:00:00.000Z', localDate: '2026-09-07', mealType: 'lunch' as const, name: 'Planned soup', photoUri: null, source: 'recipe' as const, confidence: null, items: [] };
    const first = await insertPlannedMeal({ slotId: 'slot-1', idempotencyKey: 'save-1', eatenPortions: 1, productionPortions: 2, meal: mealInput, decrements: [] });
    expect((await insertPlannedMeal({ slotId: 'slot-1', idempotencyKey: 'save-1', eatenPortions: 1, productionPortions: 2, meal: mealInput, decrements: [] })).id).toBe(first.id);
    const leftover = await insertPlannedMeal({ slotId: 'slot-2', idempotencyKey: 'save-2', eatenPortions: 1, productionPortions: 2, meal: { ...mealInput, localDate: '2026-09-08' }, decrements: [] });
    expect(leftover.venue).toBe('leftovers');
  });

  test('meal deletion reopens its slot while retaining the plan', async () => {
    await plan();
    const meal = await insertPlannedMeal({
      slotId: 'slot-1', idempotencyKey: 'save', eatenPortions: 1, productionPortions: 2, decrements: [],
      meal: { loggedAt: '2026-09-07T12:00:00.000Z', localDate: '2026-09-07', mealType: 'lunch', name: 'Soup', photoUri: null, source: 'recipe', confidence: null, items: [] },
    });
    await deleteMeal(meal.id);
    expect((await getMealScheduleForWeek('2026-09-07'))?.slots.find((slot) => slot.id === 'slot-1')).toMatchObject({ status: 'planned', linkedMealId: null });
  });
});
