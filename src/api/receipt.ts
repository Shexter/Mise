import { completeVisionWithAnthropic } from '@/api/anthropic';
import { VisionError } from '@/api/errors';
import { getApiKey, getOpenAIEndpoint, providerForKey } from '@/api/keyStore';
import { completeVisionWithOpenAI } from '@/api/openai';
import { extractJsonObject } from '@/api/parse';
import { completeVisionWithGemini } from '@/api/gemini';
import { RECEIPT_SYSTEM_PROMPT, RECEIPT_USER_PROMPT } from '@/api/receiptPrompt';
import {
  MEASURE_UNITS,
  QUANTITY_KINDS,
  RECEIPT_LINE_KINDS,
  RECEIPT_TYPES,
  type MeasureUnit,
  type QuantityKind,
  type ReceiptLineKind,
  type ReceiptType,
} from '@/types';

/**
 * Receipt extraction. Sits beside `vision.ts` and follows its shape: one
 * call through the provider facade, defensive parsing of the shared JSON
 * contract. One call per receipt — matching never runs here, `resolve()`
 * from the identity layer does that against the lines this returns.
 */

export interface ExtractedLine {
  text: string;
  kind: ReceiptLineKind;
  qty: number | null;
  unit: MeasureUnit | null;
  /** Whether `qty` counts containers or measures a divisible amount. Null when unreadable or not applicable. */
  quantityKind: QuantityKind | null;
  lineTotalCents: number | null;
  unitPriceCents: number | null;
  /** For a `discount` line: the exact printed text of the line it reduces, or null for a basket-wide discount. */
  appliesToText: string | null;
}

export interface ExtractedReceipt {
  store: string | null;
  /** Always resolved: falls back to the capture date when the receipt shows no legible date. */
  purchasedAt: string;
  receiptType: ReceiptType;
  /** The printed pre-tax subtotal — what the arithmetic check compares extracted lines against. */
  subtotalCents: number | null;
  taxCents: number | null;
  totalCents: number | null;
  lines: ExtractedLine[];
}

/**
 * Extracts a receipt from a base64 JPEG.
 *
 * `captureDate` is the fallback purchase date — the honest answer when the
 * photograph shows no legible one, per the spec's "a missing header does
 * not fail the import" requirement.
 */
export async function extractReceipt(
  base64Jpeg: string,
  captureDate: string,
  signal?: AbortSignal,
): Promise<ExtractedReceipt> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new VisionError('no_key', 'No API key is set.');
  }
  const provider = providerForKey(apiKey);

  let raw: string;
  if (provider === 'anthropic') {
    raw = await completeVisionWithAnthropic(
      apiKey,
      RECEIPT_SYSTEM_PROMPT,
      RECEIPT_USER_PROMPT,
      base64Jpeg,
      signal,
    );
  } else if (provider === 'openai') {
    raw = await completeVisionWithOpenAI(
      apiKey,
      RECEIPT_SYSTEM_PROMPT,
      RECEIPT_USER_PROMPT,
      base64Jpeg,
      signal,
      await getOpenAIEndpoint(),
    );
  } else if (provider === 'gemini') {
    raw = await completeVisionWithGemini(
      apiKey,
      RECEIPT_SYSTEM_PROMPT,
      RECEIPT_USER_PROMPT,
      base64Jpeg,
      signal,
    );
  } else {
    throw new VisionError('no_key', 'The saved API key is not recognised.');
  }

  return parseReceiptResponse(raw, captureDate);
}

/** Turns the model's raw text into a validated `ExtractedReceipt`. */
export function parseReceiptResponse(
  raw: string,
  captureDate: string,
): ExtractedReceipt {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(raw));
  } catch {
    throw new VisionError('malformed', 'The receipt could not be read.');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new VisionError('malformed', 'The receipt could not be read.');
  }
  const record = parsed as Record<string, unknown>;

  const rawLines = Array.isArray(record['lines']) ? record['lines'] : [];
  const lines = rawLines
    .map(toExtractedLine)
    .filter((line): line is ExtractedLine => line !== null);

  if (lines.length === 0) {
    throw new VisionError('malformed', 'No lines were identified.');
  }

  return {
    store: asString(record['store']),
    purchasedAt: asString(record['purchased_at']) ?? captureDate,
    receiptType: asReceiptType(record['receipt_type']),
    subtotalCents: asNullableInt(record['subtotal_cents']),
    taxCents: asNullableInt(record['tax_cents']),
    totalCents: asNullableInt(record['total_cents']),
    lines,
  };
}

function toExtractedLine(value: unknown): ExtractedLine | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const text = asString(record['text']);
  if (!text) return null;

  return {
    text,
    kind: asLineKind(record['kind']),
    qty: asNullableNumber(record['qty']),
    unit: asNullableUnit(record['unit']),
    quantityKind: asQuantityKind(record['quantity_kind']),
    lineTotalCents: asNullableInt(record['line_total_cents']),
    unitPriceCents: asNullableInt(record['unit_price_cents']),
    appliesToText: asString(record['applies_to_text']),
  };
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** Prices stay unknown rather than zero when the model omits them — a missing price is not a free item. */
function asNullableInt(value: unknown): number | null {
  const parsed = asNullableNumber(value);
  return parsed !== null ? Math.round(parsed) : null;
}

function asNullableUnit(value: unknown): MeasureUnit | null {
  const candidate = typeof value === 'string' ? value.toLowerCase() : '';
  return MEASURE_UNITS.includes(candidate as MeasureUnit)
    ? (candidate as MeasureUnit)
    : null;
}

/** Unreadable stays unknown (null) — guessing count vs measure risks the wrong item-creation shape. */
function asQuantityKind(value: unknown): QuantityKind | null {
  const candidate = typeof value === 'string' ? value.toLowerCase() : '';
  return QUANTITY_KINDS.includes(candidate as QuantityKind)
    ? (candidate as QuantityKind)
    : null;
}

/** Unrecognised defaults to `food` — the same bias the prompt asks the model for (task 3.2). */
function asLineKind(value: unknown): ReceiptLineKind {
  return RECEIPT_LINE_KINDS.includes(value as ReceiptLineKind)
    ? (value as ReceiptLineKind)
    : 'food';
}

function asReceiptType(value: unknown): ReceiptType {
  return RECEIPT_TYPES.includes(value as ReceiptType)
    ? (value as ReceiptType)
    : 'grocery';
}
