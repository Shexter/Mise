import { randomUUID } from 'expo-crypto';

import { db } from '@/db';
import { groceryRevisionKey } from '@/logic/plannerGroceries';
import { normalise } from '@/logic/normalise';
import type { PlanGroceryDemand, PlanPantryCoverage } from '@/types';
import type { TransactionHandle } from './types';

interface ApplicationRow { id: string; schedule_id: string; schedule_revision: number; revision_key: string; applied_at: string; undone_at: string | null }
interface ItemRow { id: string; requested_qty: number | null; requested_unit: string | null; status: string }

export async function savePlanPantryCoverage(scheduleId: string, coverage: PlanPantryCoverage): Promise<void> {
  if (coverage.coveredQuantity !== null && (!Number.isFinite(coverage.coveredQuantity) || coverage.coveredQuantity < 0)) {
    throw new Error('Covered quantity must be non-negative and finite');
  }
  await db().runAsync(
    `INSERT INTO plan_grocery_coverage
       (schedule_id, schedule_revision, demand_key, covered_qty, unit, have_enough, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(schedule_id, schedule_revision, demand_key) DO UPDATE SET
       covered_qty = excluded.covered_qty, unit = excluded.unit,
       have_enough = excluded.have_enough, reviewed_at = excluded.reviewed_at`,
    [scheduleId, coverage.scheduleRevision, coverage.demandKey, coverage.coveredQuantity, coverage.unit, coverage.haveEnough ? 1 : 0, new Date().toISOString()],
  );
}

export async function listPlanPantryCoverage(scheduleId: string, revision: number): Promise<PlanPantryCoverage[]> {
  const rows = await db().getAllAsync<{ demand_key: string; schedule_revision: number; covered_qty: number | null; unit: PlanPantryCoverage['unit']; have_enough: number }>(
    'SELECT * FROM plan_grocery_coverage WHERE schedule_id = ? AND schedule_revision = ?', [scheduleId, revision],
  );
  return rows.map((row) => ({ demandKey: row.demand_key, scheduleRevision: row.schedule_revision, coveredQuantity: row.covered_qty, unit: row.unit, haveEnough: row.have_enough === 1 }));
}

async function removeApplicationSources(txn: TransactionHandle, applicationId: string): Promise<void> {
  const rows = await txn.getAllAsync<{ source_key: string; shopping_item_id: string }>(
    'SELECT source_key, shopping_item_id FROM plan_grocery_contributions WHERE application_id = ?', [applicationId],
  );
  for (const row of rows) {
    await txn.runAsync("DELETE FROM shopping_list_sources WHERE shopping_item_id = ? AND kind = 'meal_plan' AND source_id = ?", [row.shopping_item_id, row.source_key]);
    await txn.runAsync(
      `DELETE FROM shopping_list_items WHERE id = ? AND status = 'open'
       AND NOT EXISTS (SELECT 1 FROM shopping_list_sources WHERE shopping_item_id = ?)`,
      [row.shopping_item_id, row.shopping_item_id],
    );
  }
}

async function findOrCreateOpenItem(txn: TransactionHandle, demand: PlanGroceryDemand, now: string): Promise<string> {
  const normalizedName = normalise(demand.displayName);
  const existing = demand.canonicalId
    ? await txn.getFirstAsync<ItemRow>("SELECT id, requested_qty, requested_unit, status FROM shopping_list_items WHERE canonical_id = ? AND status = 'open' ORDER BY created_at LIMIT 1", [demand.canonicalId])
    : await txn.getFirstAsync<ItemRow>("SELECT id, requested_qty, requested_unit, status FROM shopping_list_items WHERE canonical_id IS NULL AND normalized_name = ? AND status = 'open' ORDER BY created_at LIMIT 1", [normalizedName]);
  if (existing) return existing.id;
  const id = randomUUID();
  await txn.runAsync(
    `INSERT INTO shopping_list_items
       (id, canonical_id, display_name, normalized_name, status, requested_qty, requested_unit,
        note, category, sort_order, created_at, updated_at, completed_at)
     VALUES (?, ?, ?, ?, 'open', ?, ?, NULL, 'other', 0, ?, ?, NULL)`,
    [id, demand.canonicalId, demand.displayName, normalizedName, demand.quantity, demand.unit, now, now],
  );
  return id;
}

export interface ActivePlanGroceryApplication {
  id: string;
  scheduleRevision: number;
  revisionKey: string;
  appliedAt: string;
}

/**
 * The grocery revision currently standing against this schedule, or null when
 * none is.
 *
 * Read-only, and the reason it exists: without it the Shop screen cannot tell
 * "applied and still current" from "never applied" after a restart, so it could
 * neither offer Undo nor honestly show "Plan changed". Comparing this row's
 * `revisionKey` against `groceryRevisionKey` for the live plan is what makes
 * that distinction. Undone applications are excluded, so this returns null once
 * the standing revision has been undone even though the history row remains.
 */
