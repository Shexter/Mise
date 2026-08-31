import { beforeEach, describe, expect, test } from 'vitest';

import {
  applyPantryIntakeBatch,
  getSuggestionCache,
  invalidatePantryDependentSuggestions,
  saveSuggestionCache,
  getPantryItem,
  insertPantryItem,
  listPantryItems,
  loadSeedData,
  undoPantryIntakeBatch,
  type IntakeBatchItem,
} from '../src/db/queries';
import {
  finalActionLabel,
  openReview,
  pendingRowCount,
  resolveIdentity,
  reviewOpeningSummary,
  selectedProposals,
  setLocation,
  setQuantity,
  skip,
  successSummary,
  toggleSelection,
  unresolvedProposals,
} from '../src/logic/intakeReview';
import { planIntakeProposals, type IntakeCandidate } from '../src/logic/intakeProposals';
import { UNKNOWN_QUANTITY, materialise } from '../src/logic/materialisation';
import type { MatchOutcome } from '../src/logic/match';
import type { CanonicalItem, Location, PantryIntakeProposal } from '../src/types';
import { openTestDatabase } from './stubs/db';

/* -------------------------------------------------------------------------- */
/* Review model                                                                */
/* -------------------------------------------------------------------------- */

const LOCATIONS: Location[] = [
  { id: 'fridge', name: 'Fridge', kind: 'fridge', sortOrder: 0 },
  { id: 'freezer', name: 'Freezer', kind: 'freezer', sortOrder: 1 },
];

const CANONICALS = [
  { id: 'milk', displayName: 'Milk', defaultLocation: 'fridge' },
  { id: 'butter', displayName: 'Butter', defaultLocation: 'fridge' },
] as unknown as CanonicalItem[];

const resolved = (raw: string, canonicalId: string): MatchOutcome =>
  ({ status: 'resolved', raw, norm: raw, canonicalId, confidence: 0.95, method: 'exact_alias' } as MatchOutcome);
const unresolved = (raw: string): MatchOutcome =>
  ({ status: 'unresolved', raw, norm: raw, queued: false } as MatchOutcome);

function build(
  entries: readonly { id: string; name: string; outcome: MatchOutcome; quantity?: IntakeCandidate['quantity'] }[],
): PantryIntakeProposal[] {
  return planIntakeProposals(
    entries.map((entry) => ({
      id: entry.id,
      statedName: entry.name,
      quantity: entry.quantity ?? { containerCount: 1, amount: null, unit: null, approximate: false },
    })),
    entries.map((entry) => entry.outcome),
    {
      draftId: 'draft-1',
      source: 'voice',
      transcriptionMode: 'keyboard',
      canonicals: CANONICALS,
      locations: LOCATIONS,
      sessionLocationId: 'fridge',
    },
  );
}

describe('review preselects the clear items and nothing else', () => {
  test('clear proposals start selected; uncertain ones do not', () => {
    const state = openReview('draft-1', build([
      { id: 'a', name: 'milk', outcome: resolved('milk', 'milk') },
      { id: 'b', name: 'kabocha', outcome: unresolved('kabocha') },
    ]));
    expect(state.selectedIds).toEqual(['a']);
  });

  test('an unresolved proposal cannot be selected by tapping it', () => {
    const state = openReview('draft-1', build([
      { id: 'b', name: 'kabocha', outcome: unresolved('kabocha') },
    ]));
    // The button must not promise a write the transaction would refuse.
    expect(toggleSelection(state, 'b').selectedIds).toEqual([]);
  });

  test('resolving the identity selects the row without a second tap', () => {
    let state = openReview('draft-1', build([
      { id: 'b', name: 'kabocha', outcome: unresolved('kabocha') },
    ]));
    state = resolveIdentity(state, 'b', {
      canonicalId: 'butter',
      displayName: 'Butter',
      confidence: 1,
    });
    expect(state.selectedIds).toEqual(['b']);
    expect(unresolvedProposals(state)).toEqual([]);
  });

  test('an unknown quantity is selectable, because presence is the fact', () => {
    const state = openReview('draft-1', build([
      { id: 'a', name: 'butter', outcome: resolved('butter', 'butter'), quantity: UNKNOWN_QUANTITY },
    ]));
    // Unknown quantity is a note, so it starts unselected and is still allowed.
    expect(state.selectedIds).toEqual([]);
    expect(toggleSelection(state, 'a').selectedIds).toEqual(['a']);
  });

  test('typing a quantity clears the unknown note', () => {
    let state = openReview('draft-1', build([
      { id: 'a', name: 'butter', outcome: resolved('butter', 'butter'), quantity: UNKNOWN_QUANTITY },
    ]));
    state = setQuantity(state, 'a', {
      containerCount: null, amount: 250, unit: 'g', approximate: false,
    });
    expect(state.proposals[0]!.notes).toEqual([]);
    expect(state.proposals[0]!.quantityStrength).toBe('stated');
  });

  test('skipping removes an item from the batch but keeps it visible', () => {
    let state = openReview('draft-1', build([
      { id: 'a', name: 'milk', outcome: resolved('milk', 'milk') },
    ]));
    state = skip(state, 'a');
    expect(state.selectedIds).toEqual([]);
    expect(state.proposals).toHaveLength(1);
  });
});

