import { describe, expect, test } from 'vitest';

import { canonical, item } from '@/logic/__fixtures__/kitchens';
import {
  checkArithmetic,
  planReceiptApply,
  referencesFromLines,
  type PantryChange,
} from '@/logic/receipt';
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
    quantityKind: null,
    lineTotalCents: 100,
    unitPriceCents: null,
    appliesToLineId: null,
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
      { text: 'SOY SAUCE', kind: 'food', qty: 500, unit: 'ml', quantityKind: 'measure', lineTotalCents: 389, unitPriceCents: null, appliesToText: null },
      { text: 'SUBTOTAL', kind: 'arithmetic', qty: null, unit: null, quantityKind: null, lineTotalCents: 389, unitPriceCents: null, appliesToText: null },
      { text: 'PAPER TOWELS', kind: 'non_food', qty: null, unit: null, quantityKind: null, lineTotalCents: 499, unitPriceCents: null, appliesToText: null },
      { text: 'RICE', kind: 'food', qty: 908, unit: 'g', quantityKind: 'measure', lineTotalCents: 699, unitPriceCents: null, appliesToText: null },
    ];
    const refs = referencesFromLines(extracted);
    expect(refs.map((r) => r.reference.raw)).toEqual(['SOY SAUCE', 'RICE']);
    expect(refs.map((r) => r.lineIndex)).toEqual([0, 3]);
  });

  test('carries the store onto every reference', () => {
    const extracted: ExtractedLine[] = [
      { text: 'SOY SAUCE', kind: 'food', qty: 500, unit: 'ml', quantityKind: 'measure', lineTotalCents: 389, unitPriceCents: null, appliesToText: null },
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

describe('planReceiptApply — a count creates one item per container (4a)', () => {
  test('a count of two creates two separate pantry items', () => {
    const lines = [
      line({
        canonicalId: 'gochujang',
        qty: 2,
        unit: 'piece',
        quantityKind: 'count',
        lineTotalCents: 900,
        unitPriceCents: 450,
      }),
    ];
    const created = plan(lines).filter((c) => c.kind === 'create');
    expect(created.length).toBe(2);
    for (const change of created) {
      expect(change.kind === 'create' && change.item.qtyRemaining).toBe(1);
      expect(change.kind === 'create' && change.item.qtyUnit).toBe('piece');
    }
  });

  test('the line total is divided across the containers, remainder on the first', () => {
    const lines = [
      line({
        canonicalId: 'gochujang',
        qty: 3,
        unit: 'piece',
        quantityKind: 'count',
        lineTotalCents: 1000,
      }),
    ];
    const created = plan(lines).filter(
      (c): c is Extract<PantryChange, { kind: 'create' }> => c.kind === 'create',
    );
    const shares = created.map((c) => c.item.priceCents);
    expect(shares).toEqual([334, 333, 333]);
    expect(shares.reduce((sum: number, cents) => sum + (cents ?? 0), 0)).toBe(1000);
  });

  test('a measure line stays a single item, not one per unit of measure', () => {
    const lines = [
      line({
        canonicalId: 'jasmine-rice',
        qty: 834,
        unit: 'g',
        quantityKind: 'measure',
        lineTotalCents: 1299,
      }),
    ];
    const created = plan(lines).filter((c) => c.kind === 'create');
    expect(created.length).toBe(1);
    expect(created[0]?.kind === 'create' && created[0].item.qtyRemaining).toBe(834);
  });

  test('the same ingredient on two separate lines creates two items, not a collapsed one', () => {
    const lines = [
      line({ canonicalId: 'jasmine-rice', qty: 500, unit: 'g', quantityKind: 'measure' }),
      line({ canonicalId: 'jasmine-rice', qty: 500, unit: 'g', quantityKind: 'measure' }),
    ];
    const created = plan(lines).filter((c) => c.kind === 'create');
    expect(created.length).toBe(2);
  });

  test('an unreadable count (qty null) is not fabricated into several items', () => {
    const lines = [
      line({
        canonicalId: 'gochujang',
        qty: null,
        unit: null,
        quantityKind: 'count',
        lineTotalCents: 450,
      }),
    ];
    const created = plan(lines).filter((c) => c.kind === 'create');
    expect(created.length).toBe(1);
  });
});

describe('planReceiptApply — an attributed discount reduces the target line\'s price (4b)', () => {
  test('a discount targeting a food line reduces its created item\'s price', () => {
    const foodLine = line({ canonicalId: 'gochujang', qty: 1, unit: 'piece', lineTotalCents: 500 });
    const discountLine = line({
      canonicalId: null,
      kind: 'discount',
      qty: null,
      unit: null,
      lineTotalCents: -100,
      appliesToLineId: foodLine.id,
    });
    const created = plan([foodLine, discountLine]).filter((c) => c.kind === 'create');
    expect(created.length).toBe(1);
    expect(created[0]?.kind === 'create' && created[0].item.priceCents).toBe(400);
  });

  test('an unattributed discount does not touch any line\'s price', () => {
    const foodLine = line({ canonicalId: 'gochujang', qty: 1, unit: 'piece', lineTotalCents: 500 });
    const discountLine = line({
      canonicalId: null,
      kind: 'discount',
      qty: null,
      unit: null,
      lineTotalCents: -500,
      appliesToLineId: null,
    });
    const created = plan([foodLine, discountLine]).filter((c) => c.kind === 'create');
    expect(created[0]?.kind === 'create' && created[0].item.priceCents).toBe(500);
  });

  test('a discount line itself creates no pantry item', () => {
    const foodLine = line({ canonicalId: 'gochujang', lineTotalCents: 500 });
    const discountLine = line({
      canonicalId: null,
      kind: 'discount',
      lineTotalCents: -100,
      appliesToLineId: foodLine.id,
    });
    const created = plan([foodLine, discountLine]).filter((c) => c.kind === 'create');
    expect(created.length).toBe(1); // only the food line
  });

  test('a deposit line creates no pantry item', () => {
    const lines = [line({ canonicalId: null, kind: 'deposit', lineTotalCents: 25 })];
    expect(plan(lines)).toEqual([]);
  });

  test('a refund line creates no pantry item', () => {
    const lines = [line({ canonicalId: null, kind: 'refund', lineTotalCents: -300 })];
    expect(plan(lines)).toEqual([]);
  });

  test('a wholly negative receipt (only refunds) creates no stock at all', () => {
    const lines = [
      line({ canonicalId: null, kind: 'refund', lineTotalCents: -300 }),
      line({ canonicalId: null, kind: 'refund', lineTotalCents: -150 }),
    ];
    expect(plan(lines)).toEqual([]);
  });

  test('a discount, deposit, or refund never reaches the matcher', () => {
    const extracted: ExtractedLine[] = [
      { text: 'LOYALTY DISCOUNT', kind: 'discount', qty: null, unit: null, quantityKind: null, lineTotalCents: -100, unitPriceCents: null, appliesToText: null },
      { text: 'BOTTLE DEPOSIT', kind: 'deposit', qty: null, unit: null, quantityKind: null, lineTotalCents: 25, unitPriceCents: null, appliesToText: null },
      { text: 'RETURNED ITEM', kind: 'refund', qty: null, unit: null, quantityKind: null, lineTotalCents: -300, unitPriceCents: null, appliesToText: null },
    ];
    expect(referencesFromLines(extracted)).toEqual([]);
  });
});

describe('checkArithmetic (4c)', () => {
  test('unknown when the receipt shows no subtotal', () => {
    const lines = [line({ canonicalId: 'jasmine-rice', lineTotalCents: 500 })];
    expect(checkArithmetic(lines, null)).toEqual({ status: 'unknown' });
  });

  test('matches silently when the lines sum to the printed subtotal', () => {
    const lines = [
      line({ canonicalId: 'jasmine-rice', lineTotalCents: 500 }),
      line({ canonicalId: 'gochujang', lineTotalCents: 300 }),
    ];
    expect(checkArithmetic(lines, 800)).toEqual({ status: 'match' });
  });

  test('reports a mismatch without adjusting any line', () => {
    const lines = [
      line({ canonicalId: 'jasmine-rice', lineTotalCents: 500 }),
      line({ canonicalId: 'gochujang', lineTotalCents: 300 }),
    ];
    const before = lines.map((l) => l.lineTotalCents);
    const result = checkArithmetic(lines, 750);
    expect(result).toEqual({
      status: 'mismatch',
      sumCents: 800,
      subtotalCents: 750,
      differenceCents: 50,
    });
    expect(lines.map((l) => l.lineTotalCents)).toEqual(before);
  });

  test('arithmetic lines are not counted in the sum', () => {
    const lines = [
      line({ canonicalId: 'jasmine-rice', lineTotalCents: 500 }),
      line({ canonicalId: null, kind: 'arithmetic', lineTotalCents: 500 }),
    ];
    expect(checkArithmetic(lines, 500)).toEqual({ status: 'match' });
  });

  test('an attributed discount still counts toward the printed subtotal', () => {
    // The food line prints at its shelf price; the discount is its own
    // negative line. The till's subtotal already nets both, so the check
    // must sum both to agree with it — attribution only matters to planning.
    const foodLine = line({ canonicalId: 'jasmine-rice', lineTotalCents: 500 });
    const discountLine = line({
      canonicalId: null,
      kind: 'discount',
      lineTotalCents: -100,
      appliesToLineId: foodLine.id,
    });
    expect(checkArithmetic([foodLine, discountLine], 400)).toEqual({ status: 'match' });
  });

  test('an unattributed (basket-wide) discount counts the same way', () => {
    const foodLine = line({ canonicalId: 'jasmine-rice', lineTotalCents: 500 });
    const discountLine = line({
      canonicalId: null,
      kind: 'discount',
      lineTotalCents: -50,
      appliesToLineId: null,
    });
    expect(checkArithmetic([foodLine, discountLine], 450)).toEqual({ status: 'match' });
  });

  test('excluded lines are not counted', () => {
    const lines = [
      line({ canonicalId: 'jasmine-rice', lineTotalCents: 500 }),
      line({ canonicalId: 'gochujang', lineTotalCents: 300, excluded: true }),
    ];
    expect(checkArithmetic(lines, 500)).toEqual({ status: 'match' });
  });
});
