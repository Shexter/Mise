import { extractCapture } from '@/api/capture';
import { VisionError } from '@/api/errors';
import {
  getPendingCapture,
  recordPendingCaptureAttempt,
} from '@/db/queries';
import { resolveCapturedItems, type CaptureItemProposal } from '@/logic/captureItems';
import { captureExtractedReceipt } from '@/logic/receiptService';
import { photoBase64 } from '@/media/photos';
import type { PendingCapture, ReceiptWithLines } from '@/types';

/** Three unsuccessful interpretations make the capture visibly failed. */
export const MAX_PENDING_CAPTURE_RETRIES = 3;

export type PendingCaptureResult =
  | { kind: 'items'; capture: PendingCapture; proposals: CaptureItemProposal[] }
  | { kind: 'receipt'; capture: PendingCapture; receipt: ReceiptWithLines }
  | { kind: 'waiting_for_key'; capture: PendingCapture }
  | { kind: 'retry_later'; capture: PendingCapture; errorKind: string }
  | { kind: 'failed'; capture: PendingCapture; errorKind: string }
  | { kind: 'unusable'; capture: PendingCapture; errorKind: 'unclear' | 'nothing' };

/**
 * Interprets one retained photo and returns a review-ready result. It never
 * removes the queue row: the caller does that only after routing to review.
 */
export async function retryPendingCapture(id: string): Promise<PendingCaptureResult | null> {
  const capture = await getPendingCapture(id);
  if (!capture) return null;

  try {
    const extraction = await extractCapture(await photoBase64(capture.imageUri));
    const captureDate = capture.createdAt.slice(0, 10);
    if (extraction.kind === 'items') {
      return {
        kind: 'items',
        capture,
        proposals: await resolveCapturedItems(extraction.items, captureDate),
      };
    }
    if (extraction.kind === 'receipt') {
      return {
        kind: 'receipt',
        capture,
        receipt: await captureExtractedReceipt(extraction.receipt, capture.imageUri, captureDate),
      };
    }
    return recordUnusableCapture(capture, extraction.kind);
  } catch (error) {
    if (error instanceof VisionError && error.kind === 'no_key') {
      return { kind: 'waiting_for_key', capture };
    }
    const errorKind = error instanceof VisionError ? error.kind : 'unknown';
    const failed = capture.retryCount + 1 >= MAX_PENDING_CAPTURE_RETRIES;
    await recordPendingCaptureAttempt(capture.id, errorKind, failed);
    return failed
      ? { kind: 'failed', capture, errorKind }
      : { kind: 'retry_later', capture, errorKind };
  }
}

async function recordUnusableCapture(
  capture: PendingCapture,
  errorKind: 'unclear' | 'nothing',
): Promise<PendingCaptureResult> {
  const failed = capture.retryCount + 1 >= MAX_PENDING_CAPTURE_RETRIES;
  await recordPendingCaptureAttempt(capture.id, errorKind, failed);
  return { kind: 'unusable', capture, errorKind };
}
