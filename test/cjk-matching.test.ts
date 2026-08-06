import { beforeEach, describe, expect, test } from 'vitest';

import {
  getBestAliasByNorm,
  getCandidateAliases,
  loadSeedData,
} from '../src/db/queries';
import {
  CJK_LINES,
  CJK_NEAR_MISSES,
} from '../src/logic/__fixtures__/cjk-lines';
import { resolve, type MatchOutcome } from '../src/logic/match';
import { dbMatchStore } from '../src/logic/matchStore';
import { normalise } from '../src/logic/normalise';
import { openTestDatabase } from './stubs/db';

/**
 * Decision 67 (`add-cjk-matching`), end to end: real migrations, real seed
 * data, real queries — the scorer and the candidate retrieval prefilter
 * together, not either alone (task 7.1). No API key or model resolver is
 * ever passed here, so a `resolved`/`needs_confirmation` outcome is proof
 * the reference matched with no network (task 7.2).
 */

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
});

function expectCanonical(outcome: MatchOutcome, slug: string): void {
  expect(outcome.status === 'resolved' || outcome.status === 'needs_confirmation').toBe(
    true,
  );
  if (outcome.status === 'resolved' || outcome.status === 'needs_confirmation') {
    expect(outcome.canonicalId).toBe(slug);
  }
}

describe('the CJK corpus through the real cascade', () => {
  test('every fixture lands in its expected band, in one batch, without throwing', async () => {
    const outcomes = await resolve(
      CJK_LINES.map((fixture) => ({ raw: fixture.raw })),
      'receipt',
      { store: dbMatchStore() },
    );

    for (let i = 0; i < CJK_LINES.length; i += 1) {
      const fixture = CJK_LINES[i]!;
      const outcome = outcomes[i]!;
      const label = fixture.raw;
      if (fixture.offline === 'accept') {
        expect(outcome.status, label).toBe('resolved');
        expectCanonical(outcome, fixture.slug!);
      } else if (fixture.offline === 'confirm') {
        expect(outcome.status, label).toBe('needs_confirmation');
        expectCanonical(outcome, fixture.slug!);
      } else {
        expect(outcome.status, label).toBe('unresolved');
      }
    }
  });

  test('near-miss pairs resolve to their own canonical, never each other\'s', async () => {
    const outcomes = await resolve(
      CJK_NEAR_MISSES.map(([raw]) => ({ raw })),
      'receipt',
      { store: dbMatchStore() },
    );

    for (let i = 0; i < CJK_NEAR_MISSES.length; i += 1) {
      const [raw, slug] = CJK_NEAR_MISSES[i]!;
      expectCanonical(outcomes[i]!, slug);
    }
  });

  test('an unseeded brand-plus-product reference resolves with no network and no API key (task 7.2)', async () => {
    // No `model` option passed to `resolve` — steps 4 and 5 do not exist for
    // this call. `李錦記 蠔油` has no alias of its own; only the bare `蠔油`/
    // `蚝油` aliases are seeded.
    const [outcome] = await resolve(
      [{ raw: '李錦記 蠔油 510ML' }],
      'receipt',
      { store: dbMatchStore() },
    );
    expect(outcome?.status).toBe('needs_confirmation');
    expectCanonical(outcome!, 'oyster-sauce');
  });
});

describe('candidate retrieval is script-independent (task 5)', () => {
  test('a CJK reference retrieves its correct candidate even with no shared token', async () => {
    // `李錦記蠔油` (no space) shares no whole token with the seeded `蠔油` —
    // the Latin prefilter's token clause could never find it. Retrieval has
    // to fall back to the bigram path on script alone.
    const candidates = await getCandidateAliases(normalise('李錦記蠔油'));
    expect(candidates.some((alias) => alias.canonicalId === 'oyster-sauce')).toBe(
      true,
    );
  });

  test('retrieval stays bounded', async () => {
    const candidates = await getCandidateAliases(normalise('油'));
    expect(candidates.length).toBeLessThanOrEqual(200);
  });

  test('a Han-variant reference retrieves the alias seeded in the other variant', async () => {
    // `蠔油` (traditional) is not itself seeded — only `蚝油` (simplified)
    // is. Retrieval must surface it regardless; folding is the scorer's job.
    const candidates = await getCandidateAliases(normalise('蠔油'));
    expect(candidates.some((alias) => alias.canonicalId === 'oyster-sauce')).toBe(
      true,
    );
  });
});

describe('nothing decomposed or folded ever reaches storage (task 7.3, decision 31)', () => {
  test('a Han-variant match writes back the alias exactly as the user wrote it', async () => {
    const store = dbMatchStore();
    const [outcome] = await resolve([{ raw: '蠔油' }], 'receipt', { store });
    expect(outcome?.status).toBe('resolved');

    const alias = await getBestAliasByNorm(normalise('蠔油'));
    expect(alias?.aliasRaw).toBe('蠔油');
    // The composed, traditional form — not the simplified fold used only to
    // score it, and not anything NFD-decomposed.
    expect(alias?.aliasNorm).toBe('蠔油');
  });

  test('a Hangul match never leaves an NFD-decomposed form behind', async () => {
    // Scored via the Hangul path (NFD-decomposed jamo trigrams,
    // internally) and via the mixed-script path (brand token + Hangul
    // token). Neither may leak into what gets written back.
    const store = dbMatchStore();
    const [outcome] = await resolve([{ raw: 'CJ 고추장 500G' }], 'receipt', {
      store,
    });
    expect(outcome?.status).toBe('needs_confirmation');

    const alias = await getBestAliasByNorm(normalise('CJ 고추장 500G'));
    expect(alias?.aliasRaw).toBe('CJ 고추장 500G');
    // NFC-normal — composed syllables, not the decomposed jamo the scorer
    // used internally to reach this match.
    expect(alias?.aliasNorm.normalize('NFC')).toBe(alias?.aliasNorm);
  });
});
