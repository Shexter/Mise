import Storage from 'expo-sqlite/kv-store';

import { TODAY_PAGES, type TodayPage } from '@/logic/todayRoute';

const STORAGE_KEY = 'mise.today.page';

/**
 * Which of Today's two tasks was last chosen by hand.
 *
 * Key-value storage rather than the database, for the same reason the planner's
 * introduction cue lives there: this is a per-install presentation preference,
 * not household data. It has no place in the export, it is not deleted with
 * food records, and it must never be read as evidence that someone plans or
 * logs — only as the page they last tapped.
 *
 * Only a manual selection writes it. Arriving on Calories because a meal was
 * just saved does not make Calories the default for someone who plans.
 */
export function readTodayPagePreference(): TodayPage | null {
  try {
    const stored = Storage.getItemSync(STORAGE_KEY);
    return stored !== null && (TODAY_PAGES as readonly string[]).includes(stored)
      ? (stored as TodayPage)
      : null;
  } catch {
    // No preference is a usable answer: the caller falls back to Meal plan.
    return null;
  }
}

export function writeTodayPagePreference(page: TodayPage): void {
  try {
    Storage.setItemSync(STORAGE_KEY, page);
  } catch {
    // The next launch opens on the default. Losing a tab memory must never
    // cost someone the screen.
  }
}
