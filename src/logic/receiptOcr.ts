import type { ExtractedLine, ExtractedReceipt } from '@/api/receipt';
import type { ReceiptExtracted, ReceiptExtractedItem } from '@/api/receiptTextPrompt';
import type { MeasureUnit, QuantityKind, ReceiptLineKind, OcrBoundingBox, OcrConfidenceBand, OcrLine, OcrModelErrorKind, OcrModelState, OcrModelStatus, OcrResult } from '@/types';

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

/* -------------------------------------------------------------------------- */
/* Local structuring of recognised lines                                       */
/* -------------------------------------------------------------------------- */

/**
 * An extracted line that also remembers how well the engine read it. The
 * two confidences stay separate on purpose: `ocrConfidence` says how sure
 * the recognizer is of the *characters*, and says nothing at all about
 * whether the resulting text is the right ingredient.
 */
export interface OcrExtractedLine extends ExtractedLine {
  ocrConfidence: number | null;
}

export interface OcrExtractedReceipt extends Omit<ExtractedReceipt, 'lines'> {
  lines: OcrExtractedLine[];
}

/** Words that mark a line as receipt arithmetic rather than a purchase. */
const ARITHMETIC_PATTERNS = [
  /\bsub[\s-]?total\b/, /\btotal\b/, /\bbalance\b/, /\bamount\s+due\b/,
  /\bchange\b/, /\bcash\b/, /\bcard\b/, /\bvisa\b/, /\bmastercard\b/, /\beftpos\b/,
  /\bdebit\b/, /\bcredit\b/, /\btender\b/, /\bg\.?s\.?t\.?\b/, /\bv\.?a\.?t\.?\b/,
  /\btax\b/, /\bitems?\s+sold\b/, /\brounding\b/,
];
const DISCOUNT_PATTERNS = [/\bdiscount\b/, /\bcoupon\b/, /\bpromo\w*\b/, /\bmarkdown\b/, /\bloyalt\w*\b/, /\bsaving\w*\b/, /\bmember\s+price\b/];
const DEPOSIT_PATTERNS = [/\bdeposit\b/, /\blevy\b/, /\bcrv\b/, /\bcontainer\s+fee\b/];
const REFUND_PATTERNS = [/\brefund\w*\b/, /\breturn\w*\b/, /\bvoid\w*\b/];
const NON_FOOD_PATTERNS = [
  /\bbag\b/, /\bcarrier\b/, /\btissue\w*\b/, /\btoilet\b/, /\bpaper\s+towel\w*\b/,
  /\bdetergent\b/, /\bsoap\b/, /\bshampoo\b/, /\bconditioner\b/, /\btoothpaste\b/,
  /\bcleaner\b/, /\bbleach\b/, /\bbatter(y|ies)\b/, /\bfoil\b/, /\bcling\s?film\b/,
  /\bnapkin\w*\b/, /\bdish\s?wash\w*\b/, /\bsponge\w*\b/, /\brazor\w*\b/, /\bdeodorant\b/,
];

/** Grams or millilitres per printed unit, for turning a weighed line into the app's own vocabulary. */
const MEASURE_CONVERSIONS: { pattern: RegExp; unit: MeasureUnit; factor: number }[] = [
  { pattern: /(\d+(?:\.\d+)?)\s*kgs?\b/, unit: 'g', factor: 1000 },
  { pattern: /(\d+(?:\.\d+)?)\s*lbs?\b/, unit: 'g', factor: 453.592 },
  { pattern: /(\d+(?:\.\d+)?)\s*g\b/, unit: 'g', factor: 1 },
  { pattern: /(\d+(?:\.\d+)?)\s*oz\b/, unit: 'ml', factor: 29.5735 },
  { pattern: /(\d+(?:\.\d+)?)\s*(?:l|ltr|litres?|liters?)\b/, unit: 'ml', factor: 1000 },
  { pattern: /(\d+(?:\.\d+)?)\s*ml\b/, unit: 'ml', factor: 1 },
];

