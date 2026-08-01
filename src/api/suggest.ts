import { completeWithAnthropic } from '@/api/anthropic';
import { VisionError } from '@/api/errors';
import { completeWithGemini } from '@/api/gemini';
import { getApiKey, providerForKey } from '@/api/keyStore';
import { extractJsonObject } from '@/api/parse';
import { buildSuggestUserPrompt, SUGGEST_SYSTEM_PROMPT } from '@/api/suggestPrompt';
import type { PersonalisationSummary, StockPayload } from '@/logic/suggest';
import {
  MEASURE_UNITS,
  type Macros,
  type MeasureUnit,
  type Suggestion,
  type SuggestionMissing,
  type SuggestionMode,
  type SuggestionReason,
  type SuggestionReasonKind,
  type SuggestionUse,
} from '@/types';

/**
 * The dinner-decision model call. Sits beside `resolve.ts` and follows its
 * shape: provider from the stored key, one transport call, defensive
 * parsing. Any throw here is the caller's cue to say suggestions could not
 * be generated (decision: "degrades without a provider") — never a crash.
 */

export interface SuggestRequest {
  mode: SuggestionMode;
  stock: StockPayload;
  personalisation: PersonalisationSummary;
  remainingCalories: number;
  macroGap: Macros;
  untilDate?: string;
}

export interface SuggestResult {
  suggestions: Suggestion[];
  /** "Stretch" mode's honest gap. Always null in "tonight" mode. */
  shortfall: string | null;
}

/**
 * Generates a set of suggestions.
 *
 * Preconditions:
 * an API key is stored — callers gate on `hasApiKey()`
 */
export async function generateSuggestions(
  request: SuggestRequest,
  signal?: AbortSignal,
): Promise<SuggestResult> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new VisionError('no_key', 'No API key is set.');
  }
  const user = buildSuggestUserPrompt(request);
  const raw =
    providerForKey(apiKey) === 'anthropic'
      ? await completeWithAnthropic(apiKey, SUGGEST_SYSTEM_PROMPT, user, signal)
      : await completeWithGemini(apiKey, SUGGEST_SYSTEM_PROMPT, user, signal);

  return parseSuggestResponse(raw, allCatalogueIds(request));
}

/** Every id the model was shown, whether sent in full or compressed. */
function allCatalogueIds(request: SuggestRequest): ReadonlySet<string> {
  return new Set(
    [...request.stock.full, ...request.stock.compressed].map(
      (line) => line.canonicalId,
    ),
  );
}

/**
 * Turns the model's raw text into validated suggestions. Exported for
 * tests, and for the fixture-driven shape assertions that run with no
 * provider in the loop.
 *
 * A `uses` entry citing an id outside `candidateIds` is dropped, not the
 * whole suggestion — resolve.ts's precedent for "never invent an id".
 * A suggestion left with no valid `uses` after that is dropped entirely:
 * the spec requires ingredients to be identified precisely, and a dish
 * naming nothing real is not a suggestion.
 */
export function parseSuggestResponse(
  raw: string,
  candidateIds: ReadonlySet<string>,
): SuggestResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(raw));
  } catch {
    throw new VisionError('malformed', 'The suggestions could not be read.');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new VisionError('malformed', 'The suggestions could not be read.');
  }
  const record = parsed as Record<string, unknown>;
  const rawSuggestions = record['suggestions'];
  if (!Array.isArray(rawSuggestions)) {
    throw new VisionError('malformed', 'The suggestions could not be read.');
  }

  const suggestions = rawSuggestions
    .map((entry) => toSuggestion(entry, candidateIds))
    .filter((entry): entry is Suggestion => entry !== null);

  if (suggestions.length === 0) {
    throw new VisionError('malformed', 'No usable suggestion was returned.');
  }

  return { suggestions, shortfall: asNullableString(record['shortfall']) };
}

/* -------------------------------------------------------------------------- */
/* Coercions                                                                   */
/* -------------------------------------------------------------------------- */

function toSuggestion(
  value: unknown,
  candidateIds: ReadonlySet<string>,
): Suggestion | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;

  const dish = asString(record['dish']);
  if (!dish) return null;

  const uses = Array.isArray(record['uses'])
    ? record['uses']
        .map((entry) => toUse(entry, candidateIds))
        .filter((entry): entry is SuggestionUse => entry !== null)
    : [];
  if (uses.length === 0) return null;

  const missing = Array.isArray(record['missing'])
    ? record['missing']
        .map((entry) => toMissing(entry, candidateIds))
        .filter((entry): entry is SuggestionMissing => entry !== null)
    : [];

  const reasonTags = Array.isArray(record['reason_tags'])
    ? record['reason_tags'].map((tag) => asString(tag)).filter((tag): tag is string => tag !== null)
    : [];
  if (reasonTags.length === 0) return null;

  const method = Array.isArray(record['method'])
    ? record['method'].map((step) => asString(step)).filter((step): step is string => step !== null)
    : [];

  return {
    dish,
    reasons: reasonTags.map(toReason),
    kcalPerServing: Math.max(0, asNumber(record['kcal_per_serving']) ?? 0),
    servings: Math.max(1, Math.round(asNumber(record['servings']) ?? 1)),
    effortMinutes: Math.max(0, asNumber(record['effort_minutes']) ?? 0),
    uses,
    missing,
    method,
  };
}

function toUse(
  value: unknown,
  candidateIds: ReadonlySet<string>,
): SuggestionUse | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const canonicalId = asString(record['canonical_id']);
  const qty = asNumber(record['qty']);
  const unit = asUnit(record['unit']);
  if (!canonicalId || !candidateIds.has(canonicalId) || qty === null || qty <= 0) {
    return null;
  }
  return { canonicalId, qty, unit };
}

function toMissing(
  value: unknown,
  candidateIds: ReadonlySet<string>,
): SuggestionMissing | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const name = asString(record['name']);
  if (!name) return null;
  const rawId = asString(record['canonical_id']);
  return {
    canonicalId: rawId && candidateIds.has(rawId) ? rawId : null,
    name,
    note: asNullableString(record['note']),
  };
}

/** Heuristic classification of a free-text reason tag, for icon/grouping only. */
function toReason(label: string): SuggestionReason {
  const lower = label.toLowerCase();
  let kind: SuggestionReasonKind = 'matches_history';
  if (lower.includes('$') || lower.includes('save') || lower.includes('value')) {
    kind = 'saves_value';
  } else if (lower.includes('clear') || lower.includes('expir') || lower.includes('day')) {
    kind = 'clears_stock';
  } else if (lower.includes('kcal') || lower.includes('calor') || lower.includes('fit')) {
    kind = 'fits_calories';
  }
  return { kind, label };
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNullableString(value: unknown): string | null {
  return asString(value);
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
