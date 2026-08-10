import { describe, expect, test } from 'vitest';

import {
  addMonths,
  addWeeks,
  monthLabel,
  monthOf,
} from '../src/logic/dates';

describe('history calendar date helpers', () => {
  test('a Monday-starting month begins on the first and fills through Sunday', () => {
    const grid = monthOf('2025-09-12');
    expect(grid).toHaveLength(35);
    expect(grid[0]).toBe('2025-09-01');
    expect(grid.at(-1)).toBe('2025-10-05');
  });

  test('a Sunday-starting month includes the preceding Monday-first week', () => {
    const grid = monthOf('2025-06-01');
    expect(grid[0]).toBe('2025-05-26');
    expect(grid[6]).toBe('2025-06-01');
    expect(grid.at(-1)).toBe('2025-07-06');
  });

  test('leap-year February includes 29 February and both adjacent months', () => {
    const grid = monthOf('2024-02-10');
    expect(grid).toContain('2024-02-29');
    expect(grid[0]).toBe('2024-01-29');
    expect(grid.at(-1)).toBe('2024-03-03');
  });

  test('month and week arithmetic stays in local-date strings', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addWeeks('2026-08-09', -1)).toBe('2026-08-02');
    expect(monthLabel('2026-08-09')).toBe('August 2026');
  });
});