/**
 * Structures recognised OCR lines without any network call — the path taken
 * when the user is offline, has no key, or has left cloud text enhancement
 * off, and the automatic landing place when a cloud text call fails.
 *
 * It is deliberately conservative. Where the printed line does not clearly
 * say something, the field stays null rather than being guessed: an
 * unreadable price is not a free item, and a number that might be a count
 * or might be a weight is neither. Review is the correction gate, and a
 * null is far easier to spot there than a confident wrong value.
 */
export function parseOcrLinesForReceiptPipeline(
  lines: readonly OcrLine[],
  captureDate: string,
): OcrExtractedReceipt {
  const ordered = orderedOcrLines({ lines });
  const parsed: OcrExtractedLine[] = [];
  for (const line of ordered) {
    const text = line.text.trim();
    if (text.length === 0) continue;
    parsed.push(parseOneLine(text, line.confidence));
  }

  return {
    store: localStoreName(ordered),
    purchasedAt: localPurchaseDate(ordered) ?? captureDate,
    // Without semantic understanding, the honest default is the common case.
    // Review's type selector is one tap, and every type re-plans from there.
    receiptType: 'grocery',
    subtotalCents: amountForLabel(parsed, /\bsub[\s-]?total\b/),
    taxCents: amountForLabel(parsed, /\btax\b|\bg\.?s\.?t\.?\b|\bv\.?a\.?t\.?\b/),
    totalCents: amountForLabel(parsed, /\btotal\b/, /\bsub[\s-]?total\b/),
    lines: parsed,
  };
}

function parseOneLine(text: string, confidence: number): OcrExtractedLine {
  const lower = text.toLowerCase();
  const kind = classifyLocally(lower);
  const lineTotalCents = trailingAmountCents(text, kind);
  const quantity = kind === 'food' || kind === 'non_food' ? readQuantity(lower) : null;
  return {
    text,
    kind,
    qty: quantity?.qty ?? null,
    unit: quantity?.unit ?? null,
    quantityKind: quantity?.quantityKind ?? null,
    lineTotalCents,
    unitPriceCents: readUnitPriceCents(lower),
    // A local pass reads lines, not relationships. Tying a discount to the
    // item above it is a semantic judgement this path deliberately declines
    // to make; a basket-wide discount is the safe reading.
    appliesToText: null,
    ocrConfidence: confidence,
  };
}

function classifyLocally(lower: string): ReceiptLineKind {
  if (REFUND_PATTERNS.some((pattern) => pattern.test(lower))) return 'refund';
  if (DEPOSIT_PATTERNS.some((pattern) => pattern.test(lower))) return 'deposit';
  if (DISCOUNT_PATTERNS.some((pattern) => pattern.test(lower))) return 'discount';
  if (ARITHMETIC_PATTERNS.some((pattern) => pattern.test(lower))) return 'arithmetic';
  if (NON_FOOD_PATTERNS.some((pattern) => pattern.test(lower))) return 'non_food';
  // The same bias the cloud prompt asks for: an unrecognised line is food,
  // because a misclassified food line disappears while a misclassified
  // non-food line is merely visible clutter during review.
  return 'food';
}

/** The right-hand money column, if the line prints one. */
function trailingAmountCents(text: string, kind: ReceiptLineKind): number | null {
  const match = /(-)?\$?\s*(\d{1,6})[.,](\d{2})\s*(-|cr)?$/i.exec(text.trim());
  if (!match) return null;
  const cents = Number.parseInt(match[2]!, 10) * 100 + Number.parseInt(match[3]!, 10);
  const negatedByPrint = Boolean(match[1]) || Boolean(match[4]);
  // A discount or refund reduces the basket whether or not the printer
  // bothered with a minus sign, so its sign comes from what it is.
  const negative = negatedByPrint || kind === 'discount' || kind === 'refund';
  return negative ? -cents : cents;
}