describe('the final action states exactly what it will do', () => {
  test('it counts pantry rows, not spoken phrases', () => {
    const state = openReview('draft-1', build([
      {
        id: 'a', name: 'milk', outcome: resolved('milk', 'milk'),
        quantity: { containerCount: 3, amount: null, unit: null, approximate: false },
      },
    ]));
    // Three cartons is three physical containers, so three rows.
    expect(pendingRowCount(state)).toBe(3);
    expect(finalActionLabel(state, LOCATIONS)).toBe('Add 3 items to Fridge');
  });

  test('it names the destination when there is one', () => {
    const state = openReview('draft-1', build([
      { id: 'a', name: 'milk', outcome: resolved('milk', 'milk') },
    ]));
    expect(finalActionLabel(state, LOCATIONS)).toBe('Add 1 item to Fridge');
  });

  test('it refuses to name one shelf when the batch spans several', () => {
    let state = openReview('draft-1', build([
      { id: 'a', name: 'milk', outcome: resolved('milk', 'milk') },
      { id: 'b', name: 'butter', outcome: resolved('butter', 'butter') },
    ]));
    state = setLocation(state, 'b', 'freezer');
    expect(finalActionLabel(state, LOCATIONS)).toBe('Add 2 items across 2 places');
  });

  test('an empty selection promises nothing', () => {
    let state = openReview('draft-1', build([
      { id: 'a', name: 'milk', outcome: resolved('milk', 'milk') },
    ]));
    state = skip(state, 'a');
    expect(finalActionLabel(state, LOCATIONS)).toBe('Nothing selected');
  });
});

describe('the summaries a screen reader hears', () => {
  test('the opening summary counts both groups', () => {
    const proposals = build([
      { id: 'a', name: 'milk', outcome: resolved('milk', 'milk') },
      { id: 'b', name: 'kabocha', outcome: unresolved('kabocha') },
    ]);
    expect(reviewOpeningSummary(proposals)).toBe('Found 2 items: 1 clear, 1 needing a look.');
  });

  test('finding nothing offers the ways out rather than an error', () => {
    expect(reviewOpeningSummary([])).toMatch(/keep speaking.*type instead/i);
  });

  test('the success summary mentions what was left out', () => {
    expect(successSummary(8, 2)).toBe(
      'Added 8 items to your pantry. 2 phrases were left out.',
    );
    expect(successSummary(1, 0)).toBe('Added 1 item to your pantry.');
  });
});

/* -------------------------------------------------------------------------- */
/* The writer                                                                  */
/* -------------------------------------------------------------------------- */

const rowsFor = (count: number, qty: number | null = null) =>
  Array.from({ length: count }, () => ({ qtyRemaining: qty, qtyUnit: qty == null ? null : ('g' as const) }));

const item = (over: Partial<IntakeBatchItem> = {}): IntakeBatchItem => ({
  canonicalId: 'chicken-breast',
  locationId: 'fridge',
  rows: rowsFor(1),
  acquiredAtKnown: false,
  ...over,
});

