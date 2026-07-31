import { beforeEach, describe, expect, test } from 'vitest';

import { parseResolutions } from '../src/api/resolve';
import {
  checkForDuplicate,
  createCanonicalFromProposal,
} from '../src/logic/canonicals';
import {
  resolve,
  type CanonicalProposal,
  type ModelResolutionRequest,
  type ModelResolver,
} from '../src/logic/match';
import { dbMatchStore } from '../src/logic/matchStore';
import { getAllCanonicals, getMatchQueue, loadSeedData } from '../src/db/queries';
import { openTestDatabase } from './stubs/db';

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
});

const PROPOSAL: CanonicalProposal = {
  displayName: 'Yuzu kosho',
  foodClass: 'condiment',
  defaultLocation: 'fridge',
  shelfLifeDays: { fridge: 365 },
  openLifeDays: 180,
  typicalUseQty: 1,
  typicalUseUnit: 'tsp',
};

describe('cascade steps 4 and 5', () => {
  test('the model receives one batched request covering every unresolved reference', async () => {
    const batches: ModelResolutionRequest[] = [];
    const model: ModelResolver = async (batch) => {
      batches.push(batch);
      return batch.references.map(() => null);
    };

    await resolve(
      [
        { raw: 'soy sauce' }, // resolves locally, must not reach the model
        { raw: 'WEIRD SNACK A' },
        { raw: 'WEIRD SNACK B' },
      ],
      'receipt',
      { store: dbMatchStore(), model },
    );

    expect(batches.length).toBe(1);
    expect(batches[0]?.references.map((r) => r.raw)).toEqual([
      'WEIRD SNACK A',
      'WEIRD SNACK B',
    ]);
  });

  test('the model is never invoked when local steps settle the batch', async () => {
    let calls = 0;
    const model: ModelResolver = async (batch) => {
      calls += 1;
      return batch.references.map(() => null);
    };
    await resolve([{ raw: 'soy sauce' }, { raw: '만두' }], 'meal_log', {
      store: dbMatchStore(),
      model,
    });
    expect(calls).toBe(0);
  });

  test('a model resolution writes an alias so the next lookup is free', async () => {
    const store = dbMatchStore();
    const model: ModelResolver = async (batch) =>
      batch.references.map(() => ({ canonicalId: 'xo-sauce', confidence: 0.9 }));

    const [first] = await resolve([{ raw: 'XO SCE PREMIUM' }], 'receipt', {
      store,
      model,
    });
    expect(first?.status).toBe('resolved');

    let calls = 0;
    const countingModel: ModelResolver = async (batch) => {
      calls += 1;
      return batch.references.map(() => null);
    };
    const [second] = await resolve([{ raw: 'XO SCE PREMIUM' }], 'receipt', {
      store,
      model: countingModel,
    });
    expect(second?.status).toBe('resolved');
    expect(calls).toBe(0);
  });

  test('step 5 surfaces a proposal, which is not created without confirmation', async () => {
    const model: ModelResolver = async (batch) =>
      batch.references.map(() => ({ proposal: PROPOSAL }));

    const [outcome] = await resolve([{ raw: 'YUZU KOSHO 80G' }], 'receipt', {
      store: dbMatchStore(),
      model,
    });
    expect(outcome?.status).toBe('unresolved');
    if (outcome?.status === 'unresolved') {
      expect(outcome.proposal?.displayName).toBe('Yuzu kosho');
      expect(outcome.proposal?.foodClass).toBe('condiment');
      expect(outcome.proposal?.defaultLocation).toBe('fridge');
      expect(outcome.proposal?.shelfLifeDays).toEqual({ fridge: 365 });
    }
    const canonicals = await getAllCanonicals();
    expect(canonicals.find((c) => c.displayName === 'Yuzu kosho')).toBeUndefined();
  });

  test('a failed batch degrades to the review queue, not to an error', async () => {
    const model: ModelResolver = async () => {
      throw new Error('network down');
    };
    const outcomes = await resolve(
      [{ raw: 'WEIRD SNACK A' }, { raw: 'WEIRD SNACK B' }],
      'receipt',
      { store: dbMatchStore(), model },
    );
    for (const outcome of outcomes) {
      expect(outcome.status).toBe('unresolved');
      if (outcome.status === 'unresolved') expect(outcome.queued).toBe(true);
    }
    expect((await getMatchQueue()).length).toBe(2);
  });
});

