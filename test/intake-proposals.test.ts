import { beforeEach, describe, expect, test } from 'vitest';

import {
  getAllCanonicals,
  getLocations,
  getMatchQueue,
  loadSeedData,
} from '../src/db/queries';
import { planCaptureItems } from '../src/logic/captureItems';
import {
  isAcceptable,
  partitionProposals,
  planIntakeProposals,
  type IntakeCandidate,
} from '../src/logic/intakeProposals';
import { UNKNOWN_QUANTITY } from '../src/logic/materialisation';
import { resolveIngredientReferencesLocally } from '../src/logic/resolution';
import type { MatchOutcome } from '../src/logic/match';
import type { CanonicalItem, Location } from '../src/types';
import { openTestDatabase } from './stubs/db';

/**
 * The source-neutral intake contract: what a proposal is allowed to claim,
 * what it must leave unknown, and the proof that generalising the photo path
 * did not change the photo path.
 */

const LOCATIONS: Location[] = [
  { id: 'fridge', name: 'Fridge', kind: 'fridge', sortOrder: 0 },
  { id: 'freezer', name: 'Freezer', kind: 'freezer', sortOrder: 1 },
  { id: 'pantry', name: 'Pantry', kind: 'ambient', sortOrder: 2 },
];

const MILK = {
  id: 'milk',
  displayName: 'Milk',
  foodClass: 'dairy',
  defaultLocation: 'fridge',
} as unknown as CanonicalItem;

const RICE = {
  id: 'rice',
  displayName: 'Rice',
  foodClass: 'staple',
  defaultLocation: 'pantry',
} as unknown as CanonicalItem;

const resolved = (raw: string, canonicalId: string, confidence = 0.95): MatchOutcome =>
  ({ status: 'resolved', raw, norm: raw, canonicalId, confidence, method: 'exact_alias' } as MatchOutcome);

const unresolved = (raw: string): MatchOutcome =>
  ({ status: 'unresolved', raw, norm: raw, queued: false } as MatchOutcome);

const candidate = (over: Partial<IntakeCandidate> & { id: string; statedName: string }): IntakeCandidate => ({
  quantity: UNKNOWN_QUANTITY,
  ...over,
});

const context = (over: Partial<Parameters<typeof planIntakeProposals>[2]> = {}) => ({
  draftId: 'draft-1',
  source: 'voice' as const,
  canonicals: [MILK, RICE],
  locations: LOCATIONS,
  ...over,
});

describe('unknown evidence stays unknown', () => {
  test('an unresolved name carries no canonical and no invented location', () => {
    const [proposal] = planIntakeProposals(
      [candidate({ id: 'a', statedName: 'kabocha' })],
      [unresolved('kabocha')],
      context(),
    );
    expect(proposal!.canonicalId).toBeNull();
    expect(proposal!.canonicalName).toBeNull();
    expect(proposal!.identityConfidence).toBeNull();
    expect(proposal!.identityStrength).toBe('unknown');
    expect(proposal!.locationId).toBeNull();
  });

  test('an unstated amount is unknown, not zero and not a default', () => {
    const [proposal] = planIntakeProposals(
      [candidate({ id: 'a', statedName: 'butter' })],
      [resolved('butter', 'milk')],
      context(),
    );
    expect(proposal!.quantity.amount).toBeNull();
    expect(proposal!.quantity.unit).toBeNull();
    expect(proposal!.quantity.containerCount).toBeNull();
    expect(proposal!.quantityStrength).toBe('unknown');
  });

  test('an unknown quantity does not block the item from being added', () => {
    const [proposal] = planIntakeProposals(
      [candidate({ id: 'a', statedName: 'milk' })],
      [resolved('milk', 'milk')],
      context(),
    );
    expect(isAcceptable(proposal!)).toBe(true);
    expect(proposal!.notes.map((note) => note.reason)).toContain('unknown_quantity');
  });

  test('an approximate amount stays approximate through planning', () => {
    const [proposal] = planIntakeProposals(
      [
        candidate({
          id: 'a',
          statedName: 'milk',
          quantity: { containerCount: 1, amount: 0.5, unit: null, approximate: true },
        }),
      ],
      [resolved('milk', 'milk')],
      context(),
    );
    expect(proposal!.quantityStrength).toBe('approximate');
    expect(proposal!.quantity.approximate).toBe(true);
  });

  test('evidence the source never produced is null, not fabricated', () => {
    const [proposal] = planIntakeProposals(
      [candidate({ id: 'a', statedName: 'milk' })],
      [resolved('milk', 'milk')],
      context(),
    );
    expect(proposal!.fullness).toBeNull();
    expect(proposal!.opened).toBeNull();
    expect(proposal!.acquisition).toBeNull();
    expect(proposal!.transcriptionConfidence).toBeNull();
  });
});

describe('confidences do not merge', () => {
  test('a certain transcription of an uncertain food stays uncertain', () => {
    const [proposal] = planIntakeProposals(
      [candidate({ id: 'a', statedName: 'greens', transcriptionConfidence: 0.99 })],
      [unresolved('greens')],
      context(),
    );
    // Heard perfectly, still does not know what it is.
    expect(proposal!.transcriptionConfidence).toBe(0.99);
    expect(proposal!.identityConfidence).toBeNull();
    expect(isAcceptable(proposal!)).toBe(false);
  });

  test('a needs-confirmation match is blocking and explains itself in words', () => {
    const [proposal] = planIntakeProposals(
      [candidate({ id: 'a', statedName: 'mylk' })],
      [{ status: 'needs_confirmation', raw: 'mylk', norm: 'mylk', canonicalId: 'milk', confidence: 0.7, method: 'approximate' }],
      context(),
    );
    expect(isAcceptable(proposal!)).toBe(false);
    const note = proposal!.notes.find((n) => n.reason === 'ambiguous_identity');
    expect(note?.message).toContain('Milk');
    expect(note?.message).not.toMatch(/0\.7|confidence/i);
  });
});

