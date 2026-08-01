import { describe, expect, test } from 'vitest';

import {
  EXPIRING_SOON_DAYS,
  LOW_SEASONING_FRACTION,
  LOW_STAPLE_FRACTION,
  LOW_STAPLE_USES,
  daysUntil,
  stockStatus,
  type StatusInputs,
} from '@/logic/stockStatus';
import type { CanonicalItem } from '@/types';

const TODAY = '2026-06-01';

type CanonicalSlice = Parameters<typeof stockStatus>[1];

const RICE: CanonicalSlice = {
  foodClass: 'staple',
  typicalUseQty: 75,
  typicalUseUnit: 'g',
  typicalPkgQty: 5000,
  typicalPkgUnit: 'g',
};

const GOCHUJANG: CanonicalSlice = {
  foodClass: 'condiment',
  typicalUseQty: 15,
  typicalUseUnit: 'g',
  typicalPkgQty: 500,
  typicalPkgUnit: 'g',
};

const CHICKEN: CanonicalSlice = {
  foodClass: 'protein',
  typicalUseQty: 200,
  typicalUseUnit: 'g',
  typicalPkgQty: null,
  typicalPkgUnit: null,
};

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

describe('explicit user actions are authoritative', () => {
  test.each(['out', 'discarded', 'running_low'] as const)(
    'a stored %s survives any signal',
    (status) => {
      const plenty = item({ status, qtyRemaining: 5000, qtyUnit: 'g' });
      expect(stockStatus(plenty, RICE, TODAY)).toBe(status);
    },
  );
});

describe('staples: mass with a defensible threshold', () => {
  const threshold = Math.max(
    LOW_STAPLE_USES * RICE.typicalUseQty!,
    LOW_STAPLE_FRACTION * RICE.typicalPkgQty!,
  );

  test('above the threshold is in stock', () => {
    expect(
      stockStatus(item({ qtyRemaining: threshold + 1, qtyUnit: 'g' }), RICE, TODAY),
    ).toBe('in_stock');
  });

  test('below the threshold is running low', () => {
    expect(
      stockStatus(item({ qtyRemaining: threshold - 1, qtyUnit: 'g' }), RICE, TODAY),
    ).toBe('running_low');
  });

  test('zero is out', () => {
    expect(stockStatus(item({ qtyRemaining: 0, qtyUnit: 'g' }), RICE, TODAY)).toBe('out');
  });

  test('the threshold is the larger of three uses and 15% of a package', () => {
    // 3 uses = 225 g; 15% of 5 kg = 750 g — the package fraction governs.
    expect(threshold).toBe(750);
  });

  test('no quantity, or a unit mismatch, makes no claim', () => {
    expect(stockStatus(item(), RICE, TODAY)).toBe('in_stock');
    expect(
      stockStatus(item({ qtyRemaining: 1, qtyUnit: 'cup' }), RICE, TODAY),
    ).toBe('in_stock');
  });
});

describe('seasonings and condiments: fullness, then uses', () => {
  test('fullness maps to status directly', () => {
    expect(stockStatus(item({ fullness: 'full' }), GOCHUJANG, TODAY)).toBe('in_stock');
    expect(stockStatus(item({ fullness: 'half' }), GOCHUJANG, TODAY)).toBe('in_stock');
    expect(stockStatus(item({ fullness: 'low' }), GOCHUJANG, TODAY)).toBe('running_low');
    expect(stockStatus(item({ fullness: 'out' }), GOCHUJANG, TODAY)).toBe('out');
  });

  test('an explicit fullness overrides the uses estimate', () => {
    // Estimate says nearly empty (30 of ~33 uses); the user says half.
    const half = item({ fullness: 'half', usesCount: 30 });
    expect(stockStatus(half, GOCHUJANG, TODAY)).toBe('in_stock');
  });

  test('without fullness, enough uses reads running low', () => {
    const perContainer = GOCHUJANG.typicalPkgQty! / GOCHUJANG.typicalUseQty!;
    const atBoundary = Math.ceil(LOW_SEASONING_FRACTION * perContainer);
    expect(
      stockStatus(item({ usesCount: atBoundary }), GOCHUJANG, TODAY),
    ).toBe('running_low');
    expect(
      stockStatus(item({ usesCount: atBoundary - 1 }), GOCHUJANG, TODAY),
    ).toBe('in_stock');
  });

  test('a fresh jar is in stock', () => {
    expect(stockStatus(item(), GOCHUJANG, TODAY)).toBe('in_stock');
  });
});

describe('perishables: the calendar, regardless of quantity', () => {
  test('an item well within life is in stock', () => {
    expect(
      stockStatus(item({ expiresAt: '2026-06-30' }), CHICKEN, TODAY),
    ).toBe('in_stock');
  });

  test('within the expiring-soon window reads running low', () => {
    expect(
      stockStatus(item({ expiresAt: '2026-06-03' }), CHICKEN, TODAY),
    ).toBe('running_low');
  });

  test('past expiry reads running low even with plenty of mass', () => {
    const heavy = item({
      expiresAt: '2026-05-20',
      qtyRemaining: 2000,
      qtyUnit: 'g',
    });
    expect(stockStatus(heavy, CHICKEN, TODAY)).toBe('running_low');
  });

  test('no date means no claim', () => {
    expect(stockStatus(item(), CHICKEN, TODAY)).toBe('in_stock');
  });
});

describe('daysUntil', () => {
  test('counts calendar days and goes negative when past', () => {
    expect(daysUntil('2026-06-04', TODAY)).toBe(3);
    expect(daysUntil('2026-06-01', TODAY)).toBe(0);
    expect(daysUntil('2026-05-30', TODAY)).toBe(-2);
    expect(daysUntil(null, TODAY)).toBeNull();
  });

  test('the expiring-soon window matches the exported constant', () => {
    expect(EXPIRING_SOON_DAYS).toBe(3);
  });
});
