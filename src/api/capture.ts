import { CAPTURE_SYSTEM_PROMPT, CAPTURE_USER_PROMPT } from '@/api/capturePrompt';
import { VisionError } from '@/api/errors';
import { extractJsonObject } from '@/api/parse';
import { completeVision } from '@/api/vision';
import type { MeasureUnit } from '@/types';
import { MEASURE_UNITS } from '@/types';

export type CaptureExtraction =
  | { kind: 'receipt'; lines: { text: string }[] }
  | { kind: 'items'; items: CaptureItem[] }
  | { kind: 'unclear' }
  | { kind: 'nothing' };

export interface CaptureItem {
  name: string;
  quantity: number | null;
  unit: MeasureUnit | null;
}

/** Runs exactly one model request, then parses its discriminated result. */
export async function extractCapture(
  base64Jpeg: string,
  signal?: AbortSignal,
  onRetryWait?: (delayMs: number) => void,
): Promise<CaptureExtraction> {
  return parseCaptureResponse(
    await completeVision(base64Jpeg, CAPTURE_SYSTEM_PROMPT, CAPTURE_USER_PROMPT, signal, onRetryWait),
  );
}

/** Invalid or unrecognised model kinds stay uncertain rather than crashing. */
export function parseCaptureResponse(raw: string): CaptureExtraction {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(raw));
  } catch {
    throw new VisionError('malformed', 'The capture could not be read.');
  }
  if (typeof parsed !== 'object' || parsed === null) return { kind: 'unclear' };
  const record = parsed as Record<string, unknown>;
  if (record['kind'] === 'receipt') {
    const lines = Array.isArray(record['receipt_lines'])
      ? record['receipt_lines'].flatMap((entry) => {
          const text = asString((entry as Record<string, unknown>)['text']);
          return text ? [{ text }] : [];
        })
      : [];
    return lines.length > 0 ? { kind: 'receipt', lines } : { kind: 'unclear' };
  }
  if (record['kind'] === 'items') {
    const items = Array.isArray(record['items'])
      ? record['items'].flatMap(toCaptureItem)
      : [];
    return items.length > 0 ? { kind: 'items', items } : { kind: 'unclear' };
  }
  return record['kind'] === 'nothing' ? { kind: 'nothing' } : { kind: 'unclear' };
}

function toCaptureItem(value: unknown): CaptureItem[] {
  if (typeof value !== 'object' || value === null) return [];
  const record = value as Record<string, unknown>;
  const name = asString(record['name']);
  if (!name) return [];
  const quantity = asNumber(record['quantity']);
  const unit = asUnit(record['unit']);
  return [{ name, quantity, unit }];
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asUnit(value: unknown): MeasureUnit | null {
  return typeof value === 'string' && MEASURE_UNITS.includes(value as MeasureUnit)
    ? value as MeasureUnit
    : null;
}
