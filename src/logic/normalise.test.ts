import { describe, expect, test } from 'vitest';

import { CJK_LINES } from '@/logic/__fixtures__/cjk-lines';
import { RECEIPT_LINES } from '@/logic/__fixtures__/receipt-lines';
import {
  MEAL_LOG_REFERENCES,
  VISION_REFERENCES,
} from '@/logic/__fixtures__/vision-meal-log';
import { foldHanVariants, normalise } from '@/logic/normalise';

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
      ...CJK_LINES,
    ];
    for (const fixture of all) {
      const once = normalise(fixture.raw);
      expect(normalise(once)).toBe(once);
      expect(once.length).toBeGreaterThan(0);
    }
  });
});

describe('NFKC width/form folding (task 3.1, 3.2)', () => {
  test('full-width Latin folds to its ordinary ASCII form', () => {
    expect(normalise('ＫＩＫＫＯＭＡＮ')).toBe('kikkoman');
  });

  test('half-width Kana folds to its ordinary full-width form', () => {
    // しょうゆ (hiragana) is not the same string as ショウユ (katakana) —
    // NFKC folds width, not syllabary, so the seeded hiragana alias is a
    // separate matter (task 4b's romanisation seeding covers the readable
    // gap; this only closes the packaging-encoding one).
    expect(normalise('ｼｮｳﾕ')).toBe('ショウユ'.toLowerCase());
  });

  test('is a no-op on the existing Latin and CJK fixtures — nothing here moves', () => {
    // The exact assertions `normalise.test.ts` already made before this
    // change, re-run: if NFKC or the diacritic strip touched any of these,
    // one of these would now fail.
    expect(normalise('KIKKO SOY 500ML')).toBe('kikko soy');
    expect(normalise('醬油')).toBe('醬油');
    expect(normalise('간장')).toBe('간장');
  });
});

describe('diacritic stripping (task 4b.2)', () => {
  test('macrons and accents fold to their bare Latin letter', () => {
    expect(normalise('shōyu')).toBe('shoyu');
    expect(normalise('crème fraîche')).toBe('creme fraiche');
  });

  test('round-trips Hangul unchanged — NFD decomposes syllables too, but recomposition undoes it', () => {
    expect(normalise('간장')).toBe('간장');
    expect(normalise('고추장')).toBe('고추장');
  });

  test('round-trips Han and Kana unchanged', () => {
    expect(normalise('醬油')).toBe('醬油');
    expect(normalise('しょうゆ')).toBe('しょうゆ');
  });
});

describe('hyphenation collapses to spacing (task 4b.3)', () => {
  test('a hyphenated romanisation normalises the same as its spaced form', () => {
    expect(normalise('char-siu')).toBe(normalise('char siu'));
    expect(normalise('go-chu-jang')).toBe(normalise('go chu jang'));
  });

  test('a solid compound is a different string — closed by seeding, not by normalising harder', () => {
    // `charsiu` (no separator at all) cannot be told apart from any other
    // run-together word without a dictionary — task 4b.4 seeds the specific
    // spellings that matter rather than guessing where a space belongs.
    expect(normalise('charsiu')).not.toBe(normalise('char siu'));
  });
});

describe('foldHanVariants (task 4a)', () => {
  test('folds traditional characters to their simplified counterpart, in both directions of comparison', () => {
    expect(foldHanVariants('蠔油')).toBe('蚝油');
    expect(foldHanVariants('紹興酒')).toBe('绍兴酒');
    expect(foldHanVariants('海鮮醬')).toBe('海鲜酱');
    expect(foldHanVariants('豆瓣醬')).toBe('豆瓣酱');
    expect(foldHanVariants('xo醬')).toBe('xo酱');
  });

  test('is a no-op on already-simplified text', () => {
    expect(foldHanVariants('蚝油')).toBe('蚝油');
    expect(foldHanVariants('绍兴酒')).toBe('绍兴酒');
  });

  test('does not touch characters outside the catalogue-derived table', () => {
    // 龍 (dragon, traditional) has no simplified counterpart established by
    // any paired alias in this catalogue — left alone rather than guessed.
    expect(foldHanVariants('龍蝦')).toBe('龍蝦');
  });

  test('is not part of the main normalise() pipeline — stored/displayed forms are untouched', () => {
    expect(normalise('蠔油')).toBe('蠔油');
  });
});
