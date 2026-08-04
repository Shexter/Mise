import { describe, expect, test } from 'vitest';

import { item } from '@/logic/__fixtures__/kitchens';
import { planReceiptApply, referencesFromLines, type PantryChange } from '@/logic/receipt';
import type { ExtractedLine } from '@/api/receipt';
import type { ReceiptLine } from '@/types';

/**
 * The pure planner: reconciliation branches, the non-grocery case, and the
 * multi-quantity price split, all as a function from inputs to intended
 * changes — no database (task 4.8).
 */

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
    const refs = referencesFromLines(extracted, 'Trader Joe\'s');
    expect(refs[0]?.reference.store).toBe('Trader Joe\'s');
  });
});

describe('planReceiptApply — reconciliation (decision 68)', () => {
  test('a resolved food line always creates a new pantry item', () => {
    const lines = [line({ canonicalId: 'soy-sauce-light', qty: 500, unit: 'ml', lineTotalCents: 389 })];
    const changes = planReceiptApply(lines, [], 'grocery', '2026-06-01');
    expect(changes).toEqual<PantryChange[]>([
      {
        kind: 'create',
        lineId: lines[0]!.id,
        item: {
          canonicalId: 'soy-sauce-light',
          qtyRemaining: 500,
          qtyUnit: 'ml',
          priceCents: 389,
          purchasedAt: '2026-06-01',
        },
      },
    ]);
  });

  test('an existing out item is marked replaced', () => {
    const lines = [line({ canonicalId: 'soy-sauce-light' })];
    const existing = item({ id: 'old-1', canonicalId: 'soy-sauce-light', status: 'out' });
    const changes = planReceiptApply(lines, [existing], 'grocery', '2026-06-01');
    expect(changes).toContainEqual({ kind: 'mark_replaced', lineId: lines[0]!.id, pantryItemId: 'old-1' });
  });

  test('an existing in-stock item is left alone', () => {
    const lines = [line({ canonicalId: 'sesame-oil' })];
    const existing = item({ id: 'still-full', canonicalId: 'sesame-oil', status: 'in_stock' });
    const changes = planReceiptApply(lines, [existing], 'grocery', '2026-06-01');
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
    const changes = planReceiptApply(lines, [existing], 'grocery', '2026-06-01');
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
    const changes = planReceiptApply(lines, [existing], 'grocery', '2026-06-01');
    expect(changes.some((c) => c.kind === 'flag_asked')).toBe(false);
  });

  test('discarded and replaced items are left alone too', () => {
    const lines = [line({ canonicalId: 'jasmine-rice' })];
    const discarded = item({ id: 'gone-1', canonicalId: 'jasmine-rice', status: 'discarded' });
    const replaced = item({ id: 'gone-2', canonicalId: 'jasmine-rice', status: 'replaced' });
    const changes = planReceiptApply(lines, [discarded, replaced], 'grocery', '2026-06-01');
    expect(changes.some((c) => c.kind !== 'create')).toBe(false);
  });

  test('an excluded line creates nothing', () => {
    const lines = [line({ canonicalId: 'jasmine-rice', excluded: true })];
    expect(planReceiptApply(lines, [], 'grocery', '2026-06-01')).toEqual([]);
  });

  test('an unresolved food line (no canonical yet) creates nothing', () => {
    const lines = [line({ canonicalId: null })];
    expect(planReceiptApply(lines, [], 'grocery', '2026-06-01')).toEqual([]);
  });

  test('a non-food, arithmetic, or discount line creates nothing', () => {
    const lines = [
      line({ canonicalId: null, kind: 'non_food' }),
      line({ canonicalId: null, kind: 'arithmetic' }),
      line({ canonicalId: null, kind: 'discount' }),
    ];
    expect(planReceiptApply(lines, [], 'grocery', '2026-06-01')).toEqual([]);
  });
});

describe('planReceiptApply — non-grocery receipts', () => {
  test('a restaurant receipt produces no pantry change at all', () => {
    const lines = [line({ canonicalId: 'jasmine-rice' })];
    expect(planReceiptApply(lines, [], 'restaurant', '2026-06-01')).toEqual([]);
  });

  test('an "other" receipt produces no pantry change either', () => {
    const lines = [line({ canonicalId: 'jasmine-rice' })];
    expect(planReceiptApply(lines, [], 'other', '2026-06-01')).toEqual([]);
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
    const changes = planReceiptApply(lines, [], 'grocery', '2026-06-01');
    const created = changes.find((c) => c.kind === 'create');
    expect(created?.kind === 'create' && created.item.priceCents).toBe(858);
    expect(created?.kind === 'create' && created.item.qtyRemaining).toBe(24);
  });
});
