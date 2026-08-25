import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const review = readFileSync('app/review.tsx', 'utf8');
const manual = readFileSync('app/manual.tsx', 'utf8');
const modifiers = readFileSync('src/components/review/MealModifierControls.tsx', 'utf8');
const suggestion = readFileSync('src/logic/suggestionService.ts', 'utf8');

describe('venue inference surfaces', () => {
  test('photo and manual unknown-origin flows infer before commit', () => {
    expect(review).toContain('inferVenueForDraft(mealName, items, venueAssessment)');
    expect(manual).toContain('inferVenueForDraft(');
    expect(review.indexOf('inferVenueForDraft')).toBeLessThan(review.indexOf('addMeal(meal)'));
  });

  test('the visible segmented control remains one action and wins over async inference', () => {
    for (const source of [review, manual]) {
      expect(source).toContain('venueChangedRef.current = true');
      expect(source).toContain('<MealModifierControls');
    }
    expect(modifiers).toContain('options={VENUE_OPTIONS}');
  });

  test('moving away from home clears the batch multiplier', () => {
    for (const source of [review, manual]) {
      expect(source).toContain('transitionMealVenue(current, inferred)');
    }
    expect(modifiers).toContain('transitionMealVenue(value, venue)');
  });

  test('the known suggestion path stays home and never enters inference or learning', () => {
    expect(suggestion).toContain("venue: 'home'");
    expect(suggestion).not.toContain('inferVenueForDraft');
    expect(suggestion).not.toContain('saveDishVenueDefault');
  });
});
