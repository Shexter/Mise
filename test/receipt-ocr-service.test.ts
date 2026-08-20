import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/api/receiptText', () => ({ structureReceiptText: vi.fn() }));

import { setApiKey, clearApiKey } from '@/api/keyStore';
import { VisionError } from '@/api/errors';
import { structureReceiptText } from '@/api/receiptText';
import {
  getReceipt,
  getReceiptFrames,
  loadSeedData,
  saveReceiptOcrPreference,
} from '@/db/queries';
import { parseOcrLinesLocally } from '@/logic/receiptOcr';
import {
  captureReceiptFromOcrLines,
  cloudTextAllowed,
  extractFromOcrLines,
} from '@/logic/receiptOcrService';
import type { OcrLine } from '@/types';
import { openTestDatabase } from '../test/stubs/db';

/**
 * The hybrid flow's three branches and its one guarantee.
 *
 * The guarantee is that a capture never fails for an extraction reason:
 * whatever the network, the key, or the preference is doing, the recognized
 * text is already on this device and can always be structured here. The
 * branches are which of the two structurers ran, and what the receipt
 * review flow was handed afterwards.
 */

const KEY = 'sk-ant-000000000000000000000000';

function ocrLine(text: string, order: number, confidence = 0.95): OcrLine {
  return {
    text,
    order,
    confidence,
    boundingBox: { x: 0, y: order * 20, width: 200, height: 16 },
  };
}

const LINES: OcrLine[] = [
  ocrLine('FRESH MART', 0),
  ocrLine('2026-06-01', 1),
  ocrLine('JASMINE RICE 1KG 5.49', 2),
  ocrLine('BANANAS 0.834 kg @ $3.90 3.25', 3, 0.42),
  ocrLine('CARRIER BAG 0.15', 4),
  ocrLine('SUBTOTAL 8.89', 5),
  ocrLine('TOTAL 8.89', 6),
];

const CLOUD_JSON = JSON.stringify({
  store: 'Fresh Mart',
  purchased_at: '2026-06-01',
  receipt_type: 'grocery',
  subtotal_cents: 889,
  tax_cents: null,
  total_cents: 889,
  lines: [
    { text: 'JASMINE RICE 1KG', kind: 'food', qty: 1000, unit: 'g', quantity_kind: 'measure', line_total_cents: 549, unit_price_cents: null, applies_to_text: null },
    { text: 'BANANAS 0.834 kg @ $3.90 3.25', kind: 'food', qty: 834, unit: 'g', quantity_kind: 'measure', line_total_cents: 325, unit_price_cents: 390, applies_to_text: null },
    { text: 'CARRIER BAG', kind: 'non_food', qty: null, unit: null, quantity_kind: null, line_total_cents: 15, unit_price_cents: null, applies_to_text: null },
  ],
});

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
  await clearApiKey();
  vi.mocked(structureReceiptText).mockReset();
});

describe('local parsing of recognized lines', () => {
  test('reads the header, classifies each line, and keeps recognition confidence', () => {
    const parsed = parseOcrLinesLocally(LINES, '2026-06-02');

    expect(parsed.store).toBe('FRESH MART');
    expect(parsed.purchasedAt).toBe('2026-06-01');
    expect(parsed.subtotalCents).toBe(889);
    expect(parsed.totalCents).toBe(889);

    const kinds = parsed.lines.map((line) => [line.text.split(' ')[0], line.kind]);
    expect(kinds).toContainEqual(['JASMINE', 'food']);
    expect(kinds).toContainEqual(['CARRIER', 'non_food']);
    expect(kinds).toContainEqual(['SUBTOTAL', 'arithmetic']);

    const bananas = parsed.lines.find((line) => line.text.startsWith('BANANAS'));
    expect(bananas?.qty).toBe(834);
    expect(bananas?.unit).toBe('g');
    expect(bananas?.quantityKind).toBe('measure');
    expect(bananas?.lineTotalCents).toBe(325);
    expect(bananas?.unitPriceCents).toBe(390);
    expect(bananas?.ocrConfidence).toBe(0.42);
  });

  test('an unreadable price stays unknown rather than becoming free', () => {
    const parsed = parseOcrLinesLocally([ocrLine('MILK 2L', 0)], '2026-06-02');
    expect(parsed.lines[0]?.lineTotalCents).toBeNull();
  });
});

