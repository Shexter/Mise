import { describe, expect, test } from 'vitest';

import { captureItemsFromReceiptLines, planCaptureItems } from '../src/logic/captureItems';
import { canonical } from '../src/logic/__fixtures__/kitchens';
import type { Location, ReceiptLine } from '../src/types';

const tomato = canonical({
  id: 'tomato',
  displayName: 'Tomato',
  foodClass: 'produce',
  defaultLocation: 'fridge',
  shelfLifeDays: { fridge: 7 },
});

const locations = [
  { id: 'pantry', name: 'Pantry', kind: 'ambient', sortOrder: 0 },
  { id: 'fridge', name: 'Fridge', kind: 'fridge', sortOrder: 1 },
] as Location[];

describe('planCaptureItems', () => {
  test('keeps several photographed groceries separate with default locations and predicted expiry', () => {
    const result = planCaptureItems(
      [
        { name: 'Tomatoes', quantity: 4, unit: 'piece' },
        { name: 'Mystery item', quantity: null, unit: null },
      ],
      [
        { status: 'resolved', raw: 'Tomatoes', norm: 'tomatoes', canonicalId: 'tomato', confidence: 1, method: 'exact_alias' },
        { status: 'unresolved', raw: 'Mystery item', norm: 'mystery item', queued: true },
      ],
      [tomato],
      locations,
      '2026-08-09',
    );

    expect(result[0]).toMatchObject({
      captured: { name: 'Tomatoes', quantity: 4, unit: 'piece' },
      canonical: { id: 'tomato' },
      location: { id: 'fridge' },
      predictedExpiry: '2026-08-16',
    });
    expect(result[1]).toMatchObject({
      captured: { name: 'Mystery item' },
      canonical: null,
      location: null,
      predictedExpiry: null,
    });
  });
});

describe('captureItemsFromReceiptLines', () => {
  test('keeps included food lines and excludes receipt-only rows', () => {
    const line = (overrides: Partial<ReceiptLine>): ReceiptLine => ({
      id: 'line', receiptId: 'receipt', rawText: 'Rice', kind: 'food', qty: 500,
      unit: 'g', quantityKind: 'measure', lineTotalCents: 399, unitPriceCents: null,
      canonicalId: null, appliesToLineId: null, pantryItemId: null, excluded: false,
      createdAt: '2026-08-09T00:00:00.000Z', ...overrides,
    });

    expect(captureItemsFromReceiptLines([
      line({ rawText: 'Rice' }),
      line({ rawText: 'Bag fee', kind: 'non_food' }),
      line({ rawText: 'Excluded tofu', excluded: true }),
    ])).toEqual([{ name: 'Rice', quantity: 500, unit: 'g' }]);
  });
});
