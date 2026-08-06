import { describe, expect, test } from 'vitest';

import { CJK_LINES, CJK_NEAR_MISSES } from '@/logic/__fixtures__/cjk-lines';
import { normalise } from '@/logic/normalise';
import {
  dominantScript,
  MATCH_ACCEPT,
  MATCH_CONFIRM,
  similarity,
} from '@/logic/similarity';

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

  test('CJK strings score through the same Dice-plus-penalty shape as Latin', () => {
    expect(similarity('醬油', '醬油')).toBe(1);
    expect(similarity('冷凍餃子', '餃子')).toBeLessThan(MATCH_ACCEPT);
  });

  test('a two-character ideographic phrase scores meaningfully rather than collapsing to zero', () => {
    // 冷凍餃子 ("frozen dumplings") contains 餃子 ("dumplings") as a real
    // two-character compound — bigrams give that overlap genuine weight
    // (0.5), where the old trigram scorer had almost nothing to work with
    // over a string this short (decision 67).
    expect(similarity('冷凍餃子', '餃子')).toBeGreaterThan(0.4);
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

describe('dominantScript (task 2.1, 2.2)', () => {
  test('single-script strings', () => {
    expect(dominantScript('soy sauce')).toBe('latin');
    expect(dominantScript('醬油')).toBe('han');
    expect(dominantScript('しょうゆ')).toBe('kana');
    expect(dominantScript('ショウユ')).toBe('kana');
    expect(dominantScript('간장')).toBe('hangul');
  });

  test('Han and Kana mixed together are not "mixed" — both use the same n-gram size', () => {
    expect(dominantScript('キッコーマン 醤油')).not.toBe('mixed');
  });

  test('a Latin brand next to any CJK-family script is mixed', () => {
    expect(dominantScript('cj 고추장')).toBe('mixed');
    expect(dominantScript('kikkoman 醤油')).toBe('mixed');
  });

  test('digits and punctuation alone default to latin, and never crash', () => {
    expect(dominantScript('')).toBe('latin');
    expect(dominantScript('123')).toBe('latin');
    expect(dominantScript('!!!')).toBe('latin');
  });

  test('mostly-digit and mostly-punctuation strings with one real letter still classify by that letter', () => {
    expect(dominantScript('500 醤')).toBe('han');
    expect(dominantScript('12 kg')).toBe('latin');
  });
});

describe('CJK corpus (decision 67, task 6.1–6.3)', () => {
  test('every accept-band CJK fixture, scored against its own seeded form, clears MATCH_ACCEPT', () => {
    // A same-string check — the fixture corpus's `accept` rows are exact
    // seeded forms (after normalising away a size token), so this is the
    // n-gram/length-penalty shape holding for real CJK strings, independent
    // of retrieval. The full cascade (`test/cjk-matching.test.ts`) covers
    // retrieval and the confirm/review rows.
    for (const fixture of CJK_LINES) {
      if (fixture.offline !== 'accept') continue;
      const norm = normalise(fixture.raw);
      expect(similarity(norm, norm), fixture.raw).toBe(1);
    }
  });

  test('near-miss pairs stay below MATCH_CONFIRM against each other', () => {
    const byRaw = new Map(CJK_NEAR_MISSES.map((entry) => [entry[0], entry]));
    for (const [raw, , distinctFrom] of CJK_NEAR_MISSES) {
      const other = [...byRaw.values()].find(([, slug]) => slug === distinctFrom);
      if (!other) continue;
      const score = similarity(normalise(raw), normalise(other[0]));
      expect(score, `${raw} !~ ${other[0]}`).toBeLessThan(MATCH_CONFIRM);
    }
  });

  test('Han variant folding: traditional and simplified forms of the same word score 1', () => {
    const pairs: [string, string][] = [
      ['醬油', '酱油'],
      ['蠔油', '蚝油'],
      ['紹興酒', '绍兴酒'],
      ['海鮮醬', '海鲜酱'],
      ['豆瓣醬', '豆瓣酱'],
      ['xo醬', 'xo酱'],
    ];
    for (const [traditional, simplified] of pairs) {
      expect(similarity(traditional, simplified), `${traditional} ~ ${simplified}`).toBe(1);
      expect(similarity(simplified, traditional), `${simplified} ~ ${traditional}`).toBe(1);
    }
  });

  test('folding never mutates the strings themselves — only scoring sees it', () => {
    const before = '蠔油';
    similarity(before, '蚝油');
    expect(before).toBe('蠔油');
  });
});
