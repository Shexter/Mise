import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { getMealScheduleForWeek, saveMealSchedule, StaleScheduleError } from '@/db/queries';
import type { PlannerDraft, PlannerRecipeSnapshot } from '@/types';
import { closeTestDatabase, openTestDatabase } from './stubs/db';

const snapshot: PlannerRecipeSnapshot = {
  id: 'snapshot', sourceKind: 'saved_recipe', sourceId: 'deleted-later', sourceVersion: 'v1',
  title: 'Stable snapshot', mealTypes: ['dinner'], cuisines: [], baseYield: 2,
  durationMinutes: null, requiredAppliances: [], ingredients: [], steps: [],
  nutritionPerPortion: { calories: null, proteinG: null, carbsG: null, fatG: null, fibreG: null, source: null },
  createdAt: '2026-09-07T00:00:00.000Z',
};

function draft(baseRevision: number | null = null): PlannerDraft {
  return {
    scheduleId: baseRevision === null ? null : 'schedule', weekStart: '2026-09-07', baseRevision,
    snapshots: [snapshot],
    batches: [{ id: 'batch', scheduleId: 'schedule', snapshotId: snapshot.id, cookDate: '2026-09-07', producedPortions: 2, linkedFirstMealId: null }],
    slots: [{ id: 'slot', scheduleId: 'schedule', localDate: '2026-09-08', mealType: 'dinner', batchId: 'batch', eatenPortions: 1, status: 'planned', linkedMealId: null }],
  };
}

describe('planner persistence', () => {
  beforeEach(() => openTestDatabase());
  afterEach(() => closeTestDatabase());

  test('saves and reopens an incomplete partial week with its immutable snapshot', async () => {
    const saved = await saveMealSchedule(draft());
    const reopened = await getMealScheduleForWeek('2026-09-07');
    expect(saved.revision).toBe(1);
    expect(reopened?.slots).toHaveLength(1);
    expect(reopened?.snapshots[0]).toEqual(snapshot);
  });

  test('rejects duplicate and stale saves without replacing committed data', async () => {
    const saved = await saveMealSchedule(draft());
    await expect(saveMealSchedule({ ...draft(99), scheduleId: saved.id })).rejects.toBeInstanceOf(StaleScheduleError);
    expect((await getMealScheduleForWeek('2026-09-07'))?.revision).toBe(1);
  });
});
