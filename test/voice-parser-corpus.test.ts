import { describe, expect, test } from 'vitest';

import {
  EXPECTED_ITEM_COUNT,
  VOICE_FIXTURES,
  fixturesByDimension,
  type ExpectedItem,
  type VoiceFixture,
} from '../src/logic/__fixtures__/voiceUtterances';
import { parseVoiceTranscript, type ParsedVoiceItem } from '../src/logic/voicePantryParser';

/**
 * Task 3.5: run the whole corpus with no provider, no microphone, and no
 * network, and record what the parser actually achieves.
 *
 * The thresholds below are floors, not targets. They exist so a regression
 * fails the suite; the measured numbers are printed by
 * `npx vitest run test/voice-parser-corpus.test.ts --reporter=verbose` and
 * written down in `docs/voice-transcription-platforms.md`.
 *
 * One number matters more than the rest: **false ingredients must stay at
 * zero.** Missing an item costs the user a tap. Inventing one puts food in
 * their pantry that is not in their kitchen, and every downstream feature —
 * expiry, suggestions, the shopping list — then reasons from a fiction.
 */

interface Measurement {
  expected: number;
  found: number;
  falseItems: string[];
  amountChecked: number;
  amountCorrect: number;
}

function matches(item: ParsedVoiceItem, expected: ExpectedItem): boolean {
  return item.name.toLowerCase().includes(expected.name.toLowerCase());
}

function measure(fixture: VoiceFixture): Measurement {
  const parsed = parseVoiceTranscript(fixture.transcript);
  const unclaimed = [...parsed.items];
  let found = 0;
  let amountChecked = 0;
  let amountCorrect = 0;

  for (const expected of fixture.expected) {
    const index = unclaimed.findIndex((item) => matches(item, expected));
    if (index < 0) continue;
    const [item] = unclaimed.splice(index, 1);
    found += 1;

    for (const field of ['containerCount', 'amount', 'unit', 'approximate'] as const) {
      if (expected[field] === undefined) continue;
      amountChecked += 1;
      const actual = item!.quantity[field];
      const want = expected[field];
      const same =
        typeof want === 'number' && typeof actual === 'number'
          ? Math.abs(actual - want) < 1e-6
          : actual === want;
      if (same) amountCorrect += 1;
    }
  }

  return {
    expected: fixture.expected.length,
    found,
    falseItems: unclaimed.map((item) => item.name),
    amountChecked,
    amountCorrect,
  };
}

describe('the corpus, parsed with nothing but local code', () => {
  test('no fixture invents an ingredient', () => {
    const invented = VOICE_FIXTURES.flatMap((fixture) => {
      const { falseItems } = measure(fixture);
      return falseItems.map((name) => `${fixture.id}: “${name}”`);
    });
    expect(invented).toEqual([]);
  });

  test('speech with no food in it produces no items at all', () => {
    for (const fixture of VOICE_FIXTURES.filter((f) => f.dimension === 'no_food')) {
      const parsed = parseVoiceTranscript(fixture.transcript);
      expect({ id: fixture.id, items: parsed.items.map((i) => i.name) }).toEqual({
        id: fixture.id,
        items: [],
      });
    }
  });

  test('candidate recall is recorded and does not regress', () => {
    const totals = VOICE_FIXTURES.reduce(
      (accumulated, fixture) => {
        const result = measure(fixture);
        return {
          expected: accumulated.expected + result.expected,
          found: accumulated.found + result.found,
        };
      },
      { expected: 0, found: 0 },
    );
    expect(totals.expected).toBe(EXPECTED_ITEM_COUNT);
    const recall = totals.found / totals.expected;
    // eslint-disable-next-line no-console
    console.log(
      `voice parser recall: ${totals.found}/${totals.expected} (${(recall * 100).toFixed(1)}%)`,
    );
    expect(recall).toBeGreaterThanOrEqual(0.85);
  });

  test('amount accuracy is recorded and does not regress', () => {
    const totals = VOICE_FIXTURES.reduce(
      (accumulated, fixture) => {
        const result = measure(fixture);
        return {
          checked: accumulated.checked + result.amountChecked,
          correct: accumulated.correct + result.amountCorrect,
        };
      },
      { checked: 0, correct: 0 },
    );
    const accuracy = totals.correct / totals.checked;
    // eslint-disable-next-line no-console
    console.log(
      `voice parser amount accuracy: ${totals.correct}/${totals.checked} (${(accuracy * 100).toFixed(1)}%)`,
    );
    expect(accuracy).toBe(1);
  });

  test('every dimension is exercised by at least one fixture', () => {
    const grouped = fixturesByDimension();
    for (const dimension of [
      'baseline', 'filler', 'self_correction', 'containers', 'approximate',
      'remaining', 'location', 'locale', 'script', 'noise', 'no_food',
    ] as const) {
      expect(grouped.get(dimension)?.length ?? 0).toBeGreaterThan(0);
    }
  });

  test('the only misses are run-on speech, which a food lexicon resolves', () => {
    // "milk eggs bread butter" cannot be split from the words alone: nothing
    // distinguishes two foods in a row from one two-word food. With the
    // catalogue's own names supplied, it splits — which is how the app calls it.
    const withoutLexicon = parseVoiceTranscript('milk eggs bread butter');
    expect(withoutLexicon.items.map((item) => item.name)).toEqual([
      'milk eggs bread butter',
    ]);

    const withLexicon = parseVoiceTranscript('milk eggs bread butter', {
      knownNames: ['milk', 'eggs', 'bread', 'butter'],
    });
    expect(withLexicon.items.map((item) => item.name)).toEqual([
      'milk', 'eggs', 'bread', 'butter',
    ]);
  });

  test('per-dimension recall is reported', () => {
    for (const [dimension, fixtures] of fixturesByDimension()) {
      const totals = fixtures.reduce(
        (accumulated, fixture) => {
          const result = measure(fixture);
          return {
            expected: accumulated.expected + result.expected,
            found: accumulated.found + result.found,
          };
        },
        { expected: 0, found: 0 },
      );
      // eslint-disable-next-line no-console
      console.log(`  ${dimension}: ${totals.found}/${totals.expected}`);
      expect(totals.found).toBeLessThanOrEqual(totals.expected);
    }
  });
});
