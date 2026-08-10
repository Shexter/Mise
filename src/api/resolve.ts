import { completeWithAnthropic } from '@/api/anthropic';
import { VisionError } from '@/api/errors';
import { completeWithGemini } from '@/api/gemini';
import { getApiKey, getOpenAIEndpoint, providerForKey } from '@/api/keyStore';
import { completeWithOpenAI } from '@/api/openai';
import { extractJsonObject } from '@/api/parse';
import { buildResolveUserPrompt, RESOLVE_SYSTEM_PROMPT } from '@/api/resolvePrompt';
import type {
  CanonicalProposal,
  ModelResolution,
  ModelResolutionRequest,
} from '@/logic/match';
import {
  FOOD_CLASSES,
  MEASURE_UNITS,
  STORAGE_LOCATIONS,
  type FoodClass,
  type MeasureUnit,
  type StorageLocation,
} from '@/types';

/**
 * Model-assisted ingredient resolution: cascade steps 4 and 5.
 *
 * Sits beside `vision.ts` and follows its shape — provider picked from the
 * stored key, one transport call, defensive parsing of the JSON that comes
 * back. One batched request per call, never one per reference. The caller
 * (the cascade in `src/logic/match.ts`) treats any throw as "queue the
 * batch for review", so failure here never surfaces as an error.
 */

/**
 * Resolves a batch of references the local cascade could not place.
 * Returns one entry per reference, aligned by index; null where the model
 * could not place it either.
 *
 * Preconditions:
 * an API key is stored — callers gate on `hasApiKey()`
 */
export async function resolveWithModel(
  batch: ModelResolutionRequest,
  signal?: AbortSignal,
): Promise<(ModelResolution | null)[]> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new VisionError('no_key', 'No API key is set.');
  }
  const user = buildResolveUserPrompt(batch);
  const provider = providerForKey(apiKey);
  let raw: string;
  if (provider === 'anthropic') {
    raw = await completeWithAnthropic(apiKey, RESOLVE_SYSTEM_PROMPT, user, signal);
  } else if (provider === 'openai') {
    raw = await completeWithOpenAI(
      apiKey, RESOLVE_SYSTEM_PROMPT, user, signal, await getOpenAIEndpoint(),
    );
  } else if (provider === 'gemini') {
    raw = await completeWithGemini(apiKey, RESOLVE_SYSTEM_PROMPT, user, signal);
  } else {
    throw new VisionError('no_key', 'The saved API key is not recognised.');
  }

  return parseResolutions(raw, batch);
}

/**
 * Turns the model's raw text into aligned resolutions. Exported for tests.
 * Malformed overall shape throws (the cascade queues the batch); a
 * malformed individual entry degrades to null (that reference is queued).
 */
export function parseResolutions(
  raw: string,
  batch: ModelResolutionRequest,
): (ModelResolution | null)[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(raw));
  } catch {
    throw new VisionError('malformed', 'The resolution could not be read.');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new VisionError('malformed', 'The resolution could not be read.');
  }
  const entries = (parsed as Record<string, unknown>)['resolutions'];
  if (!Array.isArray(entries)) {
    throw new VisionError('malformed', 'The resolution could not be read.');
  }

  const allowedIds = batch.references.map(
    (reference) =>
      new Set([...reference.candidateIds, ...batch.ownedCanonicalIds]),
  );

  const results = new Array<ModelResolution | null>(
    batch.references.length,
  ).fill(null);
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const index = asIndex(record['index'], batch.references.length);
    if (index === null || results[index] !== null) continue;

    const canonicalId = asString(record['canonical_id']);
    if (canonicalId && allowedIds[index]?.has(canonicalId)) {
      results[index] = {
        canonicalId,
        confidence: asUnitInterval(record['confidence']),
      };
      continue;
    }

    const proposal = asProposal(record['new_item']);
    if (proposal) {
      results[index] = { proposal };
    }
  }
  return results;
}

/* -------------------------------------------------------------------------- */
/* Coercions                                                                   */
/* -------------------------------------------------------------------------- */

function asIndex(value: unknown, length: number): number | null {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < length
    ? value
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function asUnitInterval(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 1)
    : 0.75;
}

function asProposal(value: unknown): CanonicalProposal | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;

  const displayName = asString(record['display_name']);
  const foodClass = record['class'];
  const location = record['default_location'];
  if (
    !displayName ||
    !FOOD_CLASSES.includes(foodClass as FoodClass) ||
    !STORAGE_LOCATIONS.includes(location as StorageLocation)
  ) {
    return null;
  }

  const shelfLifeDays: Partial<Record<StorageLocation, number>> = {};
  const rawShelf = record['shelf_life_days'];
  if (typeof rawShelf === 'object' && rawShelf !== null) {
    for (const [key, days] of Object.entries(rawShelf)) {
      if (
        STORAGE_LOCATIONS.includes(key as StorageLocation) &&
        typeof days === 'number' &&
        days > 0
      ) {
        shelfLifeDays[key as StorageLocation] = Math.round(days);
      }
    }
  }
  if (Object.keys(shelfLifeDays).length === 0) return null;

  const openLife = record['open_life_days'];
  const useQty = record['typical_use_qty'];
  const useUnit = record['typical_use_unit'];
  return {
    displayName,
    foodClass: foodClass as FoodClass,
    defaultLocation: location as StorageLocation,
    shelfLifeDays,
    openLifeDays:
      typeof openLife === 'number' && openLife > 0
        ? Math.round(openLife)
        : null,
    typicalUseQty:
      typeof useQty === 'number' && useQty > 0 ? useQty : null,
    typicalUseUnit: MEASURE_UNITS.includes(useUnit as MeasureUnit)
      ? (useUnit as MeasureUnit)
      : null,
  };
}
