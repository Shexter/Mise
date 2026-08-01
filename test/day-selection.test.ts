import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * The clock-controlled regression tests for `fix-day-selection`.
 *
 * No existing suite could catch this bug: every test in the repo runs at a
 * single instant, and the failure mode is specifically the passage of time
 * (or a navigation) that the store never reacts to. `vi.setSystemTime` lets
 * these tests simulate that without waiting or faking `dates.ts` itself,
 * which already takes an injectable date everywhere except the store's
 * module-load initialiser — the one spot this bug lived.
 *
 * `dayStore` is imported fresh per test (`vi.resetModules` + dynamic
 * `import()`) so its `selectedDate: localDateString()` seed captures
 * whatever fake "now" is active at that moment, mirroring how the real
 * module captures whatever moment the JS context first evaluates it.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

/**
 * `vi.resetModules()` is what lets a fresh `dayStore` import capture a new
 * fake "now" in its module-load seed — but it also resets the `@/db` stub,
 * whose open handle lives in module scope. So the database has to be
 * (re)opened *after* the reset, from that same fresh module instance, or
 * every query past the first fails with "used before openTestDatabase()".
 */
async function freshDayStore(now: string) {
  vi.setSystemTime(new Date(now));
  vi.resetModules();
  const { openTestDatabase } = await import('./stubs/db');
  openTestDatabase();
  const mod = await import('@/store/dayStore');
  return mod.useDayStore;
}

describe('a long-running store follows today once synced', () => {
  test('advancing the clock and syncing shows the new day', async () => {
    const useDayStore = await freshDayStore('2026-06-01T10:00:00');
    expect(useDayStore.getState().selectedDate).toBe('2026-06-01');

    // The app context stays alive — nothing reopens the module — while the
    // real date moves on, exactly as happens in a standalone Android build.
    vi.setSystemTime(new Date('2026-06-04T09:00:00'));

    // Before syncToToday exists, selectedDate has no path back to "now" and
    // this assertion fails — which is the bug, reproduced.
    await useDayStore.getState().syncToToday();
    expect(useDayStore.getState().selectedDate).toBe('2026-06-04');
  });

  test('syncing when already on today does not thrash loading state', async () => {
    const useDayStore = await freshDayStore('2026-06-01T10:00:00');
    await useDayStore.getState().refresh();
    useDayStore.setState({ loading: false });

    await useDayStore.getState().syncToToday();
    // No date change means no reason to have flipped through a loading state.
    expect(useDayStore.getState().loading).toBe(false);
    expect(useDayStore.getState().selectedDate).toBe('2026-06-01');
  });
});

describe('a deliberately chosen day is respected while the user stays there', () => {
  test('reading and interacting does not move the selection on its own', async () => {
    const useDayStore = await freshDayStore('2026-06-05T20:00:00');
    await useDayStore.getState().selectDate('2026-06-01');
    expect(useDayStore.getState().following).toBe(false);

    // "Scrolling and reading" is any number of refreshes and syncs while
    // still on the same visit — none of them may snap the view back.
    await useDayStore.getState().refresh();
    await useDayStore.getState().syncToToday();
    await useDayStore.getState().refresh();

    expect(useDayStore.getState().selectedDate).toBe('2026-06-01');
  });

  test('leaving and returning to the screen resets to today', async () => {
    const useDayStore = await freshDayStore('2026-06-05T20:00:00');
    await useDayStore.getState().selectDate('2026-06-01');

    // Leaving the Today tab: the focus effect's cleanup calls this.
    useDayStore.getState().resumeFollowing();
    expect(useDayStore.getState().following).toBe(true);

    // Returning to the Today tab: the focus effect calls this again.
    await useDayStore.getState().syncToToday();
    expect(useDayStore.getState().selectedDate).toBe('2026-06-05');
  });
});

describe('saving a meal while viewing an earlier day', () => {
  test('the view moves to the meal’s day, and the meal is visible', async () => {
    const useDayStore = await freshDayStore('2026-06-05T20:00:00');

    // The user has scrubbed back to look at an earlier day.
    await useDayStore.getState().selectDate('2026-06-01');
    expect(useDayStore.getState().selectedDate).toBe('2026-06-01');

    const stored = await useDayStore.getState().addMeal({
      loggedAt: '2026-06-05T20:00:00.000Z',
      localDate: '2026-06-05',
      mealType: 'dinner',
      name: 'Curry',
      photoUri: null,
      source: 'manual',
      confidence: null,
      venue: 'home',
      items: [
        {
          name: 'Curry',
          quantity: 1,
          unit: 'serving',
          calories: 500,
          proteinG: 20,
          carbsG: 40,
          fatG: 15,
          isManualAddition: false,
        },
      ],
    });

    // The meal is always filed under today, never the day being viewed —
    // this must not change.
    expect(stored.localDate).toBe('2026-06-05');

    // The view follows the meal. Pre-fix, this branch only ever touched
    // `loggedDates` and left `selectedDate` on 2026-06-01.
    expect(useDayStore.getState().selectedDate).toBe('2026-06-05');
    expect(
      useDayStore.getState().meals.some((meal) => meal.id === stored.id),
    ).toBe(true);
  });
});
