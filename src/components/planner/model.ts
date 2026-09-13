import { randomUUID } from 'expo-crypto';

import { friendlyDate, isFuture, isToday, weekOf } from '@/logic/dates';
import { moveSlot, PlannerConflictError, slotKey, validateDraft } from '@/logic/plannerSchedule';
import type {
  PlannedBatch,
  PlannedMealSlot,
  PlannedMealType,
  PlannerDraft,
  PlannerRecipeSnapshot,
} from '@/types';

/**
 * View-model over `PlannerDraft`. Every operation returns a new draft and runs
 * `validateDraft` before handing it back, so a screen never persists a draft
 * that breaks slot uniqueness, batch capacity or the cook-before-eat rule — the
 * editor surfaces the error instead of writing it.
 *
 * Pure: no store, no database, no navigation. That is what lets the tap actions
 * and the drag gestures in `app/plan` share one set of rules rather than
 * growing two.
 */

export const MEAL_TYPES: readonly PlannedMealType[] = ['breakfast', 'lunch', 'dinner'];

export const MEAL_TYPE_LABEL: Record<PlannedMealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

export interface ResolvedSlot {
  slot: PlannedMealSlot;
  batch: PlannedBatch;
  snapshot: PlannerRecipeSnapshot;
  /** True when another slot eats from the same batch. */
  shared: boolean;
}

export interface DaySlots {
  localDate: string;
  entries: { mealType: PlannedMealType; resolved: ResolvedSlot | null }[];
}

export function resolveSlot(draft: PlannerDraft, slot: PlannedMealSlot): ResolvedSlot | null {
  const batch = draft.batches.find((candidate) => candidate.id === slot.batchId);
  if (!batch) return null;
  const snapshot = draft.snapshots.find((candidate) => candidate.id === batch.snapshotId);
  if (!snapshot) return null;
  const shared = draft.slots.some((other) => other.id !== slot.id && other.batchId === batch.id);
  return { slot, batch, snapshot, shared };
}

export function slotsForDate(draft: PlannerDraft, localDate: string): DaySlots {
  return {
    localDate,
    entries: MEAL_TYPES.map((mealType) => {
      const slot = draft.slots.find(
        (candidate) => candidate.localDate === localDate && candidate.mealType === mealType,
      );
      return { mealType, resolved: slot ? resolveSlot(draft, slot) : null };
    }),
  };
}

export function weekDays(draft: PlannerDraft): string[] {
  return weekOf(draft.weekStart);
}

export interface WeekSummary {
  scheduledSlots: number;
  batches: number;
  filledDays: number;
  /** A week nobody has touched yet, which reads differently from a partial one. */
  empty: boolean;
}

export function weekSummary(draft: PlannerDraft): WeekSummary {
  const days = new Set(draft.slots.map((slot) => slot.localDate));
  return {
    scheduledSlots: draft.slots.length,
    batches: draft.batches.length,
    filledDays: days.size,
    empty: draft.slots.length === 0,
  };
}

/**
 * The one meal Today should offer to open. Only a slot that has not been logged
 * or skipped counts, and only on the selected day — a finished day gets "View
 * week" rather than a stale next-meal action.
 */
export function nextUpcomingSlot(draft: PlannerDraft, localDate: string): ResolvedSlot | null {
  const order = new Map(MEAL_TYPES.map((mealType, index) => [mealType, index]));
  const open = draft.slots
    .filter((slot) => slot.localDate === localDate && slot.status === 'planned')
    .sort((left, right) => order.get(left.mealType)! - order.get(right.mealType)!);
  for (const slot of open) {
    const resolved = resolveSlot(draft, slot);
    if (resolved) return resolved;
  }
  return null;
}

/** A day with at least one slot, none of them still waiting to be cooked. */
export function dayIsComplete(draft: PlannerDraft, localDate: string): boolean {
  const slots = draft.slots.filter((slot) => slot.localDate === localDate);
  return slots.length > 0 && slots.every((slot) => slot.status !== 'planned');
}

export interface BatchCapacity {
  produced: number;
  allocated: number;
  remaining: number;
}

