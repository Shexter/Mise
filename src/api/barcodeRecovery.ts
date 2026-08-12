import { VisionError } from '@/api/errors';
import { extractJsonObject } from '@/api/parse';
import { completeVision } from '@/api/vision';
import { MEASURE_UNITS, type MeasureUnit } from '@/types';

export type BarcodeEvidenceKind = 'package-front' | 'declared-quantity' | 'nutrition-label';

export interface BarcodeEvidence {
  name: string | null;
  brand: string | null;
  pkgQty: number | null;
  pkgUnit: MeasureUnit | null;
  containerCount: number | null;
  kcalPer100: number | null;
  proteinPer100: number | null;
  carbsPer100: number | null;
  fatPer100: number | null;
}

const SYSTEM = `Read factual package evidence for a product-identification draft. Do not rate healthfulness or infer missing values. Return raw JSON only with nullable fields: name, brand, pkgQty, pkgUnit, containerCount, kcalPer100, proteinPer100, carbsPer100, fatPer100. pkgUnit must be one of ${MEASURE_UNITS.join(', ')}. Nutrition must be per 100 g or 100 ml only; otherwise return null.`;

export async function extractBarcodeEvidence(base64Jpeg: string, kind: BarcodeEvidenceKind, signal?: AbortSignal): Promise<BarcodeEvidence> {
  return parseBarcodeEvidence(await completeVision(base64Jpeg, SYSTEM, `This is the product's ${kind.replace('-', ' ')}. Extract only facts visible in this image.`, signal));
}

export function parseBarcodeEvidence(raw: string): BarcodeEvidence {
  let value: unknown;
  try { value = JSON.parse(extractJsonObject(raw)); } catch { throw new VisionError('malformed', 'The package evidence could not be read.'); }
  if (!value || typeof value !== 'object') throw new VisionError('malformed', 'The package evidence could not be read.');
  const row = value as Record<string, unknown>;
  return {
    name: text(row.name), brand: text(row.brand), pkgQty: positive(row.pkgQty),
    pkgUnit: unit(row.pkgUnit), containerCount: positiveInteger(row.containerCount),
    kcalPer100: nonNegative(row.kcalPer100), proteinPer100: nonNegative(row.proteinPer100),
    carbsPer100: nonNegative(row.carbsPer100), fatPer100: nonNegative(row.fatPer100),
  };
}

function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function positive(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null; }
function positiveInteger(value: unknown): number | null { return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : null; }
function nonNegative(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null; }
function unit(value: unknown): MeasureUnit | null { return typeof value === 'string' && MEASURE_UNITS.includes(value as MeasureUnit) ? value as MeasureUnit : null; }