describe('choosing a path', () => {
  test('the cloud text pass is refused when the preference is off, key or not', async () => {
    await setApiKey(KEY);
    await saveReceiptOcrPreference({ cloudTextEnhancement: false });

    expect(await cloudTextAllowed()).toBe(false);
    const outcome = await extractFromOcrLines(LINES, '2026-06-02');

    expect(structureReceiptText).not.toHaveBeenCalled();
    expect(outcome.source).toBe('local_ocr');
    expect(outcome.fellBackToLocal).toBe(false);
  });

  test('the cloud text pass is refused when the preference is on but no key is set', async () => {
    await saveReceiptOcrPreference({ cloudTextEnhancement: true });

    expect(await cloudTextAllowed()).toBe(false);
    const outcome = await extractFromOcrLines(LINES, '2026-06-02');

    expect(structureReceiptText).not.toHaveBeenCalled();
    expect(outcome.source).toBe('local_ocr');
  });

  test('with a key and the preference on, the recognized text — and only the text — is sent', async () => {
    await setApiKey(KEY);
    await saveReceiptOcrPreference({ cloudTextEnhancement: true });
    vi.mocked(structureReceiptText).mockResolvedValue(
      (await import('@/api/receipt')).parseReceiptResponse(CLOUD_JSON, '2026-06-02'),
    );

    const outcome = await extractFromOcrLines(LINES, '2026-06-02');

    expect(outcome.source).toBe('cloud_text');
    expect(outcome.fellBackToLocal).toBe(false);
    expect(outcome.extracted.store).toBe('Fresh Mart');
    const sent = vi.mocked(structureReceiptText).mock.calls[0]?.[0];
    expect(sent).toEqual(LINES.map((line) => line.text));
  });

  test('a line the cloud returned verbatim keeps its recognition confidence; a rewritten one carries none', async () => {
    await setApiKey(KEY);
    await saveReceiptOcrPreference({ cloudTextEnhancement: true });
    vi.mocked(structureReceiptText).mockResolvedValue(
      (await import('@/api/receipt')).parseReceiptResponse(CLOUD_JSON, '2026-06-02'),
    );

    const outcome = await extractFromOcrLines(LINES, '2026-06-02');
    const bananas = outcome.extracted.lines.find((line) => line.text.startsWith('BANANAS'));
    const rice = outcome.extracted.lines.find((line) => line.text.startsWith('JASMINE'));

    expect(bananas?.ocrConfidence).toBe(0.42);
    expect(rice?.ocrConfidence).toBeNull();
  });
});

describe('graceful degradation', () => {
  test('a network failure falls back to local parsing instead of failing the capture', async () => {
    await setApiKey(KEY);
    await saveReceiptOcrPreference({ cloudTextEnhancement: true });
    vi.mocked(structureReceiptText).mockRejectedValue(new TypeError('Network request failed'));

    const outcome = await extractFromOcrLines(LINES, '2026-06-02');

    expect(structureReceiptText).toHaveBeenCalledOnce();
    expect(outcome.source).toBe('local_ocr');
    expect(outcome.fellBackToLocal).toBe(true);
    expect(outcome.extracted.lines.length).toBeGreaterThan(0);
  });

  test('a malformed cloud response falls back the same way', async () => {
    await setApiKey(KEY);
    await saveReceiptOcrPreference({ cloudTextEnhancement: true });
    vi.mocked(structureReceiptText).mockRejectedValue(
      new VisionError('malformed', 'The receipt could not be read.'),
    );

    const outcome = await extractFromOcrLines(LINES, '2026-06-02');

    expect(outcome.source).toBe('local_ocr');
    expect(outcome.fellBackToLocal).toBe(true);
  });
});

describe('hydrating the review state', () => {
  test('an offline capture lands in review with lines, provenance, and confidences', async () => {
    await saveReceiptOcrPreference({ cloudTextEnhancement: false });

    const { receipt, outcome } = await captureReceiptFromOcrLines(LINES, 'file://receipt.jpg', '2026-06-02');

    expect(outcome.source).toBe('local_ocr');
    const stored = await getReceipt(receipt.id);
    expect(stored?.lines.length).toBeGreaterThan(0);
    expect(stored?.store).toBe('FRESH MART');
    expect(stored?.purchasedAt).toBe('2026-06-01');

    const bananas = stored?.lines.find((line) => line.rawText.startsWith('BANANAS'));
    expect(bananas?.ocrConfidence).toBeCloseTo(0.42);

    const [frame] = await getReceiptFrames(receipt.id);
    expect(frame?.status).toBe('extracted');
    expect(frame?.extractionSource).toBe('local_ocr');
  });

  test('a cloud-enhanced capture is stored with cloud_text provenance', async () => {
    await setApiKey(KEY);
    await saveReceiptOcrPreference({ cloudTextEnhancement: true });
    vi.mocked(structureReceiptText).mockResolvedValue(
      (await import('@/api/receipt')).parseReceiptResponse(CLOUD_JSON, '2026-06-02'),
    );

    const { receipt } = await captureReceiptFromOcrLines(LINES, 'file://receipt.jpg', '2026-06-02');

    const [frame] = await getReceiptFrames(receipt.id);
    expect(frame?.extractionSource).toBe('cloud_text');
    const stored = await getReceipt(receipt.id);
    expect(stored?.store).toBe('Fresh Mart');
    expect(stored?.lines.map((line) => line.rawText)).toContain('CARRIER BAG');
  });

  test('a receipt whose recognition produced nothing is retained for review rather than lost', async () => {
    const { receipt, outcome } = await captureReceiptFromOcrLines([], 'file://blank.jpg', '2026-06-02');

    expect(outcome.extracted.lines).toEqual([]);
    const stored = await getReceipt(receipt.id);
    expect(stored).not.toBeNull();
    expect(stored?.lines).toEqual([]);
  });
});
