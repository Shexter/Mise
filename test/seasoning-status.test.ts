import { beforeEach, describe, expect, test } from 'vitest';

import { getAllCanonicals, loadSeedData } from '../src/db/queries';
import { usesPerContainer } from '../src/logic/measures';
import { stockStatus, type StatusInputs } from '../src/logic/stockStatus';
import { openTestDatabase } from './stubs/db';

/**
 * The decision-73 regression test.
 *
 * Before `convert` existed, `usesPerContainer` required a canonical's use
 * unit to equal its package unit. Measured against the shipped seed data,
 * **0 of 29** uses-tracked canonicals satisfied that — a use is naturally a
 * tablespoon and a package naturally 500 ml or 500 g — so decision 12's
 * uses model never fired once. Seeded gochujang read `in_stock` at a
 * `usesCount` of 1,000.
 *
 * This runs against the real seed file rather than hand-written fixtures,
 * deliberately: the failure was in the *data's* shape, so a fixture that
 * happened to use matching units would have passed throughout.
 */

const USES_TRACKED = ['seasoning', 'condiment'];

function item(overrides: Partial<StatusInputs> = {}): StatusInputs {
  return {
    status: 'in_stock',
    fullness: null,
    qtyRemaining: null,
    qtyUnit: null,
    usesCount: 0,
    expiresAt: null,
    ...overrides,
  };
}

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
});

describe('seasoning status against the shipped seed set', () => {
  test('gochujang reaches running low from its use count alone', async () => {
    const gochujang = (await getAllCanonicals()).find((c) => c.id === 'gochujang');
    expect(gochujang).toBeDefined();

    const perContainer = usesPerContainer(gochujang!);
    expect(perContainer).not.toBeNull();

    // Fresh jar: in stock. Well-used jar: running low. Before the fix the
    // second case returned `in_stock` at any use count whatsoever.
    expect(stockStatus(item({ usesCount: 0 }), gochujang!)).toBe('in_stock');
    expect(
      stockStatus(item({ usesCount: Math.ceil(perContainer!) }), gochujang!),
    ).toBe('running_low');
  });

  test('the 1,000-use case that exposed the bug no longer reads in stock', async () => {
    const gochujang = (await getAllCanonicals()).find((c) => c.id === 'gochujang');
    expect(stockStatus(item({ usesCount: 1000 }), gochujang!)).toBe('running_low');
  });

  test('most uses-tracked seed canonicals can now compute a container size', async () => {
    const canonicals = await getAllCanonicals();
    const usesTracked = canonicals.filter((c) =>
      USES_TRACKED.includes(c.foodClass),
    );
    expect(usesTracked.length).toBeGreaterThan(0);

    const computable = usesTracked.filter(
      (c) => usesPerContainer(c) !== null,
    );
    // Was 0 before this change. Anything still null lacks package figures
    // entirely, which is missing data rather than an unreconciled unit —
    // and still correctly makes no claim.
    expect(computable.length).toBeGreaterThan(0);
    for (const canonical of usesTracked) {
      if (usesPerContainer(canonical) === null) {
        expect(
          canonical.typicalPkgQty === null || canonical.typicalPkgUnit === null,
          `${canonical.id} has package figures but still cannot convert`,
        ).toBe(true);
      }
    }
  });

  test('an unconvertible canonical still makes no claim rather than guessing', async () => {
    const canonicals = await getAllCanonicals();
    const noPackage = canonicals.find(
      (c) => USES_TRACKED.includes(c.foodClass) && c.typicalPkgQty === null,
    );
    if (!noPackage) return;
    expect(usesPerContainer(noPackage)).toBeNull();
    expect(stockStatus(item({ usesCount: 500 }), noPackage)).toBe('in_stock');
  });
});
