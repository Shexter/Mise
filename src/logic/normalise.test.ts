import { describe, expect, test } from 'vitest';

import { RECEIPT_LINES } from '@/logic/__fixtures__/receipt-lines';
import {
  MEAL_LOG_REFERENCES,
  VISION_REFERENCES,
} from '@/logic/__fixtures__/vision-meal-log';
import { normalise } from '@/logic/normalise';

describe('normalise', () => {
  test('case-folds, strips punctuation, and collapses whitespace', () => {
    expect(normalise('  Light  SOY-Sauce!! ')).toBe('light soy sauce');
  });

  test('strips size tokens', () => {
    expect(normalise('KIKKO SOY 500ML')).toBe('kikko soy');
    expect(normalise('JASMINE RICE 5LB')).toBe('jasmine rice');
    expect(normalise('LRG EGGS 12CT')).toBe('large eggs');
  });

  test('strips weight-priced tails', () => {
    expect(normalise('BANANAS 0.62 LB @ 0.59/LB')).toBe('bananas');
    expect(normalise('BOK CHOY 1.24 LB @ 1.99/LB')).toBe('bok choy');
  });

  test('strips store-brand prefixes', () => {
    expect(normalise('GV SOY SAUCE 15OZ')).toBe('soy sauce');
    expect(normalise('365 ORG PNUT BUTTER')).toBe('organic peanut butter');
    expect(normalise("TJ'S FRZ DUMPLINGS")).toBe('frozen dumplings');
  });

  test('a brand-prefix word alone is not stripped to nothing', () => {
    expect(normalise('GV')).toBe('gv');
  });

  test('expands retailer abbreviations', () => {
    expect(normalise('GRN ONION BNCH')).toBe('green onion bunch');
    expect(normalise('CHKN BRST BNLS')).toBe('chicken breast boneless');
  });

  test('leaves non-Latin scripts untouched — no transliteration, no stripping', () => {
    expect(normalise('醬油')).toBe('醬油');
    expect(normalise('간장')).toBe('간장');
    expect(normalise('冷凍餃子')).toBe('冷凍餃子');
    expect(normalise('고추장 500G')).toBe('고추장');
    expect(normalise('李錦記 蠔油')).toBe('李錦記 蠔油');
  });

  test('a known store strips its own prefix even when the generic list would not', () => {
    // "gg" (Target's Good & Gather) is not in STORE_BRAND_PREFIXES.
    expect(normalise('GG GREEK YOGURT')).toBe('gg greek yogurt');
    expect(normalise('GG GREEK YOGURT', { store: 'Target' })).toBe(
      'greek yogurt',
    );
  });

  test('an unknown store falls back to the generic prefix list unchanged', () => {
    expect(normalise("TJ'S FRZ DUMPLINGS", { store: 'Some Random Shop' })).toBe(
      normalise("TJ'S FRZ DUMPLINGS"),
    );
  });

  test('the single-argument call keeps working exactly as before', () => {
    expect(normalise('GV SOY SAUCE 15OZ')).toBe('soy sauce');
  });

  test('is idempotent over every fixture', () => {
    const all = [
      ...RECEIPT_LINES,
      ...VISION_REFERENCES,
      ...MEAL_LOG_REFERENCES,
    ];
    for (const fixture of all) {
      const once = normalise(fixture.raw);
      expect(normalise(once)).toBe(once);
      expect(once.length).toBeGreaterThan(0);
    }
  });
});
