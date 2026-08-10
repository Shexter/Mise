import { completeWithAnthropic } from '@/api/anthropic';
import { VisionError } from '@/api/errors';
import { completeWithGemini } from '@/api/gemini';
import { getApiKey, getOpenAIEndpoint, providerForKey } from '@/api/keyStore';
import { completeWithOpenAI } from '@/api/openai';
import { extractJsonObject } from '@/api/parse';
import { buildSuggestUserPrompt, SUGGEST_SYSTEM_PROMPT } from '@/api/suggestPrompt';
import { applyDietary, type ExclusionSet } from '@/logic/dietary';
import type { PersonalisationSummary, StockPayload } from '@/logic/suggest';
import {
  MEASURE_UNITS,
  type DietaryRule,
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
  /** For the prompt only — a request, never the mechanism. Empty when the user has recorded nothing. */
  dietaryRules: readonly DietaryRule[];
  /** The enforcement mechanism: allergen and restriction rules, expanded through derivatives. */
  exclusionSet: ExclusionSet;
  /** Gates the unknown-excludes-allergens-only rule (decision, `add-dietary-profile`). */
  hasAllergenRules: boolean;
}

export interface SuggestResult {
  /**
   * In "tonight" mode, the eligible candidate pool — up to
   * `CANDIDATE_POOL_SIZE`, after both drops below, not yet reduced to what
   * is displayed. `dishScore.ts`'s `selectDisplayed` does that next. In
   * "stretch" mode this is the plan's dinners, unaffected by the scorer.
   *
   * Can be empty (decision 178) — the use-first or dietary drop may
   * legitimately remove everything the provider returned. `parseSuggestResponse`
   * only ever throws when nothing was readable in the first place; an empty
   * array here always means "readable, but nothing survived your rules",
   * distinguished by which of the two counts below is nonzero.
   */
  suggestions: Suggestion[];
  /** "Stretch" mode's honest gap. Always null in "tonight" mode. */
  shortfall: string | null;
  /**
   * Suggestions the local use-first check removed after parsing (task 11).
   * The prompt states the constraint as a hard requirement, but nothing
   * upstream of this module enforces it — this is the guarantee, the
   * prompt is only the request (decision 103's shape, applied to decision
   * 34). Surfaced so the caller can say the constraint was applied rather
   * than silently showing fewer ideas than asked for.
   */
  droppedForConstraint: number;
  /**
   * Suggestions `applyDietary` removed — an allergen or restriction match,
   * or an unresolved ingredient where an allergen rule exists (task 6.3).
   * Reported separately from `droppedForConstraint`: "two ideas contained
   * peanut" and "two ideas didn't use what needs using" are different
   * sentences, and the user can only act on one of them.
   */
  droppedForDiet: number;
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
  const provider = providerForKey(apiKey);
  let raw: string;
  if (provider === 'anthropic') {
    raw = await completeWithAnthropic(apiKey, SUGGEST_SYSTEM_PROMPT, user, signal);
  } else if (provider === 'openai') {
    raw = await completeWithOpenAI(
      apiKey, SUGGEST_SYSTEM_PROMPT, user, signal, await getOpenAIEndpoint(),
    );
  } else if (provider === 'gemini') {
    raw = await completeWithGemini(apiKey, SUGGEST_SYSTEM_PROMPT, user, signal);
  } else {
    throw new VisionError('no_key', 'The saved API key is not recognised.');
  }

  return parseSuggestResponse(
    raw,
    allCatalogueIds(request),
    useFirstIds(request),
    request.exclusionSet,
    request.hasAllergenRules,
  );
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
 * The ids the prompt labelled `use_first` — always sent in `stock.full`
 * (`shapeStockPayload` never compresses a use_first line). Empty means
 * there is nothing urgent, and the constraint has nothing to check.
 */
function useFirstIds(request: SuggestRequest): ReadonlySet<string> {
  return new Set(
    request.stock.full
      .filter((line) => line.bucket === 'use_first')
      .map((line) => line.canonicalId),
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
 *
 * `useFirstIds` is the local guarantee behind the prompt's hard
 * requirement (task 11): whenever it is non-empty, a suggestion whose
 * `uses` misses it entirely is dropped too, never repaired by swapping in
 * an ingredient the model did not choose. Pass an empty set when nothing
 * is urgent — the spec only requires this when the use_first group is
 * non-empty.
 *
 * `exclusionSet` and `hasAllergenRules` are `add-dietary-profile`'s
 * guarantee, run last and over whatever the use-first check left: an
 * allergen or restriction is never softened into a weight (decision,
 * matching decision 34's own argument), so a violating suggestion is
 * dropped here, never scored, never repaired.
 *
 * `malformed` means the response could not be read — never that a local
 * rule emptied it (decision 178, found in review). Once at least one
 * suggestion parses, the use-first and dietary drops below may legitimately
 * remove every one of them; that is the constraint working, not the
 * provider failing, and the result is returned rather than thrown so the
 * caller can say what actually happened.
 */
export function parseSuggestResponse(
  raw: string,
  candidateIds: ReadonlySet<string>,
  useFirstIds: ReadonlySet<string>,
  exclusionSet: ExclusionSet,
  hasAllergenRules: boolean,
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

  const parsedSuggestions = rawSuggestions
    .map((entry) => toSuggestion(entry, candidateIds))
    .filter((entry): entry is Suggestion => entry !== null);

  // Nothing the provider returned could be read as a suggestion at all —
  // an unreadable response, not an empty result. Everything past this
  // point starts from at least one valid suggestion, so however the drops
  // below leave it, that is a local rule doing its job, never a reason to
  // throw.
  if (parsedSuggestions.length === 0) {
    throw new VisionError('malformed', 'No usable suggestion was returned.');
  }

  const afterUseFirst =
    useFirstIds.size === 0
      ? parsedSuggestions
      : parsedSuggestions.filter((suggestion) =>
          suggestion.uses.some((use) => useFirstIds.has(use.canonicalId)),
        );
  const droppedForConstraint = parsedSuggestions.length - afterUseFirst.length;

  const suggestions = afterUseFirst.filter(
    (suggestion) => !applyDietary(suggestion, exclusionSet, hasAllergenRules).excluded,
  );
  const droppedForDiet = afterUseFirst.length - suggestions.length;

  return {
    suggestions,
    shortfall: asNullableString(record['shortfall']),
    droppedForConstraint,
    droppedForDiet,
  };
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