describe('parseResolutions', () => {
  const batch: ModelResolutionRequest = {
    references: [
      { raw: 'A', norm: 'a', candidateIds: ['soy-sauce-light'] },
      { raw: 'B', norm: 'b', candidateIds: [] },
    ],
    ownedCanonicalIds: ['miso'],
  };

  test('reads a well-formed batch, including fences around the JSON', () => {
    const raw = [
      '```json',
      JSON.stringify({
        resolutions: [
          { index: 0, canonical_id: 'soy-sauce-light', new_item: null, confidence: 0.92 },
          { index: 1, canonical_id: null, new_item: null, confidence: 0 },
        ],
      }),
      '```',
    ].join('\n');
    const results = parseResolutions(raw, batch);
    expect(results[0]).toEqual({ canonicalId: 'soy-sauce-light', confidence: 0.92 });
    expect(results[1]).toBeNull();
  });

  test('rejects an invented canonical id', () => {
    const raw = JSON.stringify({
      resolutions: [
        { index: 0, canonical_id: 'made-up-slug', new_item: null, confidence: 1 },
      ],
    });
    expect(parseResolutions(raw, batch)[0]).toBeNull();
  });

  test('accepts an id from the kitchen list', () => {
    const raw = JSON.stringify({
      resolutions: [{ index: 0, canonical_id: 'miso', confidence: 0.7 }],
    });
    expect(parseResolutions(raw, batch)[0]).toEqual({
      canonicalId: 'miso',
      confidence: 0.7,
    });
  });

  test('drops a malformed proposal but keeps the rest of the batch', () => {
    const raw = JSON.stringify({
      resolutions: [
        { index: 0, canonical_id: 'soy-sauce-light', confidence: 0.9 },
        { index: 1, new_item: { display_name: 'X', class: 'nonsense', default_location: 'pantry', shelf_life_days: { pantry: 10 } } },
      ],
    });
    const results = parseResolutions(raw, batch);
    expect(results[0]?.canonicalId).toBe('soy-sauce-light');
    expect(results[1]).toBeNull();
  });

  test('throws on prose so the cascade can queue the batch', () => {
    expect(() => parseResolutions('Sorry, I cannot help.', batch)).toThrow();
  });
});

describe('duplicate prevention on creation', () => {
  test('a near-duplicate is not created silently', async () => {
    const before = (await getAllCanonicals()).length;
    const result = await createCanonicalFromProposal({
      ...PROPOSAL,
      displayName: 'Soy sauce light',
    });
    expect(result.kind).not.toBe('created');
    expect((await getAllCanonicals()).length).toBe(before);
  });

  test('an outright duplicate reuses the existing canonical', async () => {
    const result = await createCanonicalFromProposal({
      ...PROPOSAL,
      displayName: 'Light soy sauce',
    });
    expect(result.kind).toBe('reused');
    if (result.kind === 'reused') {
      expect(result.item.id).toBe('soy-sauce-light');
    }
  });

  test('a genuinely distinct ingredient is created once the user confirms', async () => {
    const check = await checkForDuplicate('Yuzu kosho');
    expect(check.verdict).toBe('distinct');

    const result = await createCanonicalFromProposal(PROPOSAL, {
      userConfirmedDistinct: true,
    });
    expect(result.kind).toBe('created');
    if (result.kind === 'created') {
      expect(result.item.id).toBe('yuzu-kosho');
      expect(result.item.isSeed).toBe(false);
    }
  });
});
