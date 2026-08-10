import { describe, expect, test } from 'vitest';

import { planCaptureItems } from '../src/logic/captureItems';
import type { CanonicalItem, Location } from '../src/types';

const tomato = {
  id: 'tomato',
  displayName: 'Tomato',
  foodClass: 'produce',
  defaultLocation: 'fridge',
  shelfLifeDays: { fridge: 7 },
  openLifeDays: null,
  typicalUseQty: null,
  typicalUseUnit: null,
  sources: {},
} as CanonicalItem;

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
