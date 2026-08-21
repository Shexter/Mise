import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const today = readFileSync('app/(tabs)/index.tsx', 'utf8');
const row = readFileSync('src/components/MealRow.tsx', 'utf8');
const editor = readFileSync('app/meal/[id].tsx', 'utf8');
const manual = readFileSync('app/manual.tsx', 'utf8');

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

  test('photo meals can be sent back through the AI review flow', () => {
    expect(editor).toContain('photoBase64(photoUri)');
    expect(editor).toContain('setCapture({ photoUri, base64, estimate: null })');
    expect(editor).toContain("router.push('/review')");
    expect(editor).toContain('Estimate with AI');
  });

  test('manual photo entries use the same re-estimate flow', () => {
    expect(manual).toContain('photoBase64(photoUri)');
    expect(manual).toContain('setCapture({ photoUri, base64, estimate: null })');
    expect(manual).toContain("router.replace('/review')");
    expect(manual).toContain('Estimate with AI');
  });
});
