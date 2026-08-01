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
  refresh: () => Promise<void>;
  addMeal: (meal: NewMeal) => Promise<MealWithItems>;
  clearLastDepletion: () => void;
  removeMeal: (id: string) => Promise<void>;
  undoRemove: () => Promise<void>;
  /** Makes the pending delete permanent and removes its photo. */
  commitRemove: () => void;
}

export const useDayStore = create<DayState>((set, get) => ({
  selectedDate: localDateString(),
  loading: true,
  meals: [],
  target: null,
  consumed: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  loggedDates: [],
  pendingUndo: null,
  lastDepletion: null,

  selectDate: async (localDate) => {
    set({ selectedDate: localDate });
    await get().refresh();
  },

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
    if (stored.localDate === get().selectedDate) {
      await get().refresh();
    } else {
      set({ loggedDates: await getLoggedDates() });
    }
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
