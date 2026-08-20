import type { ExtractedReceipt } from '@/api/receipt';
import { structureReceiptText } from '@/api/receiptText';
import { hasApiKey } from '@/api/keyStore';
import { getReceiptFrames, getReceiptOcrPreference, insertCapturedReceipt } from '@/db/queries';
import { localDateString } from '@/logic/dates';
import { normalise } from '@/logic/normalise';
import {
  orderedOcrLines,
  parseOcrLinesLocally,
  type OcrExtractedLine,
  type OcrExtractedReceipt,
} from '@/logic/receiptOcr';
import { attachOcrExtraction } from '@/logic/receiptService';
import type { OcrLine, ReceiptExtractionSource, ReceiptWithLines } from '@/types';

/**
 * The hybrid receipt-OCR flow: recognition always happens on this device,
 * and structuring happens wherever the user has asked for it.
 *
 * The order of the checks below is the privacy promise in code. Local
 * parsing is the default and the floor — the cloud text pass is only ever
 * reached when the user has switched it on *and* a key exists, and any
 * failure of it lands back on local parsing rather than on the user. A
 * capture never fails because a network call did.
 *
 * The photograph is not part of this path at all. Only the recognized text
 * can ever be sent, and only on the `cloud_text` branch.
 */

export interface OcrExtractionOutcome {
  extracted: OcrExtractedReceipt;
  /** `local_ocr` sent nothing; `cloud_text` sent the recognized text only. */
  source: ReceiptExtractionSource;
  /** True when the cloud pass was attempted, failed, and local parsing stood in. */
  fellBackToLocal: boolean;
}

/**
 * Structures already-recognized lines, choosing the path the user's own
 * settings allow. Never throws for an extraction reason: the local parse is
 * always available, because it needs nothing but the text already in hand.
 */
export async function extractFromOcrLines(
  lines: readonly OcrLine[],
  captureDate: string = localDateString(),
  signal?: AbortSignal,
): Promise<OcrExtractionOutcome> {
  const ordered = orderedOcrLines({ lines });
  const local = parseOcrLinesLocally(ordered, captureDate);

  if (!(await cloudTextAllowed())) {
    return { extracted: local, source: 'local_ocr', fellBackToLocal: false };
  }

  try {
    const structured = await structureReceiptText(
      ordered.map((line) => line.text),
      captureDate,
      signal,
    );
    return {
      extracted: withOcrConfidence(structured, ordered),
      source: 'cloud_text',
      fellBackToLocal: false,
    };
  } catch {
    // Offline, rate-limited, malformed, key revoked — every one of these is
    // the same thing from here: the receipt still has to be reviewable.
    return { extracted: local, source: 'local_ocr', fellBackToLocal: true };
  }
}

/**
 * Whether the text-only cloud pass may run at all. Both halves are
 * required, and the preference alone is not enough: a key that has since
 * been removed silently returns the user to the local path.
 */
export async function cloudTextAllowed(): Promise<boolean> {
  const preference = await getReceiptOcrPreference();
  if (!preference.cloudTextEnhancement) return false;
  return hasApiKey();
}

/**
 * Captures a receipt whose text was read on this device, structures it, and
 * hands the result to the existing review flow — the same draft, the same
 * resolution, the same accept gate as any other receipt.
 */
export async function captureReceiptFromOcrLines(
  lines: readonly OcrLine[],
  imageUri: string,
  captureDate: string = localDateString(),
): Promise<{ receipt: ReceiptWithLines; outcome: OcrExtractionOutcome }> {
  const outcome = await extractFromOcrLines(lines, captureDate);
  const receipt = await insertCapturedReceipt(imageUri, captureDate);
  const [frame] = await getReceiptFrames(receipt.id);
  if (!frame || outcome.extracted.lines.length === 0) return { receipt, outcome };
  const stored = await attachOcrExtraction(
    receipt.id,
    frame.id,
    outcome.extracted,
    outcome.source,
  );
  return { receipt: stored, outcome };
}

/**
 * Re-attaches the recognition confidence the cloud pass could not know
 * about, by exact normalized text. A restructured or corrected line simply
 * carries no confidence rather than borrowing a neighbour's — a badge on
 * the wrong line is worse than no badge.
 */
function withOcrConfidence(
  structured: ExtractedReceipt,
  ordered: readonly OcrLine[],
): OcrExtractedReceipt {
  const byText = new Map<string, number>();
  for (const line of ordered) {
    const key = normalise(line.text);
    if (key.length > 0 && !byText.has(key)) byText.set(key, line.confidence);
  }
  const lines: OcrExtractedLine[] = structured.lines.map((line) => ({
    ...line,
    ocrConfidence: byText.get(normalise(line.text)) ?? null,
  }));
  return { ...structured, lines };
}
