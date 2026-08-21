import { describe, expect, test } from 'vitest';

import { activeMeal, createDeckState, mealDeckReducer } from '@/logic/mealDeck';
import type { Suggestion } from '@/types';

const meal = (dish: string): Suggestion => ({ dish, reasons: [], kcalPerServing: 400, servings: 2, effortMinutes: 20, uses: [], missing: [], method: [] });
const a = meal('A');
const b = meal('B');

describe('mealDeckReducer', () => {
  test('passes the front card and makes it undoable', () => {
    const state = mealDeckReducer(createDeckState([a, b]), { type: 'pass' });
    expect(activeMeal(state)).toBe(b);
    expect(state.passed).toEqual([{ meal: a, direction: 'left' }]);
  });

  test('accept keeps the card at front until cooking is confirmed', () => {
    const pending = mealDeckReducer(createDeckState([a, b]), { type: 'accept' });
    expect(activeMeal(pending)).toBe(a);
    expect(pending.pendingCook).toBe(a);
    const saved = mealDeckReducer(pending, { type: 'confirmCooked' });
    expect(activeMeal(saved)).toBe(b);
  });

  test('cancellation recovery keeps the accepted card at the front', () => {
    const pending = mealDeckReducer(createDeckState([a, b]), { type: 'accept' });
    const recovered = mealDeckReducer(pending, { type: 'cancellationRecovery' });
    expect(activeMeal(recovered)).toBe(a);
    expect(recovered.pendingCook).toBeNull();
  });

  test('undo restores the last passed card and records its entry edge', () => {
    const passed = mealDeckReducer(createDeckState([a, b]), { type: 'pass' });
    const restored = mealDeckReducer(passed, { type: 'undo' });
    expect(activeMeal(restored)).toBe(a);
    expect(restored.lastUndoDirection).toBe('left');
    expect(restored.passed).toEqual([]);
  });

  test('empty deck and exhaustion actions are safe', () => {
    const empty = createDeckState([]);
    expect(empty.exhausted).toBe(true);
    expect(mealDeckReducer(empty, { type: 'pass' })).toBe(empty);
    expect(mealDeckReducer(empty, { type: 'undo' })).toBe(empty);
    expect(mealDeckReducer(empty, { type: 'deckExhaustion' }).exhausted).toBe(true);
  });

  test('passing the final card exhausts the deck and undo recovers it', () => {
    const exhausted = mealDeckReducer(createDeckState([a]), { type: 'pass' });
    expect(exhausted.exhausted).toBe(true);
    expect(mealDeckReducer(exhausted, { type: 'undo' }).exhausted).toBe(false);
  });
});
