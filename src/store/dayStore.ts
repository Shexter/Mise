import { create } from 'zustand';

import {
  deleteMeal,
  ensureDailyTarget,
  getDaySummaries,
  getMeal,
  getLoggedDates,
  getMealsForDate,
  insertMeal,
  restoreMeal,
  type NewMeal,
} from '@/db/queries';
import { addMonths, localDateString, monthOf } from '@/logic/dates';
import {
  depleteForMeal,
  saveEditedMeal,
  undepleteForMeal,
  type DepletionSummary,
} from '@/logic/depletionService';
import { mealsHaveSameEditableValues } from '@/logic/mealEdit';
import { macroTargets } from '@/logic/macros';
import { macrosOfMeals } from '@/logic/scaling';
import { deletePhoto } from '@/media/photos';
import { useProfileStore } from '@/store/profileStore';
import type { DailyTarget, DaySummary, Macros, MealWithItems } from '@/types';

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
  /** Constant-time membership for the week strip and month grid. */
  loggedDateSet: ReadonlySet<string>;
  earliestLoggedDate: string | null;
  /** One grouped query result per displayed calendar month. */
  monthSummaries: Record<string, DaySummary[]>;
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
  loadMonthSummaries: (localDate: string) => Promise<DaySummary[]>;
  addMeal: (meal: NewMeal) => Promise<MealWithItems>;
  updateMeal: (meal: MealWithItems) => Promise<MealWithItems>;
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
  loggedDateSet: new Set(),
  earliestLoggedDate: null,
  monthSummaries: {},
  pendingUndo: null,
  lastDepletion: null,

  selectDate: async (localDate) => {
    if (localDate > localDateString()) return;
    // A past tap is deliberate; choosing today resumes real-date following.
    set({ selectedDate: localDate, following: localDate === localDateString() });
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
      loggedDateSet: new Set(loggedDates),
      earliestLoggedDate:
        loggedDates.length === 0
          ? null
          : loggedDates.reduce((earliest, date) => date < earliest ? date : earliest),
      target,
      consumed: macrosOfMeals(meals),
      loading: false,
    });
  },

  loadMonthSummaries: async (localDate) => {
    const key = monthKey(localDate);
    const cached = get().monthSummaries[key];
    if (cached) return cached;
    const grid = monthOf(localDate);
    const summaries = await getDaySummaries(grid[0]!, grid[grid.length - 1]!);
    set((state) => ({
      monthSummaries: { ...state.monthSummaries, [key]: summaries },
    }));
    return summaries;
  },

  addMeal: async (meal) => {
    const profile = useProfileStore.getState().profile;
    if (profile) {
      await ensureDailyTarget(meal.localDate, profile);
    }
    const stored = await insertMeal(meal);
    set((state) => ({ monthSummaries: omitMonth(state.monthSummaries, stored.localDate) }));
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

  updateMeal: async (meal) => {
    const current = await getMeal(meal.id);
    if (!current) throw new Error('Meal no longer exists.');
    if (mealsHaveSameEditableValues(current, meal)) return current;

    // Planning is read-only; the actual meal, pantry, and ledger writes happen
    // together inside saveEditedMeal's query transaction.
    const { meal: stored, summary } = await saveEditedMeal(meal);
    set({
      lastDepletion: summary.names.length > 0 ? summary : null,
      selectedDate: stored.localDate,
      // Pushing the editor temporarily blurs Today, whose existing lifecycle
      // resumes following. Pin the edited date again before returning so a
      // deliberately selected past day does not jump to today.
      following: false,
      monthSummaries: omitMonth(get().monthSummaries, stored.localDate),
    });
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
    set((state) => ({
      pendingUndo: meal,
      monthSummaries: meal
        ? omitMonth(state.monthSummaries, meal.localDate)
        : state.monthSummaries,
    }));
    await get().refresh();
  },

  undoRemove: async () => {
    const meal = get().pendingUndo;
    if (!meal) return;
    set({ pendingUndo: null });
    await restoreMeal(meal);
    set((state) => ({
      monthSummaries: omitMonth(state.monthSummaries, meal.localDate),
    }));
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

function monthKey(localDate: string): string {
  return localDate.slice(0, 7);
}

function omitMonth(
  summaries: Record<string, DaySummary[]>,
  localDate: string,
): Record<string, DaySummary[]> {
  // Month grids include leading/trailing days, so a mutation can stale the
  // adjacent month's cached grid as well as its own.
  const centre = `${monthKey(localDate)}-15`;
  const keys = new Set([
    monthKey(localDate),
    monthKey(addMonths(centre, -1)),
    monthKey(addMonths(centre, 1)),
  ]);
  if (![...keys].some((key) => key in summaries)) return summaries;
  const next = { ...summaries };
  for (const key of keys) delete next[key];
  return next;
}

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