export function batchCapacity(draft: PlannerDraft, batchId: string): BatchCapacity {
  const batch = draft.batches.find((candidate) => candidate.id === batchId);
  const produced = batch?.producedPortions ?? 0;
  const allocated = draft.slots
    .filter((slot) => slot.batchId === batchId && slot.status !== 'skipped')
    .reduce((total, slot) => total + slot.eatenPortions, 0);
  return { produced, allocated, remaining: produced - allocated };
}

function commit(draft: PlannerDraft, next: Partial<PlannerDraft>): PlannerDraft {
  const merged = { ...draft, ...next };
  validateDraft(merged);
  return merged;
}

export function isOccupied(draft: PlannerDraft, localDate: string, mealType: PlannedMealType): PlannedMealSlot | null {
  return draft.slots.find(
    (slot) => slotKey(slot.localDate, slot.mealType) === slotKey(localDate, mealType),
  ) ?? null;
}

/**
 * Schedules a recipe into a dated slot, cooking its own batch.
 *
 * `replace` is required when the destination already holds a meal; without it
 * this throws `PlannerConflictError` so the caller can ask rather than
 * overwrite silently.
 */
export function addRecipeToSlot(draft: PlannerDraft, params: {
  snapshot: PlannerRecipeSnapshot;
  localDate: string;
  mealType: PlannedMealType;
  eatenPortions: number;
  producedPortions: number;
  replace?: boolean;
  makeId?: () => string;
}): PlannerDraft {
  const makeId = params.makeId ?? randomUUID;
  const occupied = isOccupied(draft, params.localDate, params.mealType);
  if (occupied && !params.replace) throw new PlannerConflictError('Destination slot is occupied');

  const scheduleId = draft.scheduleId ?? '';
  const snapshotId = makeId();
  const snapshot: PlannerRecipeSnapshot = {
    ...params.snapshot,
    id: snapshotId,
    ingredients: params.snapshot.ingredients.map((ingredient) => ({ ...ingredient, id: makeId() })),
  };
  const batch: PlannedBatch = {
    id: makeId(), scheduleId, snapshotId,
    cookDate: params.localDate,
    producedPortions: params.producedPortions,
    linkedFirstMealId: null,
  };
  const slot: PlannedMealSlot = {
    id: makeId(), scheduleId,
    localDate: params.localDate, mealType: params.mealType,
    batchId: batch.id, eatenPortions: params.eatenPortions,
    status: 'planned', linkedMealId: null,
  };

  const kept = occupied ? draft.slots.filter((candidate) => candidate.id !== occupied.id) : draft.slots;
  return withoutOrphans(commit(draft, {
    slots: [...kept, slot],
    batches: [...draft.batches, batch],
    snapshots: [...draft.snapshots, snapshot],
  }));
}

/** Removes a slot, and its batch when nothing else eats from it. */
export function removeSlot(draft: PlannerDraft, slotId: string): PlannerDraft {
  return withoutOrphans(commit(draft, {
    slots: draft.slots.filter((slot) => slot.id !== slotId),
  }));
}

/**
 * Marks a slot skipped. The meal stays on the plan with a visible status rather
 * than disappearing, and its portions return to the batch's capacity.
 */
export function setSlotStatus(draft: PlannerDraft, slotId: string, status: PlannedMealSlot['status']): PlannerDraft {
  return commit(draft, {
    slots: draft.slots.map((slot) => slot.id === slotId ? { ...slot, status } : slot),
  });
}

export function moveSlotTo(draft: PlannerDraft, params: {
  slotId: string;
  localDate: string;
  mealType: PlannedMealType;
  replace?: boolean;
}): PlannerDraft {
  return withoutOrphans(commit(draft, {
    slots: moveSlot(draft.slots, params.slotId, params.localDate, params.mealType, params.replace),
  }));
}

/**
 * Copy that cooks again: a new batch of the same recipe on the new date. The
 * grocery list gains a second set of ingredients, which is the honest result of
 * cooking twice.
 */
