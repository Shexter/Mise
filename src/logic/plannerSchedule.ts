import { addDays } from 'date-fns';

import { localDateString, parseLocalDate, weekOf } from '@/logic/dates';
import type {
  PlannedBatch,
  PlannedMealSlot,
  PlannedMealType,
  PlannerDraft,
  WeekTemplate,
} from '@/types';

export class PlannerConflictError extends Error {}

export function assertPositivePortions(value: number, label = 'Portions'): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be positive and finite`);
}

export function slotKey(localDate: string, mealType: PlannedMealType): string {
  return `${localDate}:${mealType}`;
}

export function validateDraft(draft: PlannerDraft): void {
  const dates = new Set(weekOf(draft.weekStart));
  const keys = new Set<string>();
  const batches = new Map(draft.batches.map((batch) => [batch.id, batch]));
  const allocated = new Map<string, number>();
  for (const batch of draft.batches) {
    assertPositivePortions(batch.producedPortions, 'Produced portions');
  }
  for (const slot of draft.slots) {
    if (!dates.has(slot.localDate)) throw new Error('Slot date is outside the schedule week');
    const key = slotKey(slot.localDate, slot.mealType);
    if (keys.has(key)) throw new PlannerConflictError(`Slot ${key} is occupied`);
    keys.add(key);
    const batch = batches.get(slot.batchId);
    if (!batch) throw new Error('Slot references a missing batch');
    assertPositivePortions(slot.eatenPortions, 'Eaten portions');
    if (batch.cookDate > slot.localDate) throw new Error('A batch cannot be cooked after it is eaten');
    if (slot.status !== 'skipped') {
      allocated.set(batch.id, (allocated.get(batch.id) ?? 0) + slot.eatenPortions);
    }
  }
  for (const batch of draft.batches) {
    if ((allocated.get(batch.id) ?? 0) > batch.producedPortions) {
      throw new Error('Allocated portions exceed batch production');
    }
  }
}

export function moveSlot(
  slots: readonly PlannedMealSlot[],
  slotId: string,
  localDate: string,
  mealType: PlannedMealType,
  replace = false,
): PlannedMealSlot[] {
  const moving = slots.find((slot) => slot.id === slotId);
  if (!moving) throw new Error('Planned slot was not found');
  const occupied = slots.find((slot) => slot.id !== slotId && slotKey(slot.localDate, slot.mealType) === slotKey(localDate, mealType));
  if (occupied && !replace) throw new PlannerConflictError('Destination slot is occupied');
  return slots
    .filter((slot) => slot.id === slotId || slot.id !== occupied?.id)
    .map((slot) => slot.id === slotId ? { ...slot, localDate, mealType } : slot);
}

export function copyWeekTemplate(
  template: WeekTemplate,
  weekContaining: string,
  scheduleId: string,
  makeId: () => string,
): Pick<PlannerDraft, 'slots' | 'batches' | 'snapshots'> {
  const monday = weekOf(weekContaining)[0]!;
  const snapshots = template.entries.map((entry) => ({
    ...entry.snapshot,
    id: makeId(),
    ingredients: entry.snapshot.ingredients.map((ingredient) => ({ ...ingredient, id: makeId() })),
    createdAt: new Date().toISOString(),
  }));
  const batches: PlannedBatch[] = template.entries.map((entry, index) => ({
    id: makeId(), scheduleId, snapshotId: snapshots[index]!.id,
    cookDate: localDateString(addDays(parseLocalDate(monday), entry.weekday)),
    producedPortions: entry.producedPortions, linkedFirstMealId: null,
  }));
  const slots: PlannedMealSlot[] = template.entries.map((entry, index) => ({
    id: makeId(), scheduleId,
    localDate: localDateString(addDays(parseLocalDate(monday), entry.weekday)),
    mealType: entry.mealType, batchId: batches[index]!.id,
    eatenPortions: entry.eatenPortions, status: 'planned', linkedMealId: null,
  }));
  return { slots, batches, snapshots };
}
