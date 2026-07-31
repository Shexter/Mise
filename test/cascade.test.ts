import { beforeEach, describe, expect, test } from 'vitest';

import {
  getAllCanonicals,
  getBestAliasByNorm,
  getCandidateAliases,
  getMatchQueue,
  insertProduct,
  loadSeedData,
  mergeCanonicals,
  recordUserResolution,
  resolveQueuedMatch,
} from '../src/db/queries';
import {
  NON_FOOD_LINES,
  RECEIPT_LINES,
} from '../src/logic/__fixtures__/receipt-lines';
import {
  MEAL_LOG_REFERENCES,
  VISION_REFERENCES,
} from '../src/logic/__fixtures__/vision-meal-log';
import {
  MATCH_ACCEPT,
  MATCH_CONFIRM,
} from '../src/logic/similarity';
import {
  OWNERSHIP_BONUS,
  resolve,
  type MatchOutcome,
  type OwnershipSignal,
} from '../src/logic/match';
import { dbMatchStore } from '../src/logic/matchStore';
import { normalise } from '../src/logic/normalise';
import { openTestDatabase } from './stubs/db';

/**
 * The offline cascade, end to end: real migrations, real seed data, real
 * queries against real SQLite — no network, no API key, no model resolver.
 */

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
});

function expectCanonical(outcome: MatchOutcome, slug: string): void {
  expect(outcome.status === 'resolved' || outcome.status === 'needs_confirmation').toBe(true);
  if (outcome.status === 'resolved' || outcome.status === 'needs_confirmation') {
    expect(outcome.canonicalId).toBe(slug);
  }
}

describe('seed data', () => {
  test('loads the named Asian ingredients', async () => {
    const canonicals = await getAllCanonicals();
    const ids = canonicals.map((item) => item.id);
    for (const slug of [
      'doubanjiang',
      'gochujang',
      'fish-sauce',
      'oyster-sauce',
      'shaoxing-wine',
      'mirin',
      'miso',
      'belacan',
    ]) {
      expect(ids).toContain(slug);
    }
  });

  test('is idempotent — reloading adds nothing', async () => {
    const before = await getAllCanonicals();
    const aliasBefore = await getCandidateAliases('soy sauce');
    await loadSeedData();
    const after = await getAllCanonicals();
    const aliasAfter = await getCandidateAliases('soy sauce');
    expect(after.length).toBe(before.length);
    expect(aliasAfter.length).toBe(aliasBefore.length);
  });

  test('a fresh install resolves gochujang with no network and no API key', async () => {
    const [outcome] = await resolve([{ raw: 'gochujang' }], 'meal_log', {
      store: dbMatchStore(),
    });
    expect(outcome?.status).toBe('resolved');
    expectCanonical(outcome!, 'gochujang');
  });

  test('canonical items carry class, location, shelf life, and typical use', async () => {
    const canonicals = await getAllCanonicals();
    const soy = canonicals.find((item) => item.id === 'soy-sauce-light');
    expect(soy?.foodClass).toBe('condiment');
    expect(soy?.defaultLocation).toBe('pantry');
    expect(soy?.shelfLifeDays['pantry']).toBeGreaterThan(0);
    expect(soy?.openLifeDays).toBeGreaterThan(0);
    expect(soy?.typicalUseQty).toBeGreaterThan(0);
    expect(soy?.typicalUseUnit).toBe('tbsp');
  });
});

