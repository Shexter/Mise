import { create } from 'zustand';

import {
  getMealScheduleForWeek,
  getPlannerDraft,
  saveMealSchedule,
  savePlannerDraft,
} from '@/db/queries';
import { localDateString, weekOf } from '@/logic/dates';
import type { MealSchedule, PlannerDraft } from '@/types';

type PlannerStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

interface MealScheduleState {
  status: PlannerStatus;
  selectedDate: string;
  schedule: MealSchedule | null;
  draft: PlannerDraft | null;
  error: string | null;
  selectDate: (localDate: string) => void;
  load: (localDate?: string) => Promise<void>;
  updateDraft: (draft: PlannerDraft) => Promise<void>;
  save: () => Promise<void>;
  retry: () => Promise<void>;
}

function emptyDraft(weekStart: string): PlannerDraft {
  return { scheduleId: null, weekStart, baseRevision: null, slots: [], batches: [], snapshots: [] };
}

function draftFromSchedule(schedule: MealSchedule): PlannerDraft {
  return {
    scheduleId: schedule.id, weekStart: schedule.weekStart, baseRevision: schedule.revision,
    slots: schedule.slots, batches: schedule.batches, snapshots: schedule.snapshots,
  };
}

export const useMealScheduleStore = create<MealScheduleState>((set, get) => ({
  status: 'idle', selectedDate: localDateString(), schedule: null, draft: null, error: null,

  selectDate: (selectedDate) => set({ selectedDate }),

  load: async (localDate = get().selectedDate) => {
    const weekStart = weekOf(localDate)[0]!;
    set({ status: 'loading', selectedDate: localDate, error: null });
    // Paging through weeks starts a read per week, and a slow one can land
    // after a faster later one. A result is only applied while its week is
    // still the week on screen, so an old read cannot replace a newer plan —
    // and cannot report an old week's failure against the current one either.
    const stale = () => weekOf(get().selectedDate)[0] !== weekStart;
    try {
      const [schedule, preserved] = await Promise.all([
        getMealScheduleForWeek(weekStart), getPlannerDraft(weekStart),
      ]);
      if (stale()) return;
      set({ schedule, draft: preserved ?? (schedule ? draftFromSchedule(schedule) : emptyDraft(weekStart)), status: 'ready' });
    } catch (error) {
      if (stale()) return;
      set({ status: 'error', error: error instanceof Error ? error.message : 'Meal plan could not be loaded' });
    }
  },

  updateDraft: async (draft) => {
    set({ draft, error: null });
    try {
      await savePlannerDraft(draft);
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : 'Draft could not be preserved' });
    }
  },

  save: async () => {
    const draft = get().draft;
    if (!draft) return;
    set({ status: 'saving', error: null });
    try {
      const schedule = await saveMealSchedule(draft);
      set({ schedule, draft: draftFromSchedule(schedule), status: 'ready' });
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : 'Meal plan could not be saved' });
      await savePlannerDraft(draft).catch(() => undefined);
    }
  },

  retry: async () => get().load(get().selectedDate),
}));
