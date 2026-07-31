import { describe, expect, test } from 'vitest';

import { normalise } from '@/logic/normalise';
import { MATCH_ACCEPT, MATCH_CONFIRM, similarity } from '@/logic/similarity';

describe('similarity', () => {
  test('identical strings score 1', () => {
    expect(similarity('soy sauce', 'soy sauce')).toBe(1);
  });

  test('empty strings score 0', () => {
    expect(similarity('', 'soy sauce')).toBe(0);
    expect(similarity('soy sauce', '')).toBe(0);
  });

  test('known pairs land above MATCH_ACCEPT', () => {
    const pairs: [string, string][] = [
      ['chicken thigh boneless', 'boneless chicken thigh'], // word order
      ['shredded cheddar cheese', 'shredded cheddar'], // trailing word
      ['atlantic salmon fil', 'atlantic salmon'], // truncation
      ['olive oil ev', 'olive oil'], // trailing abbreviation
      ['kecap manis abc', 'kecap manis'], // trailing brand
    ];
    for (const [a, b] of pairs) {
      expect(similarity(a, b), `${a} ~ ${b}`).toBeGreaterThan(MATCH_ACCEPT);
    }
  });

  test('known non-pairs land below MATCH_CONFIRM', () => {
    const pairs: [string, string][] = [
      ['soy sauce', 'fish sauce'],
      ['soy', 'soy sauce dark'], // containment alone is not a match
      ['gochujang', 'gochugaru'],
      ['green onion', 'yellow onion'],
      ['rice vinegar', 'rice'],
      ['paper towels', 'peanut butter'],
      ['milk', 'miso'],
    ];
    for (const [a, b] of pairs) {
      expect(similarity(a, b), `${a} !~ ${b}`).toBeLessThan(MATCH_CONFIRM);
    }
  });

  test('scores CJK strings the same way as Latin ones', () => {
    expect(similarity('醬油', '醬油')).toBe(1);
    expect(similarity('冷凍餃子', '餃子')).toBeLessThan(MATCH_ACCEPT);
  });

  test('receipt abbreviations land in the confirm band, the tuning set for decision 32', () => {
    // Measured against the seed aliases; these are the strings that sit
    // between the placeholder thresholds. If a change to the scorer or the
    // thresholds moves one of them, decision 32's evidence must be re-run.
    const confirmBand: [string, string][] = [
      ['GOCHUJANG PASTE 500G', 'gochujang'],
      ['MISO PASTE WHT', 'miso paste'],
      ['PORK BELLY SLCD', 'pork belly'],
      ['365 ORG PNUT BUTTER', 'peanut butter'],
      ['HVY CREAM PINT', 'heavy cream'],
      ['TOFU FIRM 14OZ', 'firm tofu'],
      ['NAPA CABBAGE HEAD', 'napa cabbage'],
      ['SHRMP RAW 1LB', 'raw shrimp'],
      ['CJ GOCHUJANG 1KG', 'gochujang'],
      ['3 CRABS FISH SAUCE', 'fish sauce'],
      ['steamed jasmine rice', 'jasmine rice'],
      ['coriander leaves', 'coriander'],
      ['cooking wine', 'chinese cooking wine'],
    ];
    for (const [raw, alias] of confirmBand) {
      const score = similarity(normalise(raw), normalise(alias));
      expect(score, `${raw} ~ ${alias}`).toBeGreaterThanOrEqual(MATCH_CONFIRM);
      expect(score, `${raw} ~ ${alias}`).toBeLessThan(MATCH_ACCEPT);
    }
  });
});
