import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/api/capture', () => ({ extractCapture: vi.fn() }));
vi.mock('@/logic/captureItems', () => ({ resolveCapturedItems: vi.fn() }));
vi.mock('@/logic/receiptService', () => ({ captureExtractedReceipt: vi.fn() }));

import { extractCapture } from '@/api/capture';
import { VisionError } from '@/api/errors';
import { getPendingCapture, insertPendingCapture, loadSeedData } from '@/db/queries';
import { resolveCapturedItems } from '@/logic/captureItems';
import { MAX_PENDING_CAPTURE_RETRIES, retryPendingCapture } from '@/logic/pendingCaptureService';
import { captureExtractedReceipt } from '@/logic/receiptService';
import { openTestDatabase } from './stubs/db';

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
  vi.mocked(extractCapture).mockReset();
  vi.mocked(resolveCapturedItems).mockReset();
  vi.mocked(captureExtractedReceipt).mockReset();
});

describe('pending capture retry', () => {
  test('returns grocery proposals for review without deleting the queue row', async () => {
    const capture = await insertPendingCapture('file://capture.jpg');
    vi.mocked(extractCapture).mockResolvedValue({
      kind: 'items', items: [{ name: 'Rice', quantity: 1, unit: 'g' }],
    });
    vi.mocked(resolveCapturedItems).mockResolvedValue([]);

    await expect(retryPendingCapture(capture.id)).resolves.toMatchObject({ kind: 'items', capture: { id: capture.id } });
    expect(await getPendingCapture(capture.id)).not.toBeNull();
  });

  test('returns the persisted receipt draft for review without deleting the queue row', async () => {
    const capture = await insertPendingCapture('file://receipt.jpg');
    vi.mocked(extractCapture).mockResolvedValue({
      kind: 'receipt', receipt: { store: null, purchasedAt: '2026-08-09', receiptType: 'grocery', subtotalCents: null, taxCents: null, totalCents: null, lines: [] },
    });
    vi.mocked(captureExtractedReceipt).mockResolvedValue({ id: 'receipt-1' } as never);

    await expect(retryPendingCapture(capture.id)).resolves.toMatchObject({ kind: 'receipt', receipt: { id: 'receipt-1' } });
    expect(await getPendingCapture(capture.id)).not.toBeNull();
  });

  test('marks a repeatedly failing capture as failed', async () => {
    const capture = await insertPendingCapture('file://capture.jpg');
    vi.mocked(extractCapture).mockRejectedValue(new VisionError('network', 'offline'));

    for (let attempt = 1; attempt < MAX_PENDING_CAPTURE_RETRIES; attempt += 1) {
      await expect(retryPendingCapture(capture.id)).resolves.toMatchObject({ kind: 'retry_later' });
    }
    await expect(retryPendingCapture(capture.id)).resolves.toMatchObject({ kind: 'failed' });
    await expect(getPendingCapture(capture.id)).resolves.toMatchObject({ status: 'failed', retryCount: MAX_PENDING_CAPTURE_RETRIES });
  });
});
