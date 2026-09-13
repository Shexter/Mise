import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { mealSavedMessage, pantryItemsAddedMessage } from '@/logic/feedback';

const review = readFileSync('app/review.tsx', 'utf8');
const manual = readFileSync('app/manual.tsx', 'utf8');
const dinner = readFileSync('app/dinner.tsx', 'utf8');
const pantryReview = readFileSync('app/pantry-capture-review.tsx', 'utf8');
const receiptReview = readFileSync('app/receipt-review.tsx', 'utf8');
const today = readFileSync('app/(tabs)/index.tsx', 'utf8');
const routeIntent = readFileSync('src/logic/todayRoute.ts', 'utf8');

describe('premium interaction save confirmation', () => {
  test('meal feedback names only actual pantry effects', () => {
    expect(mealSavedMessage([])).toBe('Meal saved.');
    expect(mealSavedMessage(['Rice'])).toBe('Meal saved — Rice updated.');
    expect(mealSavedMessage(['Rice', 'Eggs'])).toBe('Meal saved — Rice and Eggs updated.');
    expect(mealSavedMessage(['Rice', 'Eggs', 'Oil'])).toBe('Meal saved — 3 pantry items updated.');
  });

  test('pantry confirmation reports created item records, not a quantity estimate', () => {
    expect(pantryItemsAddedMessage(1)).toBe('Added 1 item to your pantry.');
    expect(pantryItemsAddedMessage(3)).toBe('Added 3 items to your pantry.');
  });

  test('meal routes use the shared success confirmation and return to Today', () => {
    for (const source of [review, manual, dinner]) {
      expect(source).toContain("kind: 'success'");
      expect(source).toContain('mealSavedMessage(depleted?.names ?? [])');
      expect(source).toContain("pathname: '/(tabs)'");
      expect(source).toContain('savedMealId: stored.id');
    }
  });

  test('pantry and receipt review confirm only after their existing writes', () => {
    expect(pantryReview.indexOf('await Promise.all')).toBeLessThan(pantryReview.indexOf('pantryItemsAddedMessage(accepted.length)'));
    expect(pantryReview).toContain("kind: 'success'");
    expect(receiptReview.indexOf('await acceptReceiptReview')).toBeLessThan(receiptReview.indexOf("kind: 'success'"));
    expect(receiptReview).toContain("router.replace('/(tabs)/pantry')");
  });

  test('Today clears a saved-meal route signal after the visible confirmation', () => {
    // The signal is now read through the shared route-intent resolver, which
    // also names Calories as the page a logged meal belongs on.
    expect(routeIntent).toContain("savedMealId");
    expect(routeIntent).toContain("highlightMealId !== null ? 'calories'");
    expect(today).toContain('setHighlightMealId(intent.highlightMealId)');
    expect(today).toContain('setHighlightMealId(null)');
    expect(today).toContain('router.setParams(clearedRouteParams(intent))');
    expect(today).toContain('duration.count');
  });

  test('a save names the page it finished on, without replacing the remembered one', () => {
    for (const source of [review, manual, dinner]) {
      expect(source).toContain("todayPage: 'calories'");
    }
    // Only a deliberate tap writes the preference.
    expect(today).toContain('writeTodayPagePreference(next)');
    expect(today).not.toContain('writeTodayPagePreference(intent');
  });
});
