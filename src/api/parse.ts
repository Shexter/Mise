import { VisionError } from '@/api/errors';
import {
  MEASURE_UNITS,
  type Confidence,
  type EstimatedItem,
  type MeasureUnit,
  type MealEstimate,
} from '@/types';

/**
 * Turns a model's raw text response into a validated `MealEstimate`.
 *
 * Both providers are prompted for the same JSON shape, so the parsing is shared:
 * strip any markdown fences or prose around the object, then coerce each field
 * defensively — a model that returns a number as a string, or omits a macro,
 * should not crash the review screen.
 */

/** Strips markdown fences and any prose either side of the JSON object. */
export function extractJsonObject(raw: string): string {
  const withoutFences = raw
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();
  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return withoutFences;
  return withoutFences.slice(start, end + 1);
}

export function parseEstimate(raw: string): MealEstimate {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(raw));
  } catch {
    throw new VisionError('malformed', 'The estimate could not be read.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new VisionError('malformed', 'The estimate could not be read.');
  }
  const record = parsed as Record<string, unknown>;

  const rawItems = Array.isArray(record['items']) ? record['items'] : [];
  const items = rawItems
    .map(toEstimatedItem)
    .filter((item): item is EstimatedItem => item !== null);

  if (items.length === 0) {
    throw new VisionError('malformed', 'No food was identified.');
  }

  return {
    mealName: asString(record['meal_name']) ?? 'Meal',
    confidence: asConfidence(record['confidence']),
    items,
    likelyHiddenIngredients: Array.isArray(record['likely_hidden_ingredients'])
      ? record['likely_hidden_ingredients']
          .map((value) => asString(value))
          .filter((value): value is string => value !== null)
      : [],
  };
}

function toEstimatedItem(value: unknown): EstimatedItem | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const name = asString(record['name']);
  if (!name) return null;

  return {
    name,
    quantity: asNumber(record['quantity']) ?? 1,
    unit: asUnit(record['unit']),
    calories: Math.max(0, asNumber(record['calories']) ?? 0),
    proteinG: Math.max(0, asNumber(record['protein_g']) ?? 0),
    carbsG: Math.max(0, asNumber(record['carbs_g']) ?? 0),
    fatG: Math.max(0, asNumber(record['fat_g']) ?? 0),
  };
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asUnit(value: unknown): MeasureUnit {
  const candidate = typeof value === 'string' ? value.toLowerCase() : '';
  return MEASURE_UNITS.includes(candidate as MeasureUnit)
    ? (candidate as MeasureUnit)
    : 'serving';
}

function asConfidence(value: unknown): Confidence {
  return value === 'high' || value === 'low' || value === 'medium'
    ? value
    : 'medium';
}