function readUnitPriceCents(lower: string): number | null {
  const match = /@\s*\$?\s*(\d{1,6})[.,](\d{2})/.exec(lower);
  if (!match) return null;
  return Number.parseInt(match[1]!, 10) * 100 + Number.parseInt(match[2]!, 10);
}

interface LocalQuantity {
  qty: number;
  unit: MeasureUnit;
  quantityKind: QuantityKind;
}

/**
 * A count and a measure are told apart the way the prompt tells a model to:
 * by what the line is priced per. A weight or volume is a measure; a leading
 * multiplier is a count; anything else stays null.
 */
function readQuantity(lower: string): LocalQuantity | null {
  for (const conversion of MEASURE_CONVERSIONS) {
    const match = conversion.pattern.exec(lower);
    if (!match) continue;
    const amount = Number.parseFloat(match[1]!);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    return { qty: Math.round(amount * conversion.factor), unit: conversion.unit, quantityKind: 'measure' };
  }
  const counted = /^\s*(\d{1,3})\s*(?:[x×@]|\s)/.exec(lower);
  if (counted) {
    const count = Number.parseInt(counted[1]!, 10);
    if (count > 0 && count <= 99) return { qty: count, unit: 'piece', quantityKind: 'count' };
  }
  return null;
}

/**
 * The header line, read as the first line that is plausibly a shop name
 * rather than an address, phone number, or price row. Null is a fine
 * answer — a missing header never fails an import.
 */
function localStoreName(lines: readonly OcrLine[]): string | null {
  for (const line of lines.slice(0, 3)) {
    const text = line.text.trim();
    if (text.length < 3 || text.length > 40) continue;
    if (/\d{2}/.test(text)) continue;
    if (!/[A-Za-z]/.test(text)) continue;
    return text;
  }
  return null;
}

/** Reads a printed date in the formats a receipt actually prints, or gives up. */
function localPurchaseDate(lines: readonly OcrLine[]): string | null {
  for (const line of lines) {
    const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(line.text);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const slashed = /\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/.exec(line.text);
    if (slashed) {
      // Day-first: Mise's receipts are read in en-AU/en-GB order, and an
      // ambiguous pair is corrected in review rather than guessed twice.
      const day = slashed[1]!.padStart(2, '0');
      const month = slashed[2]!.padStart(2, '0');
      if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
        return `${slashed[3]}-${month}-${day}`;
      }
    }
  }
  return null;
}

