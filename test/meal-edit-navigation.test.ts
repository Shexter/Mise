import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const today = readFileSync('app/(tabs)/index.tsx', 'utf8');
const row = readFileSync('src/components/MealRow.tsx', 'utf8');
const editor = readFileSync('app/meal/[id].tsx', 'utf8');

describe('logged meal edit navigation', () => {
  test('Today opens the selected dynamic meal route instead of a no-op', () => {
    expect(today).toContain('router.push(`/meal/${mealId}`)');
    expect(today).not.toContain('function scrollToMeal');
  });

  test('the row advertises edit activation and keeps swipe deletion', () => {
    expect(row).toContain('Double tap to edit meal details');
    expect(row).toContain('Swipe left to delete');
    expect(row).toContain('renderRightActions');
  });

  test('the dynamic editor loads its id and handles a missing meal', () => {
    expect(editor).toContain("useLocalSearchParams<{ id: string }>()");
    expect(editor).toContain('getMeal(id)');
    expect(editor).toContain('Meal no longer available');
  });
});
