import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { applyPlanGroceries, attachExtractedLines, getReceipt, insertCapturedReceipt, listShoppingItems, matchShoppingItemToReceipt, saveMealSchedule, undoPlanGroceries } from '@/db/queries';
import { buildPlanGroceryDemand, demandAfterCoverage, diffPlanGroceryDemand } from '@/logic/plannerGroceries';
import type { PlannerDraft, PlannerRecipeSnapshot } from '@/types';
import { closeTestDatabase, db, openTestDatabase } from './stubs/db';

const nutrition = { calories: null, proteinG: null, carbsG: null, fatG: null, fibreG: null, source: null } as const;
const snapshot: PlannerRecipeSnapshot = {
  id: 'snapshot', sourceKind: 'starter', sourceId: 'recipe', sourceVersion: '1', title: 'Batch bowl',
  mealTypes: ['lunch'], cuisines: [], baseYield: 4, durationMinutes: null, requiredAppliances: [], steps: [],
  ingredients: [
    { id: 'rice', canonicalId: null, name: 'Rice', quantity: 600, unit: 'g', preparation: 'dry', optional: false, included: true, nutrition },
    { id: 'garnish', canonicalId: null, name: 'Garnish', quantity: null, unit: null, preparation: null, optional: true, included: true, nutrition },
  ],
  nutritionPerPortion: nutrition, createdAt: '2026-09-07T00:00:00.000Z',
};

const batches = [
  { id: 'batch-a', scheduleId: 'schedule', snapshotId: snapshot.id, cookDate: '2026-09-07', producedPortions: 4, linkedFirstMealId: null },
  { id: 'batch-b', scheduleId: 'schedule', snapshotId: snapshot.id, cookDate: '2026-09-09', producedPortions: 2, linkedFirstMealId: null },
];

describe('plan grocery calculation', () => {
  test('aggregates cooking batches once and preserves unknown contributions', () => {
    const demands = buildPlanGroceryDemand({ batches, snapshots: [snapshot] });
    expect(demands.find((demand) => demand.displayName === 'Rice')?.quantity).toBe(900);
    expect(demands.find((demand) => demand.displayName === 'Garnish')).toMatchObject({ quantity: null, hasUnknownQuantity: true });
  });

  test('coverage is optional and invalidated by a revision change', () => {
    const demand = buildPlanGroceryDemand({ batches: [batches[0]!], snapshots: [snapshot] })[0]!;
    const coverage = { demandKey: demand.key, scheduleRevision: 1, coveredQuantity: 100, unit: 'g' as const, haveEnough: false };
    expect(demandAfterCoverage(demand, undefined, 1).quantity).toBe(600);
    expect(demandAfterCoverage(demand, coverage, 1).quantity).toBe(500);
    expect(demandAfterCoverage(demand, coverage, 2).quantity).toBe(600);
  });

  test('diff identifies changed and removed demand', () => {
    const before = buildPlanGroceryDemand({ batches, snapshots: [snapshot] });
    const after = buildPlanGroceryDemand({ batches: [batches[0]!], snapshots: [snapshot] });
    const diff = diffPlanGroceryDemand(before, after);
    expect(diff.changed.some((item) => item.displayName === 'Rice')).toBe(true);
  });
});

