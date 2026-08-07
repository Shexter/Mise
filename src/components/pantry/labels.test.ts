import { describe, expect, test } from 'vitest';

import { expiryLabel } from '@/components/pantry/labels';

describe('expiryLabel', () => {
  test.each([
    [null, false, 'No date'],
    [-1, true, 'Past its expected quality date (est.)'],
    [0, true, 'Best quality today (est.)'],
    [1, false, 'Best quality through tomorrow'],
    [4, true, 'About 4 days of expected quality (est.)'],
  ])('describes %s days as advisory quality timing', (daysLeft, predicted, expected) => {
    expect(expiryLabel({ daysLeft, expiryIsPredicted: predicted })).toBe(expected);
  });

  test('never presents a safety verdict', () => {
    for (const daysLeft of [-2, 0, 1, 12, null]) {
      expect(expiryLabel({ daysLeft, expiryIsPredicted: true })).not.toMatch(/safe|unsafe/i);
    }
  });
});
