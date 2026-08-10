/** Inputs available after the camera's free barcode pass and image extraction. */
export interface BarcodeResult {
  detected: boolean;
  /** A barcode wins only after a product lookup resolved it. */
  productId: string | null;
}

export type CaptureExtraction =
  | { kind: 'receipt' }
  | { kind: 'items' }
  | { kind: 'unclear' }
  | { kind: 'nothing' };

export type CaptureDestination = 'product' | 'receipt' | 'items' | 'ask' | 'nothing';

/** Pure cost-ordered routing. Detection without resolution always falls through. */
export function routeCapture(
  barcode: BarcodeResult,
  extraction: CaptureExtraction,
): CaptureDestination {
  if (barcode.productId !== null) return 'product';
  switch (extraction.kind) {
    case 'receipt': return 'receipt';
    case 'items': return 'items';
    case 'unclear': return 'ask';
    case 'nothing': return 'nothing';
  }
}
