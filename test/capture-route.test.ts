import { describe, expect, test } from 'vitest';

import { routeCapture, type BarcodeResult, type CaptureExtraction } from '../src/logic/captureRoute';

const resolved: BarcodeResult = { detected: true, productId: 'product-1' };
const unresolved: BarcodeResult = { detected: true, productId: null };
const absent: BarcodeResult = { detected: false, productId: null };

describe('routeCapture', () => {
  test('short-circuits only a resolved product barcode', () => {
    expect(routeCapture(resolved, { kind: 'receipt' })).toBe('product');
  });

  test.each([
    ['receipt', 'receipt'],
    ['items', 'items'],
    ['unclear', 'ask'],
    ['nothing', 'nothing'],
  ] as const)('falls through an unresolved barcode to %s', (kind, destination) => {
    expect(routeCapture(unresolved, { kind } as CaptureExtraction)).toBe(destination);
    expect(routeCapture(absent, { kind } as CaptureExtraction)).toBe(destination);
  });
});
