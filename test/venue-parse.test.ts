import { describe, expect, test } from 'vitest';

import { parseEstimate } from '../src/api/parse';
import { SYSTEM_PROMPT } from '../src/api/prompt';

const BASE = {
  meal_name: 'Noodles',
  confidence: 'medium',
  items: [{ name: 'Noodles', quantity: 1, unit: 'serving', calories: 400 }],
  likely_hidden_ingredients: [],
};

describe('venue assessment in the existing estimate', () => {
  test.each(['home', 'out'] as const)('parses %s', (venue) => {
    expect(parseEstimate(JSON.stringify({ ...BASE, venue_assessment: venue })).venueAssessment)
      .toBe(venue);
  });

  test('an omitted or invalid assessment does not invalidate nutrition', () => {
    expect(parseEstimate(JSON.stringify(BASE))).toMatchObject({
      mealName: 'Noodles', venueAssessment: null,
    });
    expect(parseEstimate(JSON.stringify({ ...BASE, venue_assessment: 'leftovers' })).venueAssessment)
      .toBeNull();
  });

  test('the assessment is part of the one meal-estimate schema', () => {
    expect(SYSTEM_PROMPT).toContain('"venue_assessment": "home" | "out"');
  });
});