export function copyAsNewBatch(draft: PlannerDraft, params: {
  slotId: string;
  localDate: string;
  mealType: PlannedMealType;
  replace?: boolean;
  makeId?: () => string;
}): PlannerDraft {
  const source = resolveSlotById(draft, params.slotId);
  return addRecipeToSlot(draft, {
    snapshot: source.snapshot,
    localDate: params.localDate,
    mealType: params.mealType,
    eatenPortions: source.slot.eatenPortions,
    producedPortions: source.batch.producedPortions,
    replace: params.replace,
    makeId: params.makeId,
  });
}

/**
 * Copy that eats leftovers: a new slot pointing at the *same* batch. Grocery
 * demand does not change, which is the whole point of batch cooking — and the
 * capacity check is what stops four lunches being claimed from a three-portion
 * batch.
 */
export function copyFromSameBatch(draft: PlannerDraft, params: {
  slotId: string;
  localDate: string;
  mealType: PlannedMealType;
  eatenPortions?: number;
  replace?: boolean;
  makeId?: () => string;
}): PlannerDraft {
  const makeId = params.makeId ?? randomUUID;
  const source = resolveSlotById(draft, params.slotId);
  const occupied = isOccupied(draft, params.localDate, params.mealType);
  if (occupied && !params.replace) throw new PlannerConflictError('Destination slot is occupied');
  if (params.localDate < source.batch.cookDate) {
    throw new Error('Leftovers cannot be eaten before the batch is cooked');
  }
  const slot: PlannedMealSlot = {
    id: makeId(), scheduleId: source.slot.scheduleId,
    localDate: params.localDate, mealType: params.mealType,
    batchId: source.batch.id,
    eatenPortions: params.eatenPortions ?? source.slot.eatenPortions,
    status: 'planned', linkedMealId: null,
  };
  const kept = occupied ? draft.slots.filter((candidate) => candidate.id !== occupied.id) : draft.slots;
  return withoutOrphans(commit(draft, { slots: [...kept, slot] }));
}

export function setEatenPortions(draft: PlannerDraft, slotId: string, eatenPortions: number): PlannerDraft {
  return commit(draft, {
    slots: draft.slots.map((slot) => slot.id === slotId ? { ...slot, eatenPortions } : slot),
  });
}

export function setProducedPortions(draft: PlannerDraft, batchId: string, producedPortions: number): PlannerDraft {
  return commit(draft, {
    batches: draft.batches.map((batch) => batch.id === batchId ? { ...batch, producedPortions } : batch),
  });
}

export function resolveSlotById(draft: PlannerDraft, slotId: string): ResolvedSlot {
  const slot = draft.slots.find((candidate) => candidate.id === slotId);
  if (!slot) throw new Error('Planned meal is no longer on the plan');
  const resolved = resolveSlot(draft, slot);
  if (!resolved) throw new Error('Planned meal has lost its recipe');
  return resolved;
}

/**
 * Drops batches and snapshots nothing points at any more. Without this, removing
 * the last slot of a batch would leave its ingredients on the grocery list for a
 * meal that is no longer planned.
 */
function withoutOrphans(draft: PlannerDraft): PlannerDraft {
  const usedBatches = new Set(draft.slots.map((slot) => slot.batchId));
  const batches = draft.batches.filter((batch) => usedBatches.has(batch.id));
  const usedSnapshots = new Set(batches.map((batch) => batch.snapshotId));
  return {
    ...draft,
    batches,
    snapshots: draft.snapshots.filter((snapshot) => usedSnapshots.has(snapshot.id)),
  };
}

/** Slots whose date has not passed, used to decide what still needs cooking. */
export function isUpcoming(localDate: string): boolean {
  return isToday(localDate) || isFuture(localDate);
}

/**
 * Names a dated slot the way a person would say it: "today's lunch",
 * "Monday 8 September's lunch". `friendlyDate` collapses to a bare relative word
 * that does not survive being lowercased into a sentence, which is why this
 * exists rather than interpolating it directly.
 */
export function slotPhrase(localDate: string, mealType: PlannedMealType): string {
  const meal = MEAL_TYPE_LABEL[mealType].toLowerCase();
  if (isToday(localDate)) return `today's ${meal}`;
  return `${friendlyDate(localDate)} ${meal}`;
}
