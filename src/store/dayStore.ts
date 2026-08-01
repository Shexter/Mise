import { create } from 'zustand';

import {
  deleteMeal,
  ensureDailyTarget,
  getLoggedDates,
  getMealsForDate,
  insertMeal,
  restoreMeal,
  type NewMeal,
} from '@/db/queries';
import { localDateString } from '@/logic/dates';
import {
  depleteForMeal,
  undepleteForMeal,
  type DepletionSummary,
} from '@/logic/depletionService';
import { macroTargets } from '@/logic/macros';
import { macrosOfMeals } from '@/logic/scaling';
import { deletePhoto } from '@/media/photos';
import { useProfileStore } from '@/store/profileStore';
import type { DailyTarget, Macros, MealWithItems } from '@/types';

/** How long the undo toast stays up before the delete becomes permanent. */
export const UNDO_WINDOW_MS = 5_000;

interface DayState {
  selectedDate: string;
  /**
   * `true` means "track today"; a deliberate day pick sets it `false`. One
   * date field cannot express the difference between "27 July because that
   * is today" and "27 July because I asked" — this is what lets both a
   * long-running app stay current and a chosen day stay put.
   */
  following: boolean;
  loading: boolean;
  meals: MealWithItems[];
  target: DailyTarget | null;
  consumed: Macros;
  /** Dates with at least one meal, for the date strip dots. */
  loggedDates: string[];
  /** The last deleted meal, held until the undo window closes. */
  pendingUndo: MealWithItems | null;
  /** What the last commit decremented, so the change is visible not silent. */
  lastDepletion: DepletionSummary | null;

  selectDate: (localDate: string) => Promise<void>;
  /**
   * When `following`, moves `selectedDate` to today and refreshes. A no-op
   * when already there, so overlapping focus and foreground triggers cost
   * nothing. Called by lifecycle events (tab focus, app foreground), not
   * derived on every read — a getter that recomputed "today" on each render
   * would fight the existing `refresh()` flow for no benefit.
   */
  syncToToday: () => Promise<void>;
  /** Resumes tracking today. Call when the Today screen loses focus. */
  resumeFollowing: () => void;
  refresh: () => Promise<void>;
  addMeal: (meal: NewMeal) => Promise<MealWithItems>;
  clearLastDepletion: () => void;
  removeMeal: (id: string) => Promise<void>;
  undoRemove: () => Promise<void>;
  /** Makes the pending delete permanent and removes its photo. */
  commitRemove: () => void;
}

export const useDayStore = create<DayState>((set, get) => ({
  // Captured once, at module evaluation — a seed only, always overwritten
  // before display by `syncToToday`. Removing it would leave an undefined
  // day on first render, which is worse than a seed that can age.
  selectedDate: localDateString(),
  following: true,
  loading: true,
  meals: [],
  target: null,
  consumed: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  loggedDates: [],
  pendingUndo: null,
  lastDepletion: null,

  selectDate: async (localDate) => {
    // A tap is a deliberate pick and must survive the next re-sync.
    set({ selectedDate: localDate, following: false });
    await get().refresh();
  },

  syncToToday: async () => {
    if (!get().following) return;
    const today = localDateString();
    if (get().selectedDate === today) return;
    set({ selectedDate: today });
    await get().refresh();
  },

  resumeFollowing: () => set({ following: true }),

  refresh: async () => {
    const { selectedDate } = get();
    set({ loading: true });

    const meals = await getMealsForDate(selectedDate);
    const loggedDates = await getLoggedDates();
    const target = await resolveTarget(selectedDate, meals.length > 0);

    set({
      meals,
      loggedDates,
      target,
      consumed: macrosOfMeals(meals),
      loading: false,
    });
  },

  addMeal: async (meal) => {
    const profile = useProfileStore.getState().profile;
    if (profile) {
      await ensureDailyTarget(meal.localDate, profile);
    }
    const stored = await insertMeal(meal);
    // Depletion runs here, on commit — never while the user is still
    // correcting the estimate on the review screen. A failure must not cost
    // the user their meal, so it is caught rather than propagated.
    try {
      const summary = await depleteForMeal(stored);
      set({ lastDepletion: summary.names.length > 0 ? summary : null });
    } catch {
      set({ lastDepletion: null });
    }
    // The user pressed Save and must see the result — showing them nothing
    // because they happened to be viewing another day is the original bug.
    // The meal is filed under today (review.tsx computes that correctly and
    // this must not second-guess it), so after logging the view is on today
    // and tracking it again.
    set({ selectedDate: stored.localDate, following: true });
    await get().refresh();
    return stored;
  },

  removeMeal: async (id) => {
    // Commit any delete still waiting — one undo at a time.
    get().commitRemove();

    const meal = get().meals.find((candidate) => candidate.id === id) ?? null;
    // Reverse before the row goes: the ledger cascades with the meal.
    await undepleteForMeal(id);
    await deleteMeal(id);
    set({ pendingUndo: meal });
    await get().refresh();
  },

  undoRemove: async () => {
    const meal = get().pendingUndo;
    if (!meal) return;
    set({ pendingUndo: null });
    await restoreMeal(meal);
    // Undo restores the meal, so its depletion has to come back with it.
    try {
      await depleteForMeal(meal);
    } catch {
      // Stock stays as it was; the meal itself is what the user asked back.
    }
    await get().refresh();
  },

  clearLastDepletion: () => set({ lastDepletion: null }),

  commitRemove: () => {
    const meal = get().pendingUndo;
    if (!meal) return;
    deletePhoto(meal.photoUri);
    set({ pendingUndo: null });
  },
}));

/**
 * A day's target: the one stored at the time if the day has been logged,
 * otherwise the live profile target. Days with no meals get no stored row, so
 * changing the profile updates them until the first meal lands.
 */
async function resolveTarget(
  localDate: string,
  hasMeals: boolean,
): Promise<DailyTarget | null> {
  const profile = useProfileStore.getState().profile;
  if (!profile) return null;

  if (hasMeals) {
    return ensureDailyTarget(localDate, profile);
  }

  const macros = macroTargets(profile.targetCalories, {
    proteinPct: profile.proteinPct,
    carbsPct: profile.carbsPct,
    fatPct: profile.fatPct,
  });
  return {
    localDate,
    targetCalories: profile.targetCalories,
    proteinG: macros.proteinG,
    carbsG: macros.carbsG,
    fatG: macros.fatG,
  };
}
