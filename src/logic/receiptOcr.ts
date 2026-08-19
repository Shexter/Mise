import type { OcrBoundingBox, OcrConfidenceBand, OcrLine, OcrModelErrorKind, OcrModelState, OcrModelStatus, OcrResult } from '@/types';

/**
 * Pure on-device-OCR logic: model-lifecycle transitions, line ordering,
 * confidence banding, and the fallback decision. No native bridge, no I/O —
 * see `src/logic/receiptService.ts` for where this plugs into the existing
 * receipt pipeline (design.md's "Existing pipeline inventory").
 */

export type OcrModelEvent =
  | { kind: 'download_requested' }
  | { kind: 'download_progressed'; progress: number }
  | { kind: 'download_completed'; sizeBytes: number }
  | { kind: 'download_failed'; errorKind: OcrModelErrorKind }
  | { kind: 'download_cancelled' }
  | { kind: 'remove_requested' }
  | { kind: 'availability_rechecked'; available: boolean };

/** The state-transition table alone, for callers that only need the next state. */
export function advanceOcrModelState(current: OcrModelState, event: OcrModelEvent): OcrModelState {
  switch (event.kind) {
    case 'availability_rechecked':
      if (!event.available) return 'unavailable';
      return current === 'unavailable' ? 'not_installed' : current;
    case 'download_requested':
      return current === 'not_installed' || current === 'failed' ? 'downloading' : current;
    case 'download_progressed':
      return current === 'downloading' ? 'downloading' : current;
    case 'download_completed':
      return current === 'downloading' ? 'installed' : current;
    case 'download_failed':
      return current === 'downloading' ? 'failed' : current;
    case 'download_cancelled':
      return current === 'downloading' ? 'not_installed' : current;
    case 'remove_requested':
      return current === 'installed' ? 'not_installed' : current;
    default:
      return current;
  }
}

/** Advances the full status (state plus progress/size/error bookkeeping) together, so callers never update one without the other. */
export function applyOcrModelEvent(status: OcrModelStatus, event: OcrModelEvent): OcrModelStatus {
  const state = advanceOcrModelState(status.state, event);
  switch (event.kind) {
    case 'download_requested':
      return { ...status, state, downloadProgress: state === 'downloading' ? 0 : status.downloadProgress, lastErrorKind: null };
    case 'download_progressed':
      return state === 'downloading' ? { ...status, state, downloadProgress: event.progress } : status;
    case 'download_completed':
      return { ...status, state, downloadProgress: null, sizeBytes: event.sizeBytes, lastErrorKind: null };
    case 'download_failed':
      return { ...status, state, downloadProgress: null, lastErrorKind: event.errorKind };
    case 'download_cancelled':
      return { ...status, state, downloadProgress: null };
    case 'remove_requested':
      return { ...status, state, downloadProgress: null, sizeBytes: null };
    case 'availability_rechecked':
      return { ...status, state, lastErrorKind: event.available ? status.lastErrorKind : 'services_unavailable' };
    default:
      return status;
  }
}

/** Reading order as the engine produced it, defensively re-sorted rather than trusted blindly. */
export function orderedOcrLines(result: Pick<OcrResult, 'lines'>): OcrLine[] {
  return [...result.lines].sort((a, b) => a.order - b.order);
}

const CONFIDENCE_BAND_THRESHOLDS: Record<OcrConfidenceBand, number> = {
  high: 0.85,
  medium: 0.6,
  low: 0,
};

/** Bands a raw 0-1 engine confidence for display — never used to silently drop a line, only to flag it in review. */
export function ocrConfidenceBand(confidence: number): OcrConfidenceBand {
  if (confidence >= CONFIDENCE_BAND_THRESHOLDS.high) return 'high';
  if (confidence >= CONFIDENCE_BAND_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/**
 * Whether the existing cloud extraction path should be used instead of a
 * local OCR result — because the model is not ready, or recognition
 * produced nothing usable. Never triggered by low per-line confidence:
 * low-confidence lines are surfaced for correction in review (task 3.4),
 * not silently discarded or bounced to the cloud.
 */
export function shouldFallbackToCloud(modelState: OcrModelState, result: OcrResult | null): boolean {
  if (modelState !== 'installed') return true;
  if (result === null) return true;
  return result.lines.length === 0;
}

/** Two boxes are the same printed line's wrapped continuation, not a separate line, when they overlap this much horizontally and sit close vertically. Grouping only ever merges a line with its own continuation — see decision 111 in design.md: visually similar but genuinely separate lines must never merge. */
export function isWrappedContinuation(
  first: OcrBoundingBox,
  second: OcrBoundingBox,
  options: { maxVerticalGapPx: number; minHorizontalOverlapRatio: number } = { maxVerticalGapPx: 8, minHorizontalOverlapRatio: 0.5 },
): boolean {
  const verticalGap = second.y - (first.y + first.height);
  if (verticalGap < 0 || verticalGap > options.maxVerticalGapPx) return false;
  const overlapStart = Math.max(first.x, second.x);
  const overlapEnd = Math.min(first.x + first.width, second.x + second.width);
  const overlap = Math.max(0, overlapEnd - overlapStart);
  const narrower = Math.min(first.width, second.width);
  if (narrower <= 0) return false;
  return overlap / narrower >= options.minHorizontalOverlapRatio;
}
