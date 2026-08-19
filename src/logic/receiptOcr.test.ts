import { describe, expect, test } from 'vitest';

import {
  advanceOcrModelState,
  applyOcrModelEvent,
  isWrappedContinuation,
  ocrConfidenceBand,
  orderedOcrLines,
  shouldFallbackToCloud,
  type OcrModelEvent,
} from '@/logic/receiptOcr';
import type { OcrBoundingBox, OcrLine, OcrModelState, OcrModelStatus, OcrResult } from '@/types';

const status = (overrides: Partial<OcrModelStatus> = {}): OcrModelStatus => ({
  engine: 'ml_kit', state: 'not_installed', script: 'latin',
  downloadProgress: null, sizeBytes: null, lastErrorKind: null,
  ...overrides,
});

const box = (overrides: Partial<OcrBoundingBox> = {}): OcrBoundingBox => ({
  x: 0, y: 0, width: 100, height: 20, ...overrides,
});

const line = (overrides: Partial<OcrLine> = {}): OcrLine => ({
  text: 'line', order: 0, boundingBox: box(), confidence: 0.9, ...overrides,
});

describe('OCR model state transitions', () => {
  test('not_installed -> downloading -> installed on a successful download', () => {
    let state: OcrModelState = 'not_installed';
    state = advanceOcrModelState(state, { kind: 'download_requested' });
    expect(state).toBe('downloading');
    state = advanceOcrModelState(state, { kind: 'download_progressed', progress: 0.5 });
    expect(state).toBe('downloading');
    state = advanceOcrModelState(state, { kind: 'download_completed', sizeBytes: 1024 });
    expect(state).toBe('installed');
  });

  test('a failed download can be retried from failed, not from installed', () => {
    expect(advanceOcrModelState('downloading', { kind: 'download_failed', errorKind: 'network' })).toBe('failed');
    expect(advanceOcrModelState('failed', { kind: 'download_requested' })).toBe('downloading');
    expect(advanceOcrModelState('installed', { kind: 'download_requested' })).toBe('installed');
  });

  test('cancelling a download returns to not_installed, not failed', () => {
    expect(advanceOcrModelState('downloading', { kind: 'download_cancelled' })).toBe('not_installed');
  });

  test('removing only applies to an installed model', () => {
    expect(advanceOcrModelState('installed', { kind: 'remove_requested' })).toBe('not_installed');
    expect(advanceOcrModelState('downloading', { kind: 'remove_requested' })).toBe('downloading');
    expect(advanceOcrModelState('not_installed', { kind: 'remove_requested' })).toBe('not_installed');
  });

  test('an unavailable platform overrides any state, and can recover once rechecked available', () => {
    expect(advanceOcrModelState('downloading', { kind: 'availability_rechecked', available: false })).toBe('unavailable');
    expect(advanceOcrModelState('installed', { kind: 'availability_rechecked', available: false })).toBe('unavailable');
    expect(advanceOcrModelState('unavailable', { kind: 'availability_rechecked', available: true })).toBe('not_installed');
  });

  test('rechecking availability as true on a non-unavailable state is a no-op', () => {
    expect(advanceOcrModelState('installed', { kind: 'availability_rechecked', available: true })).toBe('installed');
  });
});

describe('OCR model status updates', () => {
  test('starting a download clears any prior error and zeroes progress', () => {
    const next = applyOcrModelEvent(status({ state: 'failed', lastErrorKind: 'network' }), { kind: 'download_requested' });
    expect(next).toMatchObject({ state: 'downloading', downloadProgress: 0, lastErrorKind: null });
  });

  test('progress only advances while downloading', () => {
    const downloading = status({ state: 'downloading', downloadProgress: 0.2 });
    expect(applyOcrModelEvent(downloading, { kind: 'download_progressed', progress: 0.6 }).downloadProgress).toBe(0.6);
    const installed = status({ state: 'installed' });
    expect(applyOcrModelEvent(installed, { kind: 'download_progressed', progress: 0.6 })).toBe(installed);
  });

  test('completion records size and clears progress/error', () => {
    const next = applyOcrModelEvent(status({ state: 'downloading', downloadProgress: 0.9 }), { kind: 'download_completed', sizeBytes: 50_000_000 });
    expect(next).toMatchObject({ state: 'installed', downloadProgress: null, sizeBytes: 50_000_000, lastErrorKind: null });
  });

  test('failure records the error kind and clears progress', () => {
    const next = applyOcrModelEvent(status({ state: 'downloading', downloadProgress: 0.4 }), { kind: 'download_failed', errorKind: 'storage' });
    expect(next).toMatchObject({ state: 'failed', downloadProgress: null, lastErrorKind: 'storage' });
  });

  test('removal clears size', () => {
    const next = applyOcrModelEvent(status({ state: 'installed', sizeBytes: 50_000_000 }), { kind: 'remove_requested' });
    expect(next).toMatchObject({ state: 'not_installed', sizeBytes: null });
  });

  test('an unavailable recheck records services_unavailable as the error kind', () => {
    const next = applyOcrModelEvent(status({ state: 'installed' }), { kind: 'availability_rechecked', available: false });
    expect(next).toMatchObject({ state: 'unavailable', lastErrorKind: 'services_unavailable' });
  });
});

