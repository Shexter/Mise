import Storage from 'expo-sqlite/kv-store';

const STORAGE_KEY = 'mise.planner.intro-dismissed';

/**
 * Whether the one-time planning introduction has been dismissed.
 *
 * Kept in key-value storage rather than the database on purpose: it is a
 * per-install UI acknowledgement, not household data, so it has no business in
 * the export or in "Delete all data"'s food records — and it must never be
 * mistaken for evidence that someone has a plan.
 *
 * Existing installations get this cue exactly once. Onboarding is never
 * replayed, and no prior plan is invented for them.
 */
export function plannerIntroDismissed(): boolean {
  try {
    return Storage.getItemSync(STORAGE_KEY) === 'true';
  } catch {
    // A storage failure must not turn into a permanent nag, and must not hide
    // the cue either. Showing it is the recoverable direction.
    return false;
  }
}

export function dismissPlannerIntro(): void {
  try {
    Storage.setItemSync(STORAGE_KEY, 'true');
  } catch {
    // The cue reappears next launch. That is better than crashing Today.
  }
}