describe('the offline cascade', () => {
  test('every fixture lands in its expected band, in one batch, without throwing', async () => {
    const fixtures = [
      ...RECEIPT_LINES,
      ...VISION_REFERENCES,
      ...MEAL_LOG_REFERENCES,
    ];
    const outcomes = await resolve(
      fixtures.map((fixture) => ({ raw: fixture.raw })),
      'receipt',
      { store: dbMatchStore() },
    );

    for (let i = 0; i < fixtures.length; i += 1) {
      const fixture = fixtures[i]!;
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

  test('unknown references are queued, and known ones still resolve alongside them', async () => {
    const outcomes = await resolve(
      [
        { raw: 'soy sauce' },
        { raw: NON_FOOD_LINES[0]!, context: '{"receiptId":"r1"}' },
        { raw: '만두' },
      ],
      'receipt',
      { store: dbMatchStore() },
    );

    expect(outcomes[0]?.status).toBe('resolved');
    expect(outcomes[2]?.status).toBe('resolved');
    expect(outcomes[1]?.status).toBe('unresolved');
    if (outcomes[1]?.status === 'unresolved') {
      expect(outcomes[1].queued).toBe(true);
    }

    const queue = await getMatchQueue();
    expect(queue.length).toBe(1);
    expect(queue[0]?.rawText).toBe(NON_FOOD_LINES[0]);
    expect(queue[0]?.context).toBe('{"receiptId":"r1"}');
  });

  test('a barcode short-circuits the cascade', async () => {
    await insertProduct({
      gtin: '0041390000010',
      brand: 'Kikkoman',
      name: 'Naturally Brewed Soy Sauce 500ml',
      canonicalId: 'soy-sauce-light',
      source: 'user',
    });
    const [outcome] = await resolve(
      [{ raw: 'Some unrelated label text', barcode: '0041390000010' }],
      'barcode',
      { store: dbMatchStore() },
    );
    expect(outcome?.status).toBe('resolved');
    if (outcome?.status === 'resolved') {
      expect(outcome.method).toBe('barcode');
      expect(outcome.canonicalId).toBe('soy-sauce-light');
      expect(outcome.confidence).toBe(1);
    }
  });

  test('an approximate resolution writes an alias back, making the second lookup exact', async () => {
    const store = dbMatchStore();
    const [first] = await resolve([{ raw: 'GOCHUJANG PASTE 500G' }], 'receipt', {
      store,
    });
    expect(first?.status).toBe('needs_confirmation');

    const [second] = await resolve([{ raw: 'GOCHUJANG PASTE 500G' }], 'receipt', {
      store,
    });
    expect(second?.status).toBe('resolved');
    if (second?.status === 'resolved') {
      expect(second.method).toBe('exact_alias');
      expect(second.canonicalId).toBe('gochujang');
    }
  });

  test('a user correction is learned and takes precedence over the mistake', async () => {
    const store = dbMatchStore();
    // The cascade reads `CJ GOCHUJANG 1KG` as gochujang at confirm band and
    // remembers that. The user corrects it to doubanjiang.
    await resolve([{ raw: 'CJ GOCHUJANG 1KG' }], 'receipt', { store });
    await recordUserResolution('CJ GOCHUJANG 1KG', 'doubanjiang');

    const [outcome] = await resolve([{ raw: 'CJ GOCHUJANG 1KG' }], 'receipt', {
      store,
    });
    expect(outcome?.status).toBe('resolved');
    if (outcome?.status === 'resolved') {
      expect(outcome.canonicalId).toBe('doubanjiang');
      expect(outcome.method).toBe('exact_alias');
    }
  });

  test('resolving a queued reference teaches the matcher', async () => {
    const store = dbMatchStore();
    await resolve([{ raw: 'MYSTERY SAUCE 9000' }], 'receipt', { store });
    const queue = await getMatchQueue();
    expect(queue.length).toBe(1);

    await resolveQueuedMatch(queue[0]!.id, 'xo-sauce');
    expect((await getMatchQueue()).length).toBe(0);

    const [outcome] = await resolve([{ raw: 'MYSTERY SAUCE 9000' }], 'receipt', {
      store,
    });
    expect(outcome?.status).toBe('resolved');
    if (outcome?.status === 'resolved') {
      expect(outcome.canonicalId).toBe('xo-sauce');
    }
  });
});

describe('ownership bias', () => {
  const owned = (
    entries: Record<string, Partial<OwnershipSignal>>,
  ): ReadonlyMap<string, OwnershipSignal> =>
    new Map(
      Object.entries(entries).map(([id, signal]) => [
        id,
        {
          inStock: signal.inStock ?? false,
          opened: signal.opened ?? false,
          frequentlyUsed: signal.frequentlyUsed ?? false,
        },
      ]),
    );

  test('the total bonus cannot bridge the confirm band on its own', () => {
    const total =
      OWNERSHIP_BONUS.inStock +
      OWNERSHIP_BONUS.opened +
      OWNERSHIP_BONUS.frequentlyUsed;
    expect(total).toBeLessThan(MATCH_ACCEPT - MATCH_CONFIRM);
    // And the ranking order is strict: in stock > opened > frequently used.
    expect(OWNERSHIP_BONUS.inStock).toBeGreaterThan(OWNERSHIP_BONUS.opened);
    expect(OWNERSHIP_BONUS.opened).toBeGreaterThan(
      OWNERSHIP_BONUS.frequentlyUsed,
    );
  });

  test('an owned candidate outranks an equally similar one the user does not have', async () => {
    // Both canonicals carry an equally similar alias, so the base scores
    // tie exactly and ownership is the only separator — a scoring input,
    // not a post-filter.
    const remembered: string[] = [];
    const tieStore = {
      productCanonicalByBarcode: async () => null,
      exactAliasCanonical: async () => null,
      candidateAliases: async () => [
        { canonicalId: 'soy-sauce-light', aliasNorm: 'soy sauce bottle' },
        { canonicalId: 'soy-sauce-dark', aliasNorm: 'soy sauce bottle' },
      ],
      rememberAlias: async (entry: { canonicalId: string }) => {
        remembered.push(entry.canonicalId);
      },
      enqueue: async () => {},
    };

    const withOwnership = await resolve(
      [{ raw: 'soy sauce bottel' }],
      'meal_log',
      {
        store: tieStore,
        ownership: owned({ 'soy-sauce-dark': { inStock: true, opened: true } }),
      },
    );
    expectCanonical(withOwnership[0]!, 'soy-sauce-dark');
    expect(remembered).toEqual(['soy-sauce-dark']);
  });

  test('ownership cannot promote a below-confirm match into resolution', async () => {
    // `fried egg` scores ~0.29 against `egg` — far below the confirm band.
    // Owning eggs must not change that.
    const [outcome] = await resolve([{ raw: 'fried egg' }], 'meal_log', {
      store: dbMatchStore(),
      ownership: owned({
        eggs: { inStock: true, opened: true, frequentlyUsed: true },
      }),
    });
    expect(outcome?.status).toBe('unresolved');
  });
});

describe('merge', () => {
  test('aliases from both sides resolve to the survivor, products follow, the absorbed disappears', async () => {
    const store = dbMatchStore();
    // Teach the absorbed canonical an alias of its own.
    await recordUserResolution('KIKKO SOY 500ML', 'soy-sauce-dark');
    await insertProduct({
      gtin: '111',
      name: 'Dark soy 500ml',
      canonicalId: 'soy-sauce-dark',
      source: 'user',
    });

    await mergeCanonicals('soy-sauce-light', 'soy-sauce-dark');

    // Aliases from both sides now reach the survivor.
    expect((await getBestAliasByNorm(normalise('KIKKO SOY 500ML')))?.canonicalId).toBe(
      'soy-sauce-light',
    );
    expect((await getBestAliasByNorm('老抽'))?.canonicalId).toBe(
      'soy-sauce-light',
    );

    // Products follow.
    const { getProductByBarcode } = await import('../src/db/queries');
    expect((await getProductByBarcode('111'))?.canonicalId).toBe(
      'soy-sauce-light',
    );

    // The absorbed canonical is gone and never comes back as a candidate.
    const canonicals = await getAllCanonicals();
    expect(canonicals.find((item) => item.id === 'soy-sauce-dark')).toBeUndefined();
    const [outcome] = await resolve([{ raw: 'dark soy sauce' }], 'meal_log', {
      store,
    });
    expectCanonical(outcome!, 'soy-sauce-light');
  });

  test('merging a canonical into itself is refused', async () => {
    await expect(
      mergeCanonicals('soy-sauce-light', 'soy-sauce-light'),
    ).rejects.toThrow();
  });
});
