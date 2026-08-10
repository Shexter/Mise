import { describe, expect, test } from 'vitest';

import { mergeReceiptFrameLines, type ReceiptFrameLineInput } from '../src/logic/receiptFrames';

function line(rawText: string, lineTotalCents: number): ReceiptFrameLineInput {
  return {
    rawText,
    kind: 'food',
    qty: 1,
    unit: 'piece',
    quantityKind: 'count',
    lineTotalCents,
    unitPriceCents: lineTotalCents,
    appliesToText: null,
  };
}

describe('receipt frame merge', () => {
  test('suppresses only the matching edge between adjacent frames', () => {
    const result = mergeReceiptFrameLines([
      { frameId: 'top', lines: [line('Milk', 499), line('Apples', 399)] },
      { frameId: 'bottom', lines: [line('Apples', 399), line('Bread', 299)] },
    ]);

    expect(result.map((item) => item.rawText)).toEqual(['Milk', 'Apples', 'Bread']);
  });

  test('preserves a legitimate repeated purchase immediately after an overlap', () => {
    const result = mergeReceiptFrameLines([
      { frameId: 'top', lines: [line('Apples', 399)] },
      { frameId: 'bottom', lines: [line('Apples', 399), line('Apples', 399), line('Bread', 299)] },
    ]);

    expect(result.map((item) => item.rawText)).toEqual(['Apples', 'Apples', 'Bread']);
  });

  test('does not suppress duplicate-looking rows away from a frame edge', () => {
    const result = mergeReceiptFrameLines([
      { frameId: 'top', lines: [line('Milk', 499), line('Bread', 299)] },
      { frameId: 'bottom', lines: [line('Apples', 399), line('Milk', 499)] },
    ]);

    expect(result.map((item) => item.rawText)).toEqual(['Milk', 'Bread', 'Apples', 'Milk']);
  });
});