/** The amount printed on the first line matching `pattern` and not `exclude`. */
function amountForLabel(
  lines: readonly OcrExtractedLine[],
  pattern: RegExp,
  exclude?: RegExp,
): number | null {
  for (const line of lines) {
    const lower = line.text.toLowerCase();
    if (!pattern.test(lower)) continue;
    if (exclude?.test(lower)) continue;
    if (line.lineTotalCents !== null) return Math.abs(line.lineTotalCents);
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Small ReceiptExtracted contract used by the OCR hybrid text seam            */
/* -------------------------------------------------------------------------- */

interface LocalReceiptRow {
  text: string;
  boundingBox: OcrBoundingBox;
  order: number;
}

interface LocalPriceToken {
  cents: number;
  start: number;
  end: number;
  isUnitPrice: boolean;
}

const LOCAL_ARITHMETIC = /\b(?:sub\s*total|grand\s+total|total|tax|gst|hst|pst)\b/i;
const LOCAL_NON_ITEM = /\b(?:cashier|change|cash|credit|debit|visa|mastercard|amex|payment|approved|authorization|transaction|receipt|loyalty|points|member|phone|tel|thank\s+you)\b/i;
const LOCAL_HEADER_NOISE = /\b(?:street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|highway|hwy\.?|cashier|receipt|transaction|phone|tel|www\.|https?)\b/i;
const LOCAL_NON_FOOD = /\b(?:bag|bags|battery|batteries|bleach|cleaner|cleaning|deodorant|detergent|diaper|diapers|foil|garbage\s+bags?|napkin|napkins|paper\s+towels?|razor|razors|shampoo|soap|sponge|sponges|tissue|toilet\s+paper|toothbrush|toothpaste|trash\s+bags?|wipes|wrap)\b/i;

/**
 * Pure, conservative receipt parsing for the hybrid OCR seam. A field stays
 * null unless printed text supports it; geometry only pairs or wraps evidence.
 */
export function parseOcrLinesLocally(lines: readonly OcrLine[]): ReceiptExtracted;
export function parseOcrLinesLocally(lines: readonly OcrLine[], captureDate: string): OcrExtractedReceipt;
export function parseOcrLinesLocally(
  lines: readonly OcrLine[],
  captureDate?: string,
): ReceiptExtracted | OcrExtractedReceipt {
  if (captureDate !== undefined) return parseOcrLinesForReceiptPipeline(lines, captureDate);
  const rows = localReceiptRows(lines);
  if (rows.length === 0) return emptyLocalReceipt();

  let subtotalCents: number | null = null;
  let taxCents: number | null = null;
  let totalCents: number | null = null;
  for (const row of rows) {
    const amount = localLastPrice(row.text);
    if (amount === null) continue;
    if (/\bsub\s*total\b/i.test(row.text)) subtotalCents = amount;
    else if (/\b(?:tax|gst|hst|pst)\b/i.test(row.text)) taxCents = amount;
    else if (/\b(?:grand\s+)?total\b/i.test(row.text)) totalCents = amount;
  }

  const store = localStoreRow(rows);
  const consumed = new Set<number>();
  const items: ReceiptExtractedItem[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    if (consumed.has(index)) continue;
    const row = rows[index];
    if (row === undefined || localMetadataRow(row, index, store?.index ?? null)) continue;
    const lineTotalCents = localItemPrice(row.text);
    if (lineTotalCents === null) continue;

    let evidence = row.text;
    let rawName = localItemDescription(row.text);
    const previousIndex = index - 1;
    const previous = rows[previousIndex];
    if (
      previous !== undefined
      && !consumed.has(previousIndex)
      && !localMetadataRow(previous, previousIndex, store?.index ?? null)
      && localItemPrice(previous.text) === null
      && localPlausibleDescription(previous.text)
      && (
        (rawName.length === 0 && localPriceBesideDescription(previous, row))
        || (rawName.length > 0 && localWrappedRows(previous, row))
      )
    ) {
      evidence = `${previous.text} ${row.text}`;
      rawName = `${localItemDescription(previous.text)} ${rawName}`.trim();
      consumed.add(previousIndex);
    }

    if (!localPlausibleDescription(rawName)) continue;
    const quantity = localPrintedQuantity(evidence);
    items.push({
      rawName,
      quantity: quantity?.quantity ?? null,
      unit: quantity?.unit ?? null,
      lineTotalCents,
      isFood: !LOCAL_NON_FOOD.test(rawName),
    });
  }

  return {
    items,
    storeName: store?.name ?? null,
    totalCents,
    subtotalCents,
    taxCents,
    date: localPrintedDate(rows),
  };
}

function emptyLocalReceipt(): ReceiptExtracted {
  return {
    items: [], storeName: null, totalCents: null,
    subtotalCents: null, taxCents: null, date: null,
  };
}

function localReceiptRows(lines: readonly OcrLine[]): LocalReceiptRow[] {
  const usable = lines
    .filter((line) => line.text.trim().length > 0)
    .map((line) => ({ ...line, text: line.text.trim() }))
    .sort((left, right) => left.boundingBox.y - right.boundingBox.y
      || left.boundingBox.x - right.boundingBox.x || left.order - right.order);

  const groups: Array<{ lines: OcrLine[] }> = [];
  for (const line of usable) {
    const group = [...groups].reverse().find((candidate) =>
      candidate.lines.some((existing) => localSamePrintedRow(existing, line)),
    );
    if (group === undefined) groups.push({ lines: [line] });
    else group.lines.push(line);
  }

  return groups.map(({ lines: grouped }) => {
    const ordered = [...grouped].sort((left, right) =>
      left.boundingBox.x - right.boundingBox.x || left.order - right.order,
    );
    return {
      text: ordered.map((line) => line.text).join(' ').replace(/\s+/g, ' ').trim(),
      boundingBox: localUnionBoxes(ordered.map((line) => line.boundingBox)),
      order: Math.min(...ordered.map((line) => line.order)),
    };
  }).sort((left, right) => left.boundingBox.y - right.boundingBox.y || left.order - right.order);
}

function localSamePrintedRow(left: OcrLine, right: OcrLine): boolean {
  const a = left.boundingBox;
  const b = right.boundingBox;
  if (a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height) return false;
  if (a.height <= 0 || b.height <= 0) return false;
  const overlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  const overlapRatio = overlap / Math.min(a.height, b.height);
  const centreDelta = Math.abs((a.y + a.height / 2) - (b.y + b.height / 2));
  return overlapRatio >= 0.45 || centreDelta <= Math.max(a.height, b.height) * 0.4;
}

function localUnionBoxes(boxes: readonly OcrBoundingBox[]): OcrBoundingBox {
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function localStoreRow(rows: readonly LocalReceiptRow[]): { index: number; name: string } | null {
  const firstTransaction = rows.findIndex((row) =>
    LOCAL_ARITHMETIC.test(row.text) || localItemPrice(row.text) !== null,
  );
  const limit = firstTransaction === -1 ? rows.length : firstTransaction;
  for (let index = 0; index < limit; index += 1) {
    const row = rows[index];
    if (row === undefined || !localPlausibleDescription(row.text)) continue;
    if (LOCAL_HEADER_NOISE.test(row.text) || LOCAL_NON_ITEM.test(row.text)) continue;
    if (localParseDate(row.text) !== null || localPriceTokens(row.text).length > 0) continue;
    return { index, name: row.text };
  }
  return null;
}

function localMetadataRow(row: LocalReceiptRow, index: number, storeIndex: number | null): boolean {
  return index === storeIndex || LOCAL_ARITHMETIC.test(row.text)
    || LOCAL_NON_ITEM.test(row.text) || localParseDate(row.text) !== null;
}

function localWrappedRows(previous: LocalReceiptRow, current: LocalReceiptRow): boolean {
  return isWrappedContinuation(previous.boundingBox, current.boundingBox, {
    maxVerticalGapPx: Math.max(8, Math.max(previous.boundingBox.height, current.boundingBox.height) * 0.6),
    minHorizontalOverlapRatio: 0.3,
  });
}

function localPriceBesideDescription(description: LocalReceiptRow, price: LocalReceiptRow): boolean {
  const descriptionCentre = description.boundingBox.y + description.boundingBox.height / 2;
  const priceCentre = price.boundingBox.y + price.boundingBox.height / 2;
  return price.boundingBox.x >= description.boundingBox.x + description.boundingBox.width * 0.6
    && Math.abs(descriptionCentre - priceCentre)
      <= Math.max(description.boundingBox.height, price.boundingBox.height) * 0.8;
}

function localPriceTokens(text: string): LocalPriceToken[] {
  const expression = /\(?[-−]?\s*\$?\s*(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}\)?-?/g;
  const tokens: LocalPriceToken[] = [];
  for (const match of text.matchAll(expression)) {
    const start = match.index;
    const raw = match[0];
    if (start === undefined || raw === undefined) continue;
    const significantStart = start + (raw.match(/^\s*/)?.[0].length ?? 0);
    const previous = significantStart > 0 ? text[significantStart - 1] : '';
    if (previous !== undefined && /[\d.]/.test(previous)) continue;
    const cents = localCents(raw);
    if (cents === null) continue;
    const end = start + raw.length;
    const prefix = text.slice(Math.max(0, start - 4), start);
    const suffix = text.slice(end, end + 8);
    tokens.push({
      cents, start, end,
      isUnitPrice: /@\s*$/i.test(prefix)
        || /^\s*\/\s*(?:kg|g|lb|lbs|oz|l|ml|ea|each)\b/i.test(suffix),
    });
  }
  return tokens;
}

function localCents(raw: string): number | null {
  const negative = /[-−]/.test(raw) || /^\s*\(/.test(raw) || /-\s*$/.test(raw);
  const numeric = raw.replace(/[^\d.,]/g, '').replace(/,/g, '');
  const match = /^(\d+)\.(\d{2})$/.exec(numeric);
  if (match === null) return null;
  const whole = Number(match[1]);
  const fraction = Number(match[2]);
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(fraction)) return null;
  const cents = whole * 100 + fraction;
  return negative ? -cents : cents;
}

function localItemPrice(text: string): number | null {
  return localPriceTokens(text).filter((token) => !token.isUnitPrice).at(-1)?.cents ?? null;
}

function localLastPrice(text: string): number | null {
  return localPriceTokens(text).at(-1)?.cents ?? null;
}

function localItemDescription(text: string): string {
  return text
    .replace(/\(?[-−]?\s*\$?\s*(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}\)?-?/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:kg|g|lbs?|oz|l|ml)\b/gi, ' ')
    .replace(/\b\d+\s*(?:@|x|×)\s*/gi, ' ')
    .replace(/\/\s*(?:kg|g|lbs?|oz|l|ml|ea|each)\b/gi, ' ')
    .replace(/\s+[A-Z]$/i, '')
    .replace(/^[\s:;,@x×*#-]+|[\s:;,@x×*#-]+$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function localPlausibleDescription(text: string): boolean {
  return (text.match(/\p{L}/gu)?.length ?? 0) >= 2
    && !LOCAL_ARITHMETIC.test(text) && !LOCAL_NON_ITEM.test(text);
}

function localPrintedQuantity(text: string): { quantity: number; unit: MeasureUnit } | null {
  const measure = /(?:^|\s)(\d+(?:\.\d+)?)\s*(kg|g|lbs?|oz|l|ml)\b/i.exec(text);
  if (measure !== null) {
    const value = Number(measure[1]);
    const rawUnit = measure[2]?.toLowerCase();
    if (!Number.isFinite(value) || value <= 0 || rawUnit === undefined) return null;
    if (rawUnit === 'kg') return { quantity: value * 1000, unit: 'g' };
    if (rawUnit === 'lb' || rawUnit === 'lbs') return { quantity: value * 453.592, unit: 'g' };
    if (rawUnit === 'oz') return { quantity: value * 28.3495, unit: 'g' };
    if (rawUnit === 'l') return { quantity: value * 1000, unit: 'ml' };
    return { quantity: value, unit: rawUnit as Extract<MeasureUnit, 'g' | 'ml'> };
  }
  const count = /(?:^|\s)(\d+)\s*(?:@|x|×)\s*\$?\s*\d+\.\d{2}\b/i.exec(text);
  if (count === null) return null;
  const value = Number(count[1]);
  return Number.isSafeInteger(value) && value > 0 ? { quantity: value, unit: 'piece' } : null;
}

function localPrintedDate(rows: readonly LocalReceiptRow[]): string | null {
  for (const row of rows) {
    const parsed = localParseDate(row.text);
    if (parsed !== null) return parsed;
  }
  return null;
}

function localParseDate(text: string): string | null {
  const iso = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(text);
  if (iso !== null) return localValidDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const local = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/.exec(text);
  if (local === null) return null;
  const first = Number(local[1]);
  const second = Number(local[2]);
  const rawYear = Number(local[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const month = first > 12 && second <= 12 ? second : first;
  const day = first > 12 && second <= 12 ? first : second;
  return localValidDate(year, month, day);
}

function localValidDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}
