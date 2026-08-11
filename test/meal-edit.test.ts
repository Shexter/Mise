import { describe, expect, test } from 'vitest';

import {
  hasMealEditErrors,
  isMealDraftDirty,
  mealToDraft,
  normaliseMealDraft,
  validateMealDraft,
} from '../src/logic/mealEdit';
import type { MealWithItems } from '../src/types';

const meal: MealWithItems = {
  id: 'meal-1',
  loggedAt: '2026-08-08T19:00:00.000Z',
  localDate: '2026-08-08',
  mealType: 'dinner',
  name: 'Rice bowl',
  photoUri: 'file:///meal.jpg',
  source: 'photo',
  confidence: 'medium',
  venue: 'home',
  servingsMult: 2,
  createdAt: '2026-08-08T19:01:00.000Z',
  items: [
    {
      id: 'item-1', mealId: 'meal-1', name: 'Rice', quantity: 100, unit: 'g',
      calories: 130, proteinG: 0, carbsG: 28, fatG: 0, fibreG: null,
      isManualAddition: false, sortOrder: 0, canonicalId: 'jasmine-rice',
    },
  ],
};

describe('meal edit draft', () => {
  test('an unchanged draft is clean and accepts entered zero nutrients', () => {
    const draft = mealToDraft(meal);
    expect(isMealDraftDirty(draft)).toBe(false);
    expect(hasMealEditErrors(validateMealDraft(draft))).toBe(false);
  });

  test('rejects invalid numeric input and blank names', () => {
    const draft = mealToDraft(meal);
    draft.name = ' ';
    draft.items[0]!.quantity = 'nope';
    draft.items[0]!.fatG = '-1';
    const errors = validateMealDraft(draft);
    expect(errors.name).toBeTruthy();
    expect(errors.itemFields['item-1']?.quantity).toBeTruthy();
    expect(errors.itemFields['item-1']?.fatG).toBeTruthy();
  });

  test('keeps an unknown nutrient blank through editing instead of turning it into zero', () => {
    const draft = mealToDraft({
      ...meal,
      items: [{ ...meal.items[0]!, proteinG: null }],
    });
    expect(draft.items[0]?.proteinG).toBe('');
    expect(hasMealEditErrors(validateMealDraft(draft))).toBe(false);
    expect(normaliseMealDraft(draft).items[0]?.proteinG).toBeNull();
  });

  test('normalises non-home servings and preserves immutable provenance', () => {
    const draft = mealToDraft(meal);
    draft.name = '  Corrected bowl  ';
    draft.venue = 'out';
    draft.servingsMult = '9';
    const stored = normaliseMealDraft(draft);
    expect(stored.servingsMult).toBe(1);
    expect(stored.name).toBe('Corrected bowl');
    expect(stored).toMatchObject({
      id: meal.id, loggedAt: meal.loggedAt, localDate: meal.localDate,
      source: meal.source, confidence: meal.confidence, photoUri: meal.photoUri,
      createdAt: meal.createdAt,
    });
  });

  test('retains item ids and writes the current ordering', () => {
    const draft = mealToDraft({
      ...meal,
      items: [
        meal.items[0]!,
        { ...meal.items[0]!, id: 'item-2', name: 'Egg', sortOrder: 1 },
      ],
    });
    draft.items.reverse();
    const stored = normaliseMealDraft(draft);
    expect(stored.items.map((item) => [item.id, item.sortOrder])).toEqual([
      ['item-2', 0], ['item-1', 1],
    ]);
    expect(isMealDraftDirty(draft)).toBe(true);
  });
});
