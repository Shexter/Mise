import type { Suggestion } from '@/types';

export interface DismissedMeal {
  meal: Suggestion;
  direction: 'left' | 'right';
}

export interface DeckState {
  meals: readonly Suggestion[];
  passed: readonly DismissedMeal[];
  pendingCook: Suggestion | null;
  lastUndoDirection: DismissedMeal['direction'] | null;
  exhausted: boolean;
}

export type DeckAction =
  | { type: 'replace'; meals: readonly Suggestion[] }
  | { type: 'pass' }
  | { type: 'accept' }
  | { type: 'confirmCooked' }
  | { type: 'cancellationRecovery' }
  | { type: 'undo' }
  | { type: 'deckExhaustion' };

export function createDeckState(meals: readonly Suggestion[]): DeckState {
  return { meals: [...meals], passed: [], pendingCook: null, lastUndoDirection: null, exhausted: meals.length === 0 };
}

export function activeMeal(state: DeckState): Suggestion | null {
  return state.meals[0] ?? null;
}

export function mealDeckReducer(state: DeckState, action: DeckAction): DeckState {
  switch (action.type) {
    case 'replace':
      return createDeckState(action.meals);
    case 'pass': {
      const meal = activeMeal(state);
      if (!meal || state.pendingCook) return state;
      const meals = state.meals.slice(1);
      return { ...state, meals, passed: [...state.passed, { meal, direction: 'left' }], lastUndoDirection: null, exhausted: meals.length === 0 };
    }
    case 'accept': {
      const meal = activeMeal(state);
      return !meal || state.pendingCook ? state : { ...state, pendingCook: meal };
    }
    case 'confirmCooked': {
      if (!state.pendingCook || activeMeal(state) !== state.pendingCook) return state;
      const meals = state.meals.slice(1);
      return { ...state, meals, pendingCook: null, lastUndoDirection: null, exhausted: meals.length === 0 };
    }
    case 'cancellationRecovery':
      return state.pendingCook ? { ...state, pendingCook: null } : state;
    case 'undo': {
      if (state.pendingCook || state.passed.length === 0) return state;
      const restored = state.passed[state.passed.length - 1]!;
      return {
        ...state,
        meals: [restored.meal, ...state.meals],
        passed: state.passed.slice(0, -1),
        lastUndoDirection: restored.direction,
        exhausted: false,
      };
    }
    case 'deckExhaustion':
      return state.meals.length === 0 ? { ...state, exhausted: true } : state;
  }
}
