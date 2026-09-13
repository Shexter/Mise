import { randomUUID } from 'expo-crypto';

import { db } from '@/db';
import { validateDraft, PlannerConflictError } from '@/logic/plannerSchedule';
import type {
  MealSchedule,
  PlannedBatch,
  PlannedMealSlot,
  PlannerDraft,
  PlannerRecipeSnapshot,
  WeekTemplate,
} from '@/types';
import type { TransactionHandle } from './types';

interface ScheduleRow { id: string; week_start: string; revision: number; created_at: string; updated_at: string }
interface SnapshotRow { payload_json: string }
interface BatchRow { id: string; schedule_id: string; snapshot_id: string; cook_date: string; produced_portions: number; linked_first_meal_id: string | null }
interface SlotRow { id: string; schedule_id: string; local_date: string; meal_type: PlannedMealSlot['mealType']; batch_id: string; eaten_portions: number; status: PlannedMealSlot['status']; linked_meal_id: string | null }
interface TemplateRow { id: string; name: string; entries_json: string; created_at: string; updated_at: string }
interface DraftRow { payload_json: string }

export class StaleScheduleError extends PlannerConflictError {}

function toBatch(row: BatchRow): PlannedBatch {
  return { id: row.id, scheduleId: row.schedule_id, snapshotId: row.snapshot_id, cookDate: row.cook_date, producedPortions: row.produced_portions, linkedFirstMealId: row.linked_first_meal_id };
}

function toSlot(row: SlotRow): PlannedMealSlot {
  return { id: row.id, scheduleId: row.schedule_id, localDate: row.local_date, mealType: row.meal_type, batchId: row.batch_id, eatenPortions: row.eaten_portions, status: row.status, linkedMealId: row.linked_meal_id };
}

async function readSchedule(row: ScheduleRow): Promise<MealSchedule> {
  const [snapshotRows, batchRows, slotRows] = await Promise.all([
    db().getAllAsync<SnapshotRow>('SELECT payload_json FROM planner_recipe_snapshots WHERE schedule_id = ? ORDER BY created_at, id', [row.id]),
    db().getAllAsync<BatchRow>('SELECT * FROM planned_batches WHERE schedule_id = ? ORDER BY cook_date, id', [row.id]),
    db().getAllAsync<SlotRow>('SELECT * FROM planned_meal_slots WHERE schedule_id = ? ORDER BY local_date, meal_type', [row.id]),
  ]);
  return {
    id: row.id, weekStart: row.week_start, revision: row.revision,
    createdAt: row.created_at, updatedAt: row.updated_at,
    snapshots: snapshotRows.map((item) => JSON.parse(item.payload_json) as PlannerRecipeSnapshot),
    batches: batchRows.map(toBatch), slots: slotRows.map(toSlot),
  };
}

export async function getMealSchedule(id: string): Promise<MealSchedule | null> {
  const row = await db().getFirstAsync<ScheduleRow>('SELECT * FROM meal_schedules WHERE id = ?', [id]);
  return row ? readSchedule(row) : null;
}

export async function getMealScheduleForWeek(weekStart: string): Promise<MealSchedule | null> {
  const row = await db().getFirstAsync<ScheduleRow>('SELECT * FROM meal_schedules WHERE week_start = ?', [weekStart]);
  return row ? readSchedule(row) : null;
}

export async function listMealSchedules(): Promise<MealSchedule[]> {
  const rows = await db().getAllAsync<ScheduleRow>('SELECT * FROM meal_schedules ORDER BY week_start ASC');
  return Promise.all(rows.map(readSchedule));
}

async function writeChildren(txn: TransactionHandle, scheduleId: string, draft: PlannerDraft): Promise<void> {
  for (const snapshot of draft.snapshots) {
    await txn.runAsync(
      'INSERT INTO planner_recipe_snapshots (id, schedule_id, source_kind, source_id, source_version, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [snapshot.id, scheduleId, snapshot.sourceKind, snapshot.sourceId, snapshot.sourceVersion, JSON.stringify(snapshot), snapshot.createdAt],
    );
  }
  for (const batch of draft.batches) {
    await txn.runAsync(
      'INSERT INTO planned_batches (id, schedule_id, snapshot_id, cook_date, produced_portions, linked_first_meal_id) VALUES (?, ?, ?, ?, ?, ?)',
      [batch.id, scheduleId, batch.snapshotId, batch.cookDate, batch.producedPortions, batch.linkedFirstMealId],
    );
  }
  for (const slot of draft.slots) {
    await txn.runAsync(
      'INSERT INTO planned_meal_slots (id, schedule_id, local_date, meal_type, batch_id, eaten_portions, status, linked_meal_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [slot.id, scheduleId, slot.localDate, slot.mealType, slot.batchId, slot.eatenPortions, slot.status, slot.linkedMealId],
    );
  }
}