describe('location inheritance', () => {
  test('the session location is inherited by every candidate', () => {
    const proposals = planIntakeProposals(
      [candidate({ id: 'a', statedName: 'milk' }), candidate({ id: 'b', statedName: 'rice' })],
      [resolved('milk', 'milk'), resolved('rice', 'rice')],
      context({ sessionLocationId: 'fridge' }),
    );
    // Rice defaults to the pantry, but the user said this sweep is the fridge.
    expect(proposals.map((p) => p.locationId)).toEqual(['fridge', 'fridge']);
    expect(proposals[0]!.locationStrength).toBe('inferred');
  });

  test('a location named by the candidate beats the session default', () => {
    const [proposal] = planIntakeProposals(
      [candidate({ id: 'a', statedName: 'rice', locationId: 'freezer' })],
      [resolved('rice', 'rice')],
      context({ sessionLocationId: 'fridge' }),
    );
    expect(proposal!.locationId).toBe('freezer');
    expect(proposal!.locationStrength).toBe('stated');
  });

  test('a location id that no longer exists is discarded, not guessed at', () => {
    const [proposal] = planIntakeProposals(
      [candidate({ id: 'a', statedName: 'rice', locationId: 'deleted-shelf' })],
      [resolved('rice', 'rice')],
      context(),
    );
    expect(proposal!.locationId).toBe('pantry');
  });
});

describe('duplicates are mentioned, never blocked', () => {
  test('existing stock produces a non-blocking note', () => {
    const [proposal] = planIntakeProposals(
      [candidate({ id: 'a', statedName: 'milk' })],
      [resolved('milk', 'milk')],
      context({ existingCanonicalIds: new Set(['milk']) }),
    );
    expect(isAcceptable(proposal!)).toBe(true);
    expect(proposal!.notes.map((n) => n.reason)).toContain('duplicate_existing_stock');
  });
});

describe('review grouping', () => {
  test('clear proposals and needs-a-look proposals separate', () => {
    const proposals = planIntakeProposals(
      [
        candidate({
          id: 'a',
          statedName: 'milk',
          quantity: { containerCount: 1, amount: null, unit: null, approximate: false },
        }),
        candidate({ id: 'b', statedName: 'kabocha' }),
      ],
      [resolved('milk', 'milk'), unresolved('kabocha')],
      context(),
    );
    const { clear, needsLook } = partitionProposals(proposals);
    expect(clear.map((p) => p.id)).toEqual(['a']);
    expect(needsLook.map((p) => p.id)).toEqual(['b']);
  });
});

describe('the photo path is unchanged', () => {
  beforeEach(async () => {
    openTestDatabase();
    await loadSeedData();
  });

  test('a resolved photo item still gets its canonical default location and expiry', async () => {
    const canonicals = await getAllCanonicals();
    const locations = await getLocations();
    const chicken = canonicals.find((c) => c.id === 'chicken-breast')!;
    const outcomes = await resolveIngredientReferencesLocally(
      [{ raw: 'chicken breast' }],
      'vision',
    );
    const [proposal] = planCaptureItems(
      [{ name: 'chicken breast', quantity: 2, unit: 'piece' }],
      outcomes,
      canonicals,
      locations,
      '2026-08-01',
    );
    expect(proposal!.canonical?.id).toBe('chicken-breast');
    expect(proposal!.location?.id).toBe(chicken.defaultLocation);
    expect(proposal!.predictedExpiry).not.toBeNull();
    expect(proposal!.captured.quantity).toBe(2);
  });

  test('an unresolved photo item still has no canonical, no location, no expiry', async () => {
    const canonicals = await getAllCanonicals();
    const locations = await getLocations();
    const [proposal] = planCaptureItems(
      [{ name: 'zzzz unknowable thing', quantity: 1, unit: 'piece' }],
      [unresolved('zzzz unknowable thing')],
      canonicals,
      locations,
      '2026-08-01',
    );
    expect(proposal!.canonical).toBeNull();
    expect(proposal!.location).toBeNull();
    expect(proposal!.predictedExpiry).toBeNull();
  });
});

describe('voice provenance', () => {
  beforeEach(async () => {
    openTestDatabase();
    await loadSeedData();
  });

  test('a spoken ingredient resolves through the same cascade, tagged voice', async () => {
    const outcomes = await resolveIngredientReferencesLocally(
      [{ raw: 'chicken breast' }],
      'voice',
    );
    expect(outcomes[0]!.status).toBe('resolved');
  });

  test('an unresolved spoken name reaches the queue as voice, in its own script', async () => {
    const { enqueueMatch } = await import('../src/db/queries');
    await enqueueMatch({ rawText: '蠔油大瓶', source: 'voice' });
    const queue = await getMatchQueue();
    const entry = queue.find((row) => row.rawText === '蠔油大瓶');
    expect(entry?.source).toBe('voice');
    // Never romanised — decision 31, and the reason the alias layer stores script.
    expect(entry?.rawText).toBe('蠔油大瓶');
  });

  test('planning keeps the stated name in its original script', () => {
    const [proposal] = planIntakeProposals(
      [candidate({ id: 'a', statedName: '豆腐' })],
      [unresolved('豆腐')],
      context(),
    );
    expect(proposal!.statedName).toBe('豆腐');
  });
});