describe('applying a reviewed batch', () => {
  beforeEach(async () => {
    openTestDatabase();
    await loadSeedData();
  });

  test('every accepted proposal becomes stock in one go', async () => {
    const result = await applyPantryIntakeBatch('draft-1', 'voice', [
      item({ rows: rowsFor(2) }),
      item({ canonicalId: 'soy-sauce-light', locationId: 'pantry' }),
    ]);
    expect(result.alreadyApplied).toBe(false);
    expect(result.createdItemIds).toHaveLength(3);
    expect(await listPantryItems()).toHaveLength(3);
  });

  test('a first-inventory batch predicts no expiry', async () => {
    const result = await applyPantryIntakeBatch('draft-1', 'voice', [item()]);
    const stored = await getPantryItem(result.createdItemIds[0]!);
    expect(stored?.acquiredAtKnown).toBe(false);
    expect(stored?.expiresAt).toBeNull();
  });

  test('a batch with a stated date predicts normally', async () => {
    const result = await applyPantryIntakeBatch('draft-1', 'voice', [
      item({ acquiredAtKnown: true, acquiredAt: '2026-08-01' }),
    ]);
    const stored = await getPantryItem(result.createdItemIds[0]!);
    expect(stored?.expiresAt).not.toBeNull();
    expect(stored?.expirySource).toBe('predicted');
  });

  test('a spoken quantity is recorded as the user’s own, not an estimate', async () => {
    const result = await applyPantryIntakeBatch('draft-1', 'voice', [
      item({ rows: [{ qtyRemaining: 400, qtyUnit: 'g' }] }),
    ]);
    const stored = await getPantryItem(result.createdItemIds[0]!);
    expect(stored?.qtyRemaining).toBe(400);
    expect(stored?.qtySource).toBe('user');
  });

  test('one bad item prevents the whole batch, leaving nothing behind', async () => {
    await expect(
      applyPantryIntakeBatch('draft-1', 'voice', [
        item(),
        item({ canonicalId: 'not-a-real-ingredient' }),
        item(),
      ]),
    ).rejects.toThrow(/Nothing was added/);

    expect(await listPantryItems()).toEqual([]);
  });

  test('a failed batch can be retried under the same draft id once fixed', async () => {
    await expect(
      applyPantryIntakeBatch('draft-2', 'voice', [item({ canonicalId: 'nope' })]),
    ).rejects.toThrow();
    const retried = await applyPantryIntakeBatch('draft-2', 'voice', [item()]);
    expect(retried.alreadyApplied).toBe(false);
    expect(await listPantryItems()).toHaveLength(1);
  });
});

describe('confirming twice does not make two pantries', () => {
  beforeEach(async () => {
    openTestDatabase();
    await loadSeedData();
  });

  test('the second confirmation returns the first batch and writes nothing', async () => {
    const first = await applyPantryIntakeBatch('draft-1', 'voice', [item({ rows: rowsFor(2) })]);
    const second = await applyPantryIntakeBatch('draft-1', 'voice', [item({ rows: rowsFor(2) })]);

    expect(second.alreadyApplied).toBe(true);
    expect(second.batchId).toBe(first.batchId);
    expect(second.createdItemIds.sort()).toEqual(first.createdItemIds.sort());
    expect(await listPantryItems()).toHaveLength(2);
  });

  test('a different draft is a different batch', async () => {
    await applyPantryIntakeBatch('draft-1', 'voice', [item()]);
    const other = await applyPantryIntakeBatch('draft-2', 'voice', [item()]);
    expect(other.alreadyApplied).toBe(false);
    expect(await listPantryItems()).toHaveLength(2);
  });
});

