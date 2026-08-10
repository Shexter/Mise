import { VisionError } from '@/api/errors';
import type { MeasureUnit } from '@/types';

const ENDPOINT = 'https://world.openfoodfacts.org/api/v3/product';
const TIMEOUT_MS = 30_000;
export const OPEN_FOOD_FACTS_ATTRIBUTION = 'Product data: Open Food Facts (ODbL).';

export interface OpenFoodFactsProduct {
  gtin: string;
  name: string;
  brand: string | null;
  pkgQty: number | null;
  pkgUnit: MeasureUnit | null;
  kcalPer100: number | null;
  proteinPer100: number | null;
  carbsPer100: number | null;
  fatPer100: number | null;
}

export async function lookupOpenFoodFacts(gtin: string, signal?: AbortSignal): Promise<OpenFoodFactsProduct | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(`${ENDPOINT}/${encodeURIComponent(gtin)}`, {
      headers: { 'User-Agent': 'Mise/1.0 (support@mise.app)' }, signal: controller.signal,
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new VisionError(response.status >= 500 ? 'server' : 'malformed', 'Product lookup failed.');
    return parseOpenFoodFactsResponse(await response.json(), gtin);
  } catch (error) {
    if (error instanceof VisionError) throw error;
    if (controller.signal.aborted) throw new VisionError(signal?.aborted ? 'cancelled' : 'timeout', signal?.aborted ? 'Lookup cancelled.' : 'The lookup timed out.');
    throw new VisionError('network', 'Could not reach the product catalogue.');
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}

export function parseOpenFoodFactsResponse(raw: unknown, gtin: string): OpenFoodFactsProduct | null {
  if (!isRecord(raw) || !isRecord(raw.product)) return null;
  const product = raw.product;
  const name = string(product.product_name) ?? string(product.product_name_en);
  if (!name) return null;
  const nutrition = isRecord(product.nutriments) ? product.nutriments : {};
  const quantity = parseQuantity(string(product.quantity));
  return { gtin, name, brand: string(product.brands), pkgQty: quantity?.qty ?? null, pkgUnit: quantity?.unit ?? null,
    kcalPer100: number(nutrition['energy-kcal_100g']) ?? number(nutrition['energy-kcal']), proteinPer100: number(nutrition.proteins_100g), carbsPer100: number(nutrition.carbohydrates_100g), fatPer100: number(nutrition.fat_100g) };
}
function parseQuantity(value: string | null): { qty: number; unit: MeasureUnit } | null { const match = value?.match(/^\s*(\d+(?:\.\d+)?)\s*(g|ml)\b/i); if (!match) return null; return { qty: Number(match[1]), unit: match[2]!.toLowerCase() as MeasureUnit }; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
function string(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function number(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
