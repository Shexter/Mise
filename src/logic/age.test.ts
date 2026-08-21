import { describe, expect, test } from 'vitest';

import { ageOnDate, computeAge, isValidCalendarDate, validateAge } from '@/logic/age';

describe('calendar age', () => {
  const today = { year: 2026, month: 8, day: 20 };

  test('handles birthday today and tomorrow in local calendar terms', () => {
    expect(computeAge(2000, 8, 20, today)).toBe(26);
    expect(computeAge(2000, 8, 21, today)).toBe(25);
  });

  test('uses March 1 as the non-leap anniversary for February 29', () => {
    expect(ageOnDate({ year: 2004, month: 2, day: 29 }, { year: 2025, month: 2, day: 28 })).toBe(20);
    expect(ageOnDate({ year: 2004, month: 2, day: 29 }, { year: 2025, month: 3, day: 1 })).toBe(21);
  });

  test('rejects impossible calendar tuples', () => {
    expect(isValidCalendarDate({ year: 2025, month: 2, day: 29 })).toBe(false);
    expect(computeAge(2025, 2, 29, today)).toBeNaN();
  });

  test('enforces the canonical 15 through 99 range', () => {
    expect(validateAge(15)).toBe(true);
    expect(validateAge(99)).toBe(true);
    expect(validateAge(14)).toBe(false);
    expect(validateAge(100)).toBe(false);
    expect(validateAge(20.5)).toBe(false);
  });
});