describe('undo removes exactly the batch', () => {
  beforeEach(async () => {
    openTestDatabase();
    await loadSeedData();
  });

  test('pre-existing stock is untouched', async () => {
    const before = await insertPantryItem({
      canonicalId: 'chicken-breast',
      locationId: 'fridge',
    });
    const batch = await applyPantryIntakeBatch('draft-1', 'voice', [item({ rows: rowsFor(3) })]);
    expect(await listPantryItems()).toHaveLength(4);

    const removed = await undoPantryIntakeBatch(batch.batchId);

    expect(removed).toBe(3);
    const remaining = await listPantryItems();
    expect(remaining.map((row) => row.id)).toEqual([before.id]);
  });

  test('an item added by hand between confirm and undo survives', async () => {
    const batch = await applyPantryIntakeBatch('draft-1', 'voice', [item()]);
    const byHand = await insertPantryItem({
      // Same food, same shelf, seconds later — indistinguishable except by id.
      canonicalId: 'chicken-breast',
      locationId: 'fridge',
    });

    await undoPantryIntakeBatch(batch.batchId);

    const remaining = await listPantryItems();
    expect(remaining.map((row) => row.id)).toEqual([byHand.id]);
  });

  test('undoing twice is harmless', async () => {
    const batch = await applyPantryIntakeBatch('draft-1', 'voice', [item()]);
    expect(await undoPantryIntakeBatch(batch.batchId)).toBe(1);
    expect(await undoPantryIntakeBatch(batch.batchId)).toBe(0);
  });

  test('an undone draft cannot be re-applied into a second batch', async () => {
    const batch = await applyPantryIntakeBatch('draft-1', 'voice', [item()]);
    await undoPantryIntakeBatch(batch.batchId);

    const again = await applyPantryIntakeBatch('draft-1', 'voice', [item()]);
    expect(again.alreadyApplied).toBe(true);
    expect(await listPantryItems()).toEqual([]);
  });
});

describe('cancelled and abandoned reviews create nothing', () => {
  beforeEach(async () => {
    openTestDatabase();
    await loadSeedData();
  });

  test('planning and reviewing without confirming writes no row', async () => {
    const state = openReview('draft-1', build([
      { id: 'a', name: 'milk', outcome: resolved('milk', 'milk') },
    ]));
    expect(selectedProposals(state)).toHaveLength(1);
    // No call to applyPantryIntakeBatch — the only path that writes.
    expect(await listPantryItems()).toEqual([]);
  });

  test('a partial selection writes only what was selected', async () => {
    let state = openReview('draft-1', build([
      { id: 'a', name: 'milk', outcome: resolved('milk', 'milk') },
      { id: 'b', name: 'butter', outcome: resolved('butter', 'butter') },
    ]));
    state = skip(state, 'b');

    const accepted = selectedProposals(state).map((proposal) => ({
      canonicalId: 'chicken-breast',
      locationId: proposal.locationId!,
      rows: materialise(proposal.quantity).rows,
      acquiredAtKnown: false,
    }));
    await applyPantryIntakeBatch(state.draftId, 'voice', accepted);

    expect(await listPantryItems()).toHaveLength(1);
  });
});

describe('downstream suggestions are invalidated once', () => {
  beforeEach(async () => {
    openTestDatabase();
    await loadSeedData();
  });

  const cache = async () =>
    saveSuggestionCache('2026-08-31', 'tonight', null, null, 'fp', [], null, 0, [], 0, null);

  test('a cached set survives an ordinary read', async () => {
    await cache();
    expect(await getSuggestionCache('2026-08-31', 'tonight')).not.toBeNull();
  });

  test('confirming a batch clears the cache the fingerprint would have missed', async () => {
    await cache();
    // Newly catalogued stock has no expiry, so it is not urgent, so the
    // fingerprint alone would not notice the fridge just filled up.
    await applyPantryIntakeBatch('draft-1', 'voice', [item()]);
    await invalidatePantryDependentSuggestions();
    expect(await getSuggestionCache('2026-08-31', 'tonight')).toBeNull();
  });

  test('undoing a batch clears it again', async () => {
    const batch = await applyPantryIntakeBatch('draft-1', 'voice', [item()]);
    await invalidatePantryDependentSuggestions();
    await cache();
    await undoPantryIntakeBatch(batch.batchId);
    await invalidatePantryDependentSuggestions();
    expect(await getSuggestionCache('2026-08-31', 'tonight')).toBeNull();
  });
});