describe('OCR line ordering and confidence', () => {
  test('lines are sorted by order regardless of input array order', () => {
    const result: Pick<OcrResult, 'lines'> = { lines: [line({ text: 'c', order: 2 }), line({ text: 'a', order: 0 }), line({ text: 'b', order: 1 })] };
    expect(orderedOcrLines(result).map((entry) => entry.text)).toEqual(['a', 'b', 'c']);
  });

  test('confidence bands', () => {
    expect(ocrConfidenceBand(0.95)).toBe('high');
    expect(ocrConfidenceBand(0.85)).toBe('high');
    expect(ocrConfidenceBand(0.84)).toBe('medium');
    expect(ocrConfidenceBand(0.6)).toBe('medium');
    expect(ocrConfidenceBand(0.59)).toBe('low');
    expect(ocrConfidenceBand(0)).toBe('low');
  });
});

describe('cloud fallback decision', () => {
  const result = (lines: OcrLine[]): OcrResult => ({ engine: 'ml_kit', script: 'latin', lines, recognizedAt: '2026-01-01T00:00:00.000Z' });

  test('falls back when the model is not installed, regardless of any result', () => {
    expect(shouldFallbackToCloud('not_installed', null)).toBe(true);
    expect(shouldFallbackToCloud('downloading', result([line()]))).toBe(true);
    expect(shouldFallbackToCloud('failed', result([line()]))).toBe(true);
    expect(shouldFallbackToCloud('unavailable', result([line()]))).toBe(true);
  });

  test('falls back when installed but no result or an empty result', () => {
    expect(shouldFallbackToCloud('installed', null)).toBe(true);
    expect(shouldFallbackToCloud('installed', result([]))).toBe(true);
  });

  test('does not fall back once installed with at least one recognized line', () => {
    expect(shouldFallbackToCloud('installed', result([line()]))).toBe(false);
  });

  test('low per-line confidence alone never triggers fallback — it is a review concern, not a wholesale bounce', () => {
    expect(shouldFallbackToCloud('installed', result([line({ confidence: 0.02 })]))).toBe(false);
  });
});

describe('wrapped-line grouping', () => {
  test('a line directly below with strong horizontal overlap and a small gap is a continuation', () => {
    const first = box({ x: 0, y: 0, width: 200, height: 20 });
    const second = box({ x: 10, y: 22, width: 180, height: 20 });
    expect(isWrappedContinuation(first, second)).toBe(true);
  });

  test('a line far below is not a continuation', () => {
    const first = box({ x: 0, y: 0, width: 200, height: 20 });
    const second = box({ x: 10, y: 60, width: 180, height: 20 });
    expect(isWrappedContinuation(first, second)).toBe(false);
  });

  test('a line beside (not below) is not a continuation, even with no vertical gap', () => {
    const first = box({ x: 0, y: 0, width: 100, height: 20 });
    const second = box({ x: 300, y: 5, width: 100, height: 20 });
    expect(isWrappedContinuation(first, second)).toBe(false);
  });

  test('two genuinely separate lines that happen to sit close are not merged without sufficient horizontal overlap — decision 111', () => {
    const first = box({ x: 0, y: 0, width: 50, height: 20 });
    const second = box({ x: 60, y: 5, width: 50, height: 20 });
    expect(isWrappedContinuation(first, second)).toBe(false);
  });
});
