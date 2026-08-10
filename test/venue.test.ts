import { describe, expect, test } from 'vitest';

import { inferVenue, STOCK_MATCH_THRESHOLD } from '../src/logic/venue';

describe('venue decision table', () => {
  test.each([
    ['assessment home', 'home', null, 0, null, 'home'],
    ['assessment out', 'out', null, 0, null, 'out'],
    ['stock home', null, STOCK_MATCH_THRESHOLD, 0, null, 'home'],
    ['stock out', null, 0, 0, null, 'out'],
    ['outstanding batch', null, null, 2, null, 'leftovers'],
    ['learned home', null, null, 0, 'home', 'home'],
    ['learned out', null, null, 0, 'out', 'out'],
    ['learned leftovers', null, null, 0, 'leftovers', 'leftovers'],
  ] as const)(
    '%s works as the only signal',
    (_label, assessment, stock, portions, learned, expected) => {
      expect(inferVenue(assessment, stock, portions, learned)).toBe(expected);
    },
  );

  test.each([
    ['home', STOCK_MATCH_THRESHOLD, 0, null, 'home'],
    ['out', 0, 0, null, 'out'],
    [null, null, 2, 'leftovers', 'leftovers'],
  ] as const)('agreeing signals reinforce %s', (assessment, stock, portions, learned, expected) => {
    expect(inferVenue(assessment, stock, portions, learned)).toBe(expected);
  });

  test.each([
    ['out', STOCK_MATCH_THRESHOLD, 0, null],
    ['home', 0, 0, null],
    ['out', null, 2, null],
    ['out', 0, 0, 'home'],
    ['home', STOCK_MATCH_THRESHOLD, 2, 'out'],
  ] as const)('conflict resolves deliberately to home', (assessment, stock, portions, learned) => {
    expect(inferVenue(assessment, stock, portions, learned)).toBe('home');
  });

  test('weak stock evidence is ignored and no signals default home', () => {
    expect(inferVenue(null, STOCK_MATCH_THRESHOLD - 0.01, 0)).toBe('home');
    expect(inferVenue(null, null, 0)).toBe('home');
  });
});