describe('plan grocery persistence', () => {
  beforeEach(() => openTestDatabase());
  afterEach(() => closeTestDatabase());

  test('apply is idempotent and undo removes only plan-owned rows', async () => {
    const draft: PlannerDraft = {
      scheduleId: null, weekStart: '2026-09-07', baseRevision: null, snapshots: [snapshot],
      batches: [batches[0]!],
      slots: [{ id: 'slot', scheduleId: '', localDate: '2026-09-07', mealType: 'lunch', batchId: 'batch-a', eatenPortions: 1, status: 'planned', linkedMealId: null }],
    };
    const schedule = await saveMealSchedule(draft);
    const demands = buildPlanGroceryDemand({ batches: schedule.batches, snapshots: schedule.snapshots });
    const first = await applyPlanGroceries(schedule.id, schedule.revision, demands);
    expect(await applyPlanGroceries(schedule.id, schedule.revision, demands)).toBe(first);
    expect((await db().getAllAsync("SELECT * FROM shopping_list_sources WHERE kind = 'meal_plan'")).length).toBe(2);
    await undoPlanGroceries(first);
    expect((await db().getAllAsync("SELECT * FROM shopping_list_sources WHERE kind = 'meal_plan'")).length).toBe(0);
  });

  test('a stale plan revision cannot mutate Shop', async () => {
    const schedule = await saveMealSchedule({ scheduleId: null, weekStart: '2026-09-07', baseRevision: null, snapshots: [], batches: [], slots: [] });
    await expect(applyPlanGroceries(schedule.id, 99, [])).rejects.toThrow('Plan changed');
    expect(await db().getAllAsync('SELECT * FROM shopping_list_items')).toHaveLength(0);
  });

  test('apply rolls back every row when a later contribution fails', async () => {
    const schedule = await saveMealSchedule({ scheduleId: null, weekStart: '2026-09-07', baseRevision: null, snapshots: [], batches: [], slots: [] });
    const demands = [
      { key: 'text:beans:g', canonicalId: null, displayName: 'Beans', quantity: 1, unit: 'g' as const, hasUnknownQuantity: false, contributions: [{ sourceKey: 'batch:beans', batchId: 'batch', snapshotIngredientId: 'beans', canonicalId: null, displayName: 'Beans', quantity: 1, unit: 'g' as const }] },
      { key: 'canonical:missing:g', canonicalId: 'missing-canonical', displayName: 'Missing', quantity: 1, unit: 'g' as const, hasUnknownQuantity: false, contributions: [{ sourceKey: 'batch:missing', batchId: 'batch', snapshotIngredientId: 'missing', canonicalId: 'missing-canonical', displayName: 'Missing', quantity: 1, unit: 'g' as const }] },
    ];
    await expect(applyPlanGroceries(schedule.id, schedule.revision, demands)).rejects.toThrow();
    expect(await db().getAllAsync('SELECT * FROM shopping_list_items')).toHaveLength(0);
    expect(await db().getAllAsync('SELECT * FROM plan_grocery_applications')).toHaveLength(0);
  });

  test('a partial receipt purchase preserves the outstanding weekly row', async () => {
    const schedule = await saveMealSchedule({
      scheduleId: null, weekStart: '2026-09-07', baseRevision: null, snapshots: [snapshot], batches: [batches[0]!],
      slots: [{ id: 'slot', scheduleId: '', localDate: '2026-09-07', mealType: 'lunch', batchId: 'batch-a', eatenPortions: 1, status: 'planned', linkedMealId: null }],
    });
    const demands = buildPlanGroceryDemand({ batches: schedule.batches, snapshots: schedule.snapshots });
    await applyPlanGroceries(schedule.id, schedule.revision, demands);
    const rice = (await listShoppingItems()).find((item) => item.displayName === 'Rice')!;
    const receipt = await insertCapturedReceipt('file://receipt.jpg', '2026-09-07');
    await attachExtractedLines(receipt.id, {
      store: 'Test', purchasedAt: '2026-09-07', receiptType: 'grocery', subtotalCents: null, taxCents: null, totalCents: null,
      lines: [{ rawText: 'Rice', kind: 'food', qty: 300, unit: 'g', quantityKind: 'measure', lineTotalCents: 500, unitPriceCents: null, appliesToText: null }],
    });
    const line = (await getReceipt(receipt.id))!.lines[0]!;
    await matchShoppingItemToReceipt(rice.id, receipt.id, line.id);
    expect((await listShoppingItems(true)).find((item) => item.id === rice.id)?.status).toBe('open');
  });
});
