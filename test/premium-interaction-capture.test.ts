import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const mealCapture = readFileSync('app/capture.tsx', 'utf8');
const pantryCapture = readFileSync('app/pantry-capture.tsx', 'utf8');
const review = readFileSync('app/review.tsx', 'utf8');
const dinner = readFileSync('app/dinner.tsx', 'utf8');

describe('premium interaction capture lifecycle', () => {
  test('meal capture is duplicate-safe and provides a recoverable preparation path', () => {
    expect(mealCapture).toContain('if (!cameraRef.current || busy) return');
    expect(mealCapture).toContain('setPreparationError(');
    expect(mealCapture).toContain('Try another photo');
    expect(mealCapture).toContain('Enter by hand');
    expect(mealCapture).toContain('accessibilityLiveRegion="polite"');
  });

  test('unusable pantry photos are discarded before a manual-or-retry choice', () => {
    const nothingStart = pantryCapture.indexOf("if (capture.kind === 'nothing')");
    const nothingEnd = pantryCapture.indexOf("if (capture.kind === 'unclear')", nothingStart);
    const nothingBranch = pantryCapture.slice(nothingStart, nothingEnd);
    expect(nothingBranch).toContain('deletePhoto(photo.uri)');
    expect(nothingBranch).toContain('showManualOrRetry(');
    expect(nothingBranch).not.toContain('setReview(');
  });

  test('provider failures retain the existing pending path before feedback', () => {
    expect(pantryCapture.indexOf('await insertPendingCapture(photo.uri)')).toBeLessThan(
      pantryCapture.indexOf("kind: 'pending'"),
    );
    expect(pantryCapture).toContain('Saved captures are full');
    expect(pantryCapture).toContain("kind: 'recoverable-error'");
  });

  test('analysis and suggestion states announce progress without writing early', () => {
    const estimateStart = review.indexOf('const runEstimate');
    const estimateEnd = review.indexOf('const totals', estimateStart);
    expect(review.slice(estimateStart, estimateEnd)).not.toContain('addMeal(');
    expect(review).toContain('Reading your plate…');
    expect(review).toContain('accessibilityRole="alert"');
    expect(dinner).toContain('Finding ideas from your pantry…');
    expect(dinner).toContain('accessibilityLiveRegion="polite"');
  });
});
