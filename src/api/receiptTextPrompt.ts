import { VisionError } from '@/api/errors';
import { extractJsonObject } from '@/api/parse';
import { RECEIPT_SYSTEM_PROMPT } from '@/api/receiptPrompt';
import { MEASURE_UNITS, type MeasureUnit, type OcrLine } from '@/types';

export interface ReceiptExtractedItem {
  rawName: string;
  quantity: number | null;
  unit: MeasureUnit | null;
  lineTotalCents: number | null;
  isFood: boolean;
}

export interface ReceiptExtracted {
  items: ReceiptExtractedItem[];
  storeName: string | null;
  totalCents: number | null;
  subtotalCents: number | null;
  taxCents: number | null;
  date: string | null;
}

export interface ReceiptTextPrompt {
  system: string;
  user: string;
}

const RECEIPT_EXTRACTED_SYSTEM_PROMPT = `You structure already-recognized shopping-receipt text. The OCR lines are evidence: do not add products, quantities, prices, store names, or dates that are not printed in them.

Rules:
- Keep purchase items in printed order. Exclude subtotal, tax, total, payment, address, phone, loyalty, and receipt-number lines from items.
- rawName is the printed item description without its price or quantity syntax. Do not silently correct brands or abbreviations.
- quantity and unit are null unless the receipt explicitly prints a defensible quantity. Use "piece" for counts such as "2 @ 3.50". Convert kg to g and L to ml.
- lineTotalCents is the printed total for that purchase line, as an integer number of cents. A unit price following "@" is not a line total unless a separate line total is also printed.
- isFood is false for clearly non-food merchandise such as paper goods, cleaning products, toiletries, bags, or batteries. When genuinely ambiguous, use true so the line remains visible for review.
- Header money fields are the explicitly printed amounts. Leave missing or illegible fields null.
- date is YYYY-MM-DD when printed clearly, otherwise null.

Return raw JSON only, with this exact schema and field spelling:
{
  "items": [
    {
      "rawName": "string",
      "quantity": 0,
      "unit": "g" | "ml" | "piece" | "cup" | "tbsp" | "tsp" | "slice" | "serving" | null,
      "lineTotalCents": 0,
      "isFood": true
    }
  ],
  "storeName": "string" | null,
  "totalCents": 0,
  "subtotalCents": 0,
  "taxCents": 0,
  "date": "YYYY-MM-DD" | null
}`;

const IMAGE_READING_INSTRUCTION =
  'You are reading a photograph of a shopping receipt. Transcribe every printed line and classify it, so the app can tell food from everything else a receipt prints.';

const TEXT_READING_INSTRUCTION = `You are structuring shopping-receipt text that an on-device recognizer already read. Work only from the recognized lines provided. Do not invent or silently omit printed evidence. Preserve printed order, and return the schema below.`;

/** Existing pipeline schema for the transport that imports this constant directly. */
export const RECEIPT_TEXT_SYSTEM_PROMPT = RECEIPT_SYSTEM_PROMPT.replace(
  IMAGE_READING_INSTRUCTION,
  TEXT_READING_INSTRUCTION,
);

export function buildReceiptTextPrompt(
  lines: readonly OcrLine[] | readonly string[],
): ReceiptTextPrompt {
  const textLines = lines.map((line) => typeof line === 'string' ? line : line.text);
  return {
    system: RECEIPT_EXTRACTED_SYSTEM_PROMPT,
    user: JSON.stringify({
      task: 'Structure these OCR lines as a receipt. Return raw JSON matching the schema.',
      lines: textLines,
    }),
  };
}

/** Compatibility helper for transports that only need the user half. */
export function receiptTextUserPrompt(lines: readonly string[]): string {
  return buildReceiptTextPrompt(lines).user;
}

export function parseReceiptTextResponse(content: string): ReceiptExtracted {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(content));
  } catch {
    throw new VisionError('malformed', 'The receipt text could not be structured.');
  }

  if (!isRecord(parsed)) {
    throw new VisionError('malformed', 'The receipt text could not be structured.');
  }

  const rawItems = Array.isArray(parsed['items']) ? parsed['items'] : [];
  return {
    items: rawItems
      .map(parseItem)
      .filter((item): item is ReceiptExtractedItem => item !== null),
    storeName: asString(parsed['storeName'] ?? parsed['store_name']),
    totalCents: asCents(parsed['totalCents'] ?? parsed['total_cents']),
    subtotalCents: asCents(parsed['subtotalCents'] ?? parsed['subtotal_cents']),
    taxCents: asCents(parsed['taxCents'] ?? parsed['tax_cents']),
    date: asIsoDate(parsed['date']),
  };
}

function parseItem(value: unknown): ReceiptExtractedItem | null {
  if (!isRecord(value)) return null;
  const rawName = asString(value['rawName'] ?? value['raw_name']);
  if (rawName === null) return null;
  const quantity = asPositiveNumber(value['quantity']);
  return {
    rawName,
    quantity,
    unit: quantity === null ? null : asUnit(value['unit']),
    lineTotalCents: asCents(value['lineTotalCents'] ?? value['line_total_cents']),
    isFood: asBoolean(value['isFood'] ?? value['is_food']) ?? true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asPositiveNumber(value: unknown): number | null {
  const parsed = asFiniteNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function asCents(value: unknown): number | null {
  const parsed = asFiniteNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

function asUnit(value: unknown): MeasureUnit | null {
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return MEASURE_UNITS.includes(candidate as MeasureUnit) ? candidate as MeasureUnit : null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string' && value.toLowerCase() === 'true') return true;
  if (typeof value === 'string' && value.toLowerCase() === 'false') return false;
  return null;
}

function asIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? trimmed
    : null;
}
