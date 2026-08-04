import { describe, expect, test } from 'vitest';

import { RECEIPTS } from '@/logic/__fixtures__/receipts';
import { parseReceiptResponse } from '@/api/receipt';

describe('parseReceiptResponse, against every fixture receipt', () => {
  test('every recorded response parses with at least one line', () => {
    for (const receipt of RECEIPTS) {
      const parsed = parseReceiptResponse(receipt.recordedResponse, receipt.captureDate);
      expect(parsed.lines.length, receipt.name).toBeGreaterThan(0);
    }
  });

  test('a missing date falls back to the capture date', () => {
    const receipt = RECEIPTS.find((r) => r.name === 'noLegibleDate')!;
    const parsed = parseReceiptResponse(receipt.recordedResponse, receipt.captureDate);
    expect(parsed.purchasedAt).toBe(receipt.captureDate);
  });

  test('a receipt with a legible date keeps it, not the capture date', () => {
    const receipt = RECEIPTS.find((r) => r.name === 'supermarketOne')!;
    const parsed = parseReceiptResponse(receipt.recordedResponse, '2099-01-01');
    expect(parsed.purchasedAt).toBe('2026-06-01');
    expect(parsed.purchasedAt).not.toBe('2099-01-01');
  });

  test('the restaurant fixture types as restaurant', () => {
    const receipt = RECEIPTS.find((r) => r.name === 'restaurant')!;
    const parsed = parseReceiptResponse(receipt.recordedResponse, receipt.captureDate);
    expect(parsed.receiptType).toBe('restaurant');
  });

  test('arithmetic and non-food lines are classified, not dropped', () => {
    const receipt = RECEIPTS.find((r) => r.name === 'supermarketOne')!;
    const parsed = parseReceiptResponse(receipt.recordedResponse, receipt.captureDate);
    expect(parsed.lines.some((l) => l.kind === 'arithmetic')).toBe(true);
    expect(parsed.lines.some((l) => l.kind === 'non_food')).toBe(true);
    expect(parsed.lines.some((l) => l.kind === 'food')).toBe(true);
  });

  test('a multiple carries both the line total and the unit price', () => {
    const receipt = RECEIPTS.find((r) => r.name === 'multiQuantity')!;
    const parsed = parseReceiptResponse(receipt.recordedResponse, receipt.captureDate);
    const beans = parsed.lines.find((l) => l.text === 'CANNED BLACK BEANS');
    expect(beans?.qty).toBe(4);
    expect(beans?.unitPriceCents).toBe(129);
    expect(beans?.lineTotalCents).toBe(516);
  });

  test('a heavy non-food receipt still keeps its one food line', () => {
    const receipt = RECEIPTS.find((r) => r.name === 'heavyNonFood')!;
    const parsed = parseReceiptResponse(receipt.recordedResponse, receipt.captureDate);
    const foodLines = parsed.lines.filter((l) => l.kind === 'food');
    expect(foodLines.length).toBe(1);
    expect(foodLines[0]?.text).toContain('SRIRACHA');
  });

  test('a missing price is left unknown, not coerced to zero', () => {
    const raw = JSON.stringify({
      store: 'Test',
      purchased_at: '2026-01-01',
      receipt_type: 'grocery',
      total_cents: null,
      lines: [
        { text: 'MYSTERY ITEM', kind: 'food', qty: null, unit: null, line_total_cents: null, unit_price_cents: null },
      ],
    });
    const parsed = parseReceiptResponse(raw, '2026-01-01');
    expect(parsed.lines[0]?.lineTotalCents).toBeNull();
    expect(parsed.totalCents).toBeNull();
  });

  test('an unrecognised line kind defaults to food, not dropped', () => {
    const raw = JSON.stringify({
      store: null,
      purchased_at: null,
      receipt_type: 'grocery',
      total_cents: null,
      lines: [
        { text: 'AMBIGUOUS THING', kind: 'mystery', qty: null, unit: null, line_total_cents: null, unit_price_cents: null },
      ],
    });
    const parsed = parseReceiptResponse(raw, '2026-01-01');
    expect(parsed.lines[0]?.kind).toBe('food');
  });

  test('a malformed response throws rather than returning nonsense', () => {
    expect(() => parseReceiptResponse('Sorry, I cannot read this image.', '2026-01-01')).toThrow();
  });

  test('a response with no lines throws', () => {
    const raw = JSON.stringify({
      store: null,
      purchased_at: '2026-01-01',
      receipt_type: 'grocery',
      total_cents: null,
      lines: [],
    });
    expect(() => parseReceiptResponse(raw, '2026-01-01')).toThrow();
  });
});