/** Creates or replaces one week atomically. Existing callers must provide the revision they edited. */
export async function saveMealSchedule(draft: PlannerDraft): Promise<MealSchedule> {
  validateDraft(draft);
  const scheduleId = draft.scheduleId ?? randomUUID();
  const now = new Date().toISOString();
  await db().withExclusiveTransactionAsync(async (txn) => {
    const current = await txn.getFirstAsync<ScheduleRow>('SELECT * FROM meal_schedules WHERE id = ? OR week_start = ?', [scheduleId, draft.weekStart]);
    if (current && (draft.scheduleId !== current.id || draft.baseRevision !== current.revision)) {
      throw new StaleScheduleError('This meal plan changed. Reload it before applying your saved draft.');
    }
    if (!current) {
      if (draft.baseRevision !== null) throw new StaleScheduleError('The meal plan no longer exists.');
      await txn.runAsync('INSERT INTO meal_schedules (id, week_start, revision, created_at, updated_at) VALUES (?, ?, 1, ?, ?)', [scheduleId, draft.weekStart, now, now]);
    } else {
      await txn.runAsync('DELETE FROM planned_meal_slots WHERE schedule_id = ?', [scheduleId]);
      await txn.runAsync('DELETE FROM planned_batches WHERE schedule_id = ?', [scheduleId]);
      await txn.runAsync('DELETE FROM planner_recipe_snapshots WHERE schedule_id = ?', [scheduleId]);
      await txn.runAsync('UPDATE meal_schedules SET revision = revision + 1, updated_at = ? WHERE id = ?', [now, scheduleId]);
    }
    await writeChildren(txn, scheduleId, {
      ...draft,
      slots: draft.slots.map((slot) => ({ ...slot, scheduleId })),
      batches: draft.batches.map((batch) => ({ ...batch, scheduleId })),
    });
    await txn.runAsync('DELETE FROM planner_drafts WHERE week_start = ?', [draft.weekStart]);
  });
  const saved = await getMealSchedule(scheduleId);
  if (!saved) throw new Error('Saved meal plan could not be read');
  return saved;
}

export async function savePlannerDraft(draft: PlannerDraft): Promise<void> {
  await db().runAsync(
    `INSERT INTO planner_drafts (week_start, schedule_id, base_revision, payload_json, updated_at)
     VALUES (?, ?, ?, ?, ?) ON CONFLICT(week_start) DO UPDATE SET
     schedule_id = excluded.schedule_id, base_revision = excluded.base_revision,
     payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
    [draft.weekStart, draft.scheduleId, draft.baseRevision, JSON.stringify(draft), new Date().toISOString()],
  );
}

export async function getPlannerDraft(weekStart: string): Promise<PlannerDraft | null> {
  const row = await db().getFirstAsync<DraftRow>('SELECT payload_json FROM planner_drafts WHERE week_start = ?', [weekStart]);
  return row ? JSON.parse(row.payload_json) as PlannerDraft : null;
}

export async function saveWeekTemplate(template: WeekTemplate): Promise<void> {
  await db().runAsync(
    `INSERT INTO week_templates (id, name, entries_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, entries_json = excluded.entries_json, updated_at = excluded.updated_at`,
    [template.id, template.name, JSON.stringify(template.entries), template.createdAt, template.updatedAt],
  );
}

export async function listWeekTemplates(): Promise<WeekTemplate[]> {
  const rows = await db().getAllAsync<TemplateRow>('SELECT * FROM week_templates ORDER BY updated_at DESC');
  return rows.map((row) => ({ id: row.id, name: row.name, entries: JSON.parse(row.entries_json) as WeekTemplate['entries'], createdAt: row.created_at, updatedAt: row.updated_at }));
}

export async function deleteMealSchedule(id: string): Promise<void> {
  await db().runAsync('DELETE FROM meal_schedules WHERE id = ?', [id]);
}