export async function getActivePlanGroceryApplication(
  scheduleId: string,
): Promise<ActivePlanGroceryApplication | null> {
  const row = await db().getFirstAsync<ApplicationRow>(
    `SELECT * FROM plan_grocery_applications
     WHERE schedule_id = ? AND undone_at IS NULL
     ORDER BY applied_at DESC, rowid DESC
     LIMIT 1`,
    [scheduleId],
  );
  return row
    ? { id: row.id, scheduleRevision: row.schedule_revision, revisionKey: row.revision_key, appliedAt: row.applied_at }
    : null;
}

/** Applies a reviewed revision atomically. Repeating the same revision is a no-op. */
export async function applyPlanGroceries(
  scheduleId: string,
  scheduleRevision: number,
  demands: readonly PlanGroceryDemand[],
): Promise<string> {
  const revisionKey = groceryRevisionKey(scheduleId, scheduleRevision, demands);
  const already = await db().getFirstAsync<ApplicationRow>('SELECT * FROM plan_grocery_applications WHERE revision_key = ?', [revisionKey]);
  if (already?.undone_at === null) return already.id;
  const applicationId = randomUUID();
  const now = new Date().toISOString();
  await db().withExclusiveTransactionAsync(async (txn) => {
    const schedule = await txn.getFirstAsync<{ revision: number }>('SELECT revision FROM meal_schedules WHERE id = ?', [scheduleId]);
    if (!schedule || schedule.revision !== scheduleRevision) throw new Error('Plan changed — review groceries before applying');
    if (already) await txn.runAsync('DELETE FROM plan_grocery_applications WHERE id = ?', [already.id]);
    const previous = await txn.getAllAsync<ApplicationRow>('SELECT * FROM plan_grocery_applications WHERE schedule_id = ? AND undone_at IS NULL', [scheduleId]);
    for (const application of previous) {
      await removeApplicationSources(txn, application.id);
      await txn.runAsync('UPDATE plan_grocery_applications SET undone_at = ? WHERE id = ?', [now, application.id]);
    }
    await txn.runAsync(
      'INSERT INTO plan_grocery_applications (id, schedule_id, schedule_revision, revision_key, applied_at, undone_at) VALUES (?, ?, ?, ?, ?, NULL)',
      [applicationId, scheduleId, scheduleRevision, revisionKey, now],
    );
    for (const demand of demands) {
      if (demand.quantity === 0 && !demand.hasUnknownQuantity) continue;
      const shoppingItemId = await findOrCreateOpenItem(txn, demand, now);
      for (const contribution of demand.contributions) {
        await txn.runAsync(
          `INSERT INTO shopping_list_sources (id, shopping_item_id, kind, source_id, recipe_id, suggestion_id, created_at)
           VALUES (?, ?, 'meal_plan', ?, NULL, NULL, ?)`,
          [randomUUID(), shoppingItemId, contribution.sourceKey, now],
        );
        await txn.runAsync(
          `INSERT INTO plan_grocery_contributions
             (application_id, source_key, demand_key, shopping_item_id, requested_qty, requested_unit, has_unknown_qty)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [applicationId, contribution.sourceKey, demand.key, shoppingItemId, contribution.quantity, contribution.unit, contribution.quantity === null ? 1 : 0],
        );
      }
    }
  });
  return applicationId;
}

export async function undoPlanGroceries(applicationId: string): Promise<void> {
  const now = new Date().toISOString();
  await db().withExclusiveTransactionAsync(async (txn) => {
    const application = await txn.getFirstAsync<ApplicationRow>('SELECT * FROM plan_grocery_applications WHERE id = ?', [applicationId]);
    if (!application || application.undone_at !== null) return;
    const newer = await txn.getFirstAsync<{ id: string }>('SELECT id FROM plan_grocery_applications WHERE schedule_id = ? AND undone_at IS NULL AND applied_at > ?', [application.schedule_id, application.applied_at]);
    if (newer) throw new Error('A newer grocery revision is active and must be reviewed first');
    await removeApplicationSources(txn, applicationId);
    await txn.runAsync('UPDATE plan_grocery_applications SET undone_at = ? WHERE id = ?', [now, applicationId]);
  });
}

/** Transfers one explicitly identified saved-recipe request after its plan source exists. */
export async function transferRecipeGrocerySourceToPlan(params: {
  shoppingItemId: string;
  recipeId: string;
  recipeIngredientId: string;
  planSourceKey: string;
}): Promise<void> {
  await db().withExclusiveTransactionAsync(async (txn) => {
    const planSource = await txn.getFirstAsync<{ id: string }>(
      "SELECT id FROM shopping_list_sources WHERE shopping_item_id = ? AND kind = 'meal_plan' AND source_id = ?",
      [params.shoppingItemId, params.planSourceKey],
    );
    if (!planSource) throw new Error('Apply the meal-plan grocery revision before transferring this recipe request');
    await txn.runAsync(
      `DELETE FROM shopping_list_sources
       WHERE shopping_item_id = ? AND kind = 'recipe_missing' AND source_id = ? AND recipe_id = ?`,
      [params.shoppingItemId, params.recipeIngredientId, params.recipeId],
    );
  });
}
