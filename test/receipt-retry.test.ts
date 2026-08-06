import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/api/receipt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/receipt')>();
  return { ...actual, extractReceipt: vi.fn() };
});

import { extractReceipt } from '@/api/receipt';
import { getReceipt, insertCapturedReceipt, loadSeedData } from '@/db/queries';
import {
  needsExtraction,
  pendingReceipts,
  retryAllPending,
  retryExtraction,
} from '@/logic/receiptService';
import { openTestDatabase } from '../test/stubs/db';

/**
 * Task 7.3: a receipt captured with no key or connection is retained and
 * completes extraction later, reading the stored photo back rather than
 * asking the user to re-photograph. `extractReceipt` is mocked here so the
 * "connection returns" half of the story is testable without a real key.
 */

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
  vi.mocked(extractReceipt).mockReset();
});

describe('retrying extraction', () => {
  test('a receipt with no lines yet is listed as pending', async () => {
    const receipt = await insertCapturedReceipt('file://receipt.jpg', '2026-06-01');
    const pending = await pendingReceipts();
    expect(pending.map((r) => r.id)).toEqual([receipt.id]);
  });

  test('a failed retry leaves the receipt pending, still with no lines', async () => {
    const receipt = await insertCapturedReceipt('file://receipt.jpg', '2026-06-01');
    vi.mocked(extractReceipt).mockRejectedValue(new Error('still offline'));

    const result = await retryExtraction(receipt.id);
    expect(result).not.toBeNull();
    expect(needsExtraction(result!)).toBe(true);
    expect((await pendingReceipts()).length).toBe(1);
  });

  test('a successful retry attaches lines without asking for a new photo', async () => {
    const receipt = await insertCapturedReceipt('file://receipt.jpg', '2026-06-01');
    vi.mocked(extractReceipt).mockResolvedValue({
      store: 'Test Grocer',
      purchasedAt: '2026-06-01',
      receiptType: 'grocery',
      subtotalCents: 389,
      taxCents: 0,
      totalCents: 500,
      lines: [
        { text: 'SOY SAUCE', kind: 'food', qty: 500, unit: 'ml', quantityKind: 'measure', lineTotalCents: 389, unitPriceCents: null, appliesToText: null },
      ],
    });

    const result = await retryExtraction(receipt.id);
    expect(result).not.toBeNull();
    expect(needsExtraction(result!)).toBe(false);
    expect(result!.lines.length).toBe(1);
    // extractReceipt was called with the base64 read back from the file,
    // not something the caller had to supply fresh.
    expect(extractReceipt).toHaveBeenCalledWith('stub-base64', '2026-06-01');

    const stored = await getReceipt(receipt.id);
    expect(stored?.store).toBe('Test Grocer');
  });

  test('retryAllPending completes every waiting receipt it can', async () => {
    const a = await insertCapturedReceipt('file://a.jpg', '2026-06-01');
    const b = await insertCapturedReceipt('file://b.jpg', '2026-06-02');
    vi.mocked(extractReceipt).mockResolvedValue({
      store: null,
      purchasedAt: '2026-06-01',
      receiptType: 'grocery',
      subtotalCents: null,
      taxCents: null,
      totalCents: null,
      lines: [
        { text: 'RICE', kind: 'food', qty: 908, unit: 'g', quantityKind: 'measure', lineTotalCents: 699, unitPriceCents: null, appliesToText: null },
      ],
    });

    const completed = await retryAllPending();
    expect(completed).toBe(2);
    expect(await pendingReceipts()).toEqual([]);
    expect(needsExtraction((await getReceipt(a.id))!)).toBe(false);
    expect(needsExtraction((await getReceipt(b.id))!)).toBe(false);
  });

  test('retrying an already-extracted receipt is a no-op', async () => {
    const receipt = await insertCapturedReceipt('file://receipt.jpg', '2026-06-01');
    vi.mocked(extractReceipt).mockResolvedValue({
      store: null,
      purchasedAt: '2026-06-01',
      receiptType: 'grocery',
      subtotalCents: null,
      taxCents: null,
      totalCents: null,
      lines: [
        { text: 'RICE', kind: 'food', qty: 908, unit: 'g', quantityKind: 'measure', lineTotalCents: 699, unitPriceCents: null, appliesToText: null },
      ],
    });
    await retryExtraction(receipt.id);
    expect(extractReceipt).toHaveBeenCalledTimes(1);

    await retryExtraction(receipt.id);
    // Already has lines — retryExtraction returns early, no second call.
    expect(extractReceipt).toHaveBeenCalledTimes(1);
  });
});
