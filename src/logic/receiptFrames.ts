import { normalise } from '@/logic/normalise';

/** The extraction fields retained for one photographed portion of a receipt. */
export interface ReceiptFrameLineInput {
  rawText: string;
  kind: string;
  qty: number | null;
  unit: string | null;
  quantityKind: string | null;
  lineTotalCents: number | null;
  unitPriceCents: number | null;
  appliesToText: string | null;
  /** The on-device engine's recognition confidence, carried through the merge untouched. */
  ocrConfidence?: number | null;
}

export interface ExtractedFrameLines {
  frameId: string;
  lines: ReceiptFrameLineInput[];
}

const EDGE_WINDOW = 8;

function sameLine(left: ReceiptFrameLineInput, right: ReceiptFrameLineInput): boolean {
  return normalise(left.rawText) === normalise(right.rawText)
    && left.lineTotalCents === right.lineTotalCents
    && left.unitPriceCents === right.unitPriceCents;
}

/**
 * Combines ordered frame output without erasing a legitimate repeat in a
 * basket. Only a new frame's leading edge can overlap the immediately prior
 * frame's trailing edge, so duplicate-looking rows elsewhere remain intact.
 */
export function mergeReceiptFrameLines(frames: ExtractedFrameLines[]): ReceiptFrameLineInput[] {
  const merged: ReceiptFrameLineInput[] = [];
  let previous: ReceiptFrameLineInput[] = [];

  for (const frame of frames) {
    const previousTail = previous.slice(-EDGE_WINDOW);
    const maxOverlap = Math.min(previousTail.length, frame.lines.length, EDGE_WINDOW);
    let overlap = 0;
    for (let count = 1; count <= maxOverlap; count += 1) {
      const previousEdge = previousTail.slice(-count);
      const nextEdge = frame.lines.slice(0, count);
      if (previousEdge.every((line, index) => sameLine(line, nextEdge[index]!))) overlap = count;
    }
    merged.push(...frame.lines.slice(overlap));
    previous = frame.lines;
  }

  return merged;
}
