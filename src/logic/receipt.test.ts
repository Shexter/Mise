import { describe, expect, test } from 'vitest';

import { canonical, item } from '@/logic/__fixtures__/kitchens';
import { planReceiptApply, referencesFromLines, type PantryChange } from '@/logic/receipt';
import type { ExtractedLine } from '@/api/receipt';
import type { CanonicalItem, Location, ReceiptLine } from '@/types';

/**
 * The pure planner: reconciliation branches, the non-grocery case, and the
 * multi-quantity price split, all as a function from inputs to intended
 * changes — no database (task 4.8).
 */

const LOCATIONS: readonly Location[] = [
  { id: 'fridge', name: 'Fridge', kind: 'fridge', sortOrder: 0 },
  { id: 'freezer', name: 'Freezer', kind: 'freezer', sortOrder: 1 },
  { id: 'pantry', name: 'Pantry', kind: 'ambient', sortOrder: 2 },
  { id: 'counter', name: 'Counter', kind: 'counter', sortOrder: 3 },
];

const CANONICALS: readonly CanonicalItem[] = [
  canonical({ id: 'soy-sauce-light', displayName: 'Light soy sauce', foodClass: 'condiment', defaultLocation: 'pantry' }),
  canonical({ id: 'sesame-oil', displayName: 'Sesame oil', foodClass: 'staple', defaultLocation: 'pantry' }),
  canonical({ id: 'gochujang', displayName: 'Gochujang', foodClass: 'condiment', defaultLocation: 'fridge' }),
  canonical({ id: 'jasmine-rice', displayName: 'Jasmine rice', foodClass: 'staple', defaultLocation: 'pantry' }),
  canonical({ id: 'eggs', displayName: 'Eggs', foodClass: 'dairy', defaultLocation: 'fridge' }),
];

function canonicalsMap(): Map<string, CanonicalItem> {
  return new Map(CANONICALS.map((c) => [c.id, c]));
}

