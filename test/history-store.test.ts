import { beforeEach, describe, expect, test } from 'vitest';

import { insertMeal } from '../src/db/queries';
import { localDateString } from '../src/logic/dates';
import { useDayStore } from '../src/store/dayStore';
import { openTestDatabase } from './stubs/db';

beforeEach(() => {
  openTestDatabase();
  useDayStore.setState({
    selectedDate: '2026-04-20', following: false, loading: false,
    meals: [], target: null,
    consumed: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    loggedDates: [], loggedDateSet: new Set(), earliestLoggedDate: null,
    monthSummaries: {}, pendingUndo: null, lastDepletion: null,
  });
});

async function log(localDate: string, calories: number) {
  return insertMeal({
    loggedAt: `${localDate}T12:00:00.000Z`, localDate, mealType: 'lunch',
    name: 'Meal', photoUri: null, source: 'manual', confidence: null,
    venue: 'out', items: [{ name: 'Meal', quantity: 1, unit: 'serving', calories,
      proteinG: 0, carbsG: 0, fatG: 0, isManualAddition: true }],
  });
}

describe('history state', () => {
  test('keeps ordered dates plus set membership and the earliest bound', async () => {
    await log('2026-04-20', 200);
    await log('2026-02-03', 300);
    await useDayStore.getState().refresh();
    const state = useDayStore.getState();
    expect(state.loggedDates).toHaveLength(2);
    expect(state.loggedDateSet.has('2026-02-03')).toBe(true);
    expect(state.earliestLoggedDate).toBe('2026-02-03');
  });

  test('caches each month until a meal mutation invalidates it', async () => {
    await log('2026-04-20', 200);
    const first = await useDayStore.getState().loadMonthSummaries('2026-04-10');
    await log('2026-04-21', 300);
    const cached = await useDayStore.getState().loadMonthSummaries('2026-04-01');
    expect(cached).toEqual(first);

    await useDayStore.getState().addMeal({
      loggedAt: '2026-04-22T12:00:00.000Z', localDate: '2026-04-22',
      mealType: 'lunch', name: 'New meal', photoUri: null, source: 'manual',
      confidence: null, venue: 'out', items: [{ name: 'New meal', quantity: 1,
        unit: 'serving', calories: 400, proteinG: 0, carbsG: 0, fatG: 0,
        isManualAddition: true }],
    });
    const refreshed = await useDayStore.getState().loadMonthSummaries('2026-04-01');
    expect(refreshed.map((row) => row.localDate)).toContain('2026-04-22');
  });

  test('a past date stops following and selecting today resumes it', async () => {
    await useDayStore.getState().selectDate('2026-01-01');
    expect(useDayStore.getState().following).toBe(false);
    await useDayStore.getState().selectDate(localDateString());
    expect(useDayStore.getState().following).toBe(true);
  });

  test('future dates cannot become selected', async () => {
    const before = useDayStore.getState().selectedDate;
    await useDayStore.getState().selectDate('2999-01-01');
    expect(useDayStore.getState().selectedDate).toBe(before);
  });
});