let counter = 0;
function line(overrides: Partial<ReceiptLine> & { canonicalId: string | null }): ReceiptLine {
  counter += 1;
  return {
    id: `line-${counter}`,
    receiptId: 'receipt-1',
    rawText: 'TEST ITEM',
    kind: 'food',
    qty: 1,
    unit: 'piece',
    lineTotalCents: 100,
    unitPriceCents: null,
    pantryItemId: null,
    excluded: false,
    createdAt: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

function plan(
  lines: ReceiptLine[],
  catalogue: ReturnType<typeof item>[] = [],
  receiptType: Parameters<typeof planReceiptApply>[4] = 'grocery',
): PantryChange[] {
  return planReceiptApply(lines, catalogue, canonicalsMap(), LOCATIONS, receiptType, '2026-06-01');
}

describe('referencesFromLines', () => {
  test('only food lines become references, in printed order', () => {
    const extracted: ExtractedLine[] = [
      { text: 'SOY SAUCE', kind: 'food', qty: 500, unit: 'ml', lineTotalCents: 389, unitPriceCents: null },
      { text: 'SUBTOTAL', kind: 'arithmetic', qty: null, unit: null, lineTotalCents: 389, unitPriceCents: null },
      { text: 'PAPER TOWELS', kind: 'non_food', qty: null, unit: null, lineTotalCents: 499, unitPriceCents: null },
      { text: 'RICE', kind: 'food', qty: 908, unit: 'g', lineTotalCents: 699, unitPriceCents: null },
    ];
    const refs = referencesFromLines(extracted);
    expect(refs.map((r) => r.reference.raw)).toEqual(['SOY SAUCE', 'RICE']);
    expect(refs.map((r) => r.lineIndex)).toEqual([0, 3]);
  });

  test('carries the store onto every reference', () => {
    const extracted: ExtractedLine[] = [
      { text: 'SOY SAUCE', kind: 'food', qty: 500, unit: 'ml', lineTotalCents: 389, unitPriceCents: null },
    ];
    const refs = referencesFromLines(extracted, "Trader Joe's");
    expect(refs[0]?.reference.store).toBe("Trader Joe's");
  });
});

describe('planReceiptApply — reconciliation (decision 68)', () => {
  test('a resolved food line always creates a new pantry item, in the canonical\'s default location', () => {
    const lines = [line({ canonicalId: 'soy-sauce-light', qty: 500, unit: 'ml', lineTotalCents: 389 })];
    const changes = plan(lines);
    expect(changes).toEqual<PantryChange[]>([
      {
        kind: 'create',
        lineId: lines[0]!.id,
        item: {
          canonicalId: 'soy-sauce-light',
          locationId: 'pantry',
          qtyRemaining: 500,
          qtyUnit: 'ml',
          priceCents: 389,
          purchasedAt: '2026-06-01',
        },
      },
    ]);
  });

  test('the location follows the canonical, not a fixed default', () => {
    const lines = [line({ canonicalId: 'gochujang' })];
    const changes = plan(lines);
    const created = changes.find((c) => c.kind === 'create');
    expect(created?.kind === 'create' && created.item.locationId).toBe('fridge');
  });

  test('an existing out item is marked replaced', () => {
    const lines = [line({ canonicalId: 'soy-sauce-light' })];
    const existing = item({ id: 'old-1', canonicalId: 'soy-sauce-light', status: 'out' });
    const changes = plan(lines, [existing]);
    expect(changes).toContainEqual({ kind: 'mark_replaced', lineId: lines[0]!.id, pantryItemId: 'old-1' });
  });

  test('an existing in-stock item is left alone', () => {
    const lines = [line({ canonicalId: 'sesame-oil' })];
    const existing = item({ id: 'still-full', canonicalId: 'sesame-oil', status: 'in_stock' });
    const changes = plan(lines, [existing]);
    expect(changes.some((c) => c.kind !== 'create')).toBe(false);
  });

  test('a running-low item not yet asked is flagged once', () => {
    const lines = [line({ canonicalId: 'gochujang' })];
    const existing = item({
      id: 'low-1',
      canonicalId: 'gochujang',
      status: 'running_low',
      replacementAsked: false,
    });
    const changes = plan(lines, [existing]);
    expect(changes).toContainEqual({ kind: 'flag_asked', lineId: lines[0]!.id, pantryItemId: 'low-1' });
  });

  test('a running-low item already asked is not flagged again', () => {
    const lines = [line({ canonicalId: 'gochujang' })];
    const existing = item({
      id: 'low-2',
      canonicalId: 'gochujang',
      status: 'running_low',
      replacementAsked: true,
    });
    const changes = plan(lines, [existing]);
    expect(changes.some((c) => c.kind === 'flag_asked')).toBe(false);
  });

  test('discarded and replaced items are left alone too', () => {
    const lines = [line({ canonicalId: 'jasmine-rice' })];
    const discarded = item({ id: 'gone-1', canonicalId: 'jasmine-rice', status: 'discarded' });
    const replaced = item({ id: 'gone-2', canonicalId: 'jasmine-rice', status: 'replaced' });
    const changes = plan(lines, [discarded, replaced]);
    expect(changes.some((c) => c.kind !== 'create')).toBe(false);
  });

  test('an excluded line creates nothing', () => {
    const lines = [line({ canonicalId: 'jasmine-rice', excluded: true })];
    expect(plan(lines)).toEqual([]);
  });

  test('an unresolved food line (no canonical yet) creates nothing', () => {
    const lines = [line({ canonicalId: null })];
    expect(plan(lines)).toEqual([]);
  });

  test('a canonical id with no matching canonical is refused, not guessed', () => {
    const lines = [line({ canonicalId: 'not-a-real-canonical' })];
    expect(plan(lines)).toEqual([]);
  });

  test('a non-food, arithmetic, or discount line creates nothing', () => {
    const lines = [
      line({ canonicalId: null, kind: 'non_food' }),
      line({ canonicalId: null, kind: 'arithmetic' }),
      line({ canonicalId: null, kind: 'discount' }),
    ];
    expect(plan(lines)).toEqual([]);
  });
});

describe('planReceiptApply — non-grocery receipts', () => {
  test('a restaurant receipt produces no pantry change at all', () => {
    const lines = [line({ canonicalId: 'jasmine-rice' })];
    expect(plan(lines, [], 'restaurant')).toEqual([]);
  });

  test('an "other" receipt produces no pantry change either', () => {
    const lines = [line({ canonicalId: 'jasmine-rice' })];
    expect(plan(lines, [], 'other')).toEqual([]);
  });
});

describe('planReceiptApply — the multi-quantity price split', () => {
  test('the created item is priced at the line total, not the per-unit price', () => {
    const lines = [
      line({
        canonicalId: 'eggs',
        qty: 24,
        unit: 'piece',
        lineTotalCents: 858,
        unitPriceCents: 429,
      }),
    ];
    const changes = plan(lines);
    const created = changes.find((c) => c.kind === 'create');
    expect(created?.kind === 'create' && created.item.priceCents).toBe(858);
    expect(created?.kind === 'create' && created.item.qtyRemaining).toBe(24);
  });
});
