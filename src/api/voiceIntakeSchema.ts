import { FULLNESS_LEVELS, MEASURE_UNITS, type Fullness, type Location, type MeasureUnit } from '@/types';
import { parseVoiceTranscript, type ParsedTranscript, type ParsedVoiceItem } from '@/logic/voicePantryParser';

export interface VoiceEvidenceField<T> {
  value: T | null;
  source_span: string | null;
}

/** The provider can describe evidence, but it cannot name pantry identities. */
export interface VoiceProviderItem {
  source_span: string;
  name: VoiceEvidenceField<string>;
  container_count: VoiceEvidenceField<number>;
  amount: VoiceEvidenceField<number>;
  unit: VoiceEvidenceField<MeasureUnit>;
  location_id: VoiceEvidenceField<string>;
  fullness: VoiceEvidenceField<Fullness>;
  opened: VoiceEvidenceField<boolean>;
  approximate: VoiceEvidenceField<boolean>;
  acquisition_date: VoiceEvidenceField<string>;
}

export interface VoiceProviderResponse {
  items: VoiceProviderItem[];
}

export const VOICE_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      maxItems: 80,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'source_span', 'name', 'container_count', 'amount', 'unit',
          'location_id', 'fullness', 'opened', 'approximate', 'acquisition_date',
        ],
        properties: {
          source_span: { type: 'string' },
          name: evidenceSchema({ type: 'string' }),
          container_count: evidenceSchema({ type: 'number' }),
          amount: evidenceSchema({ type: 'number' }),
          unit: evidenceSchema({ type: 'string', enum: MEASURE_UNITS }),
          location_id: evidenceSchema({ type: 'string' }),
          fullness: evidenceSchema({ type: 'string', enum: FULLNESS_LEVELS }),
          opened: evidenceSchema({ type: 'boolean' }),
          approximate: evidenceSchema({ type: 'boolean' }),
          acquisition_date: evidenceSchema({ type: 'string' }),
        },
      },
    },
  },
} as const;

export type VoiceValidationRejection =
  | 'shape'
  | 'invented_span'
  | 'overlap'
  | 'instruction'
  | 'unsupported_name'
  | 'unsupported_field'
  | 'unsupported_location'
  | 'unsupported_date';

export interface ValidatedVoiceCandidate {
  range: { start: number; end: number };
  item: ParsedVoiceItem;
}

export interface VoiceValidationResult {
  accepted: ValidatedVoiceCandidate[];
  rejected: VoiceValidationRejection[];
}

const ITEM_KEYS = [
  'source_span', 'name', 'container_count', 'amount', 'unit', 'location_id',
  'fullness', 'opened', 'approximate', 'acquisition_date',
] as const;
const FIELD_KEYS = ['value', 'source_span'] as const;

/**
 * Treats model output as a proposal, then re-derives every fact locally from
 * its exact source span. A model can improve run-on segmentation; it cannot
 * invent a quantity, location, date, identity, alias, or mutation.
 */
export function validateVoiceProviderResponse(
  value: unknown,
  transcript: string,
  locations: readonly Pick<Location, 'id' | 'name'>[],
): VoiceValidationResult {
  if (!isRecord(value) || !hasOnlyKeys(value, ['items']) || !Array.isArray(value['items'])) {
    return { accepted: [], rejected: ['shape'] };
  }

  const accepted: ValidatedVoiceCandidate[] = [];
  const rejected: VoiceValidationRejection[] = [];
  const claimedRanges: { start: number; end: number }[] = [];

  for (const raw of value['items'].slice(0, 80)) {
    const shaped = parseItemShape(raw);
    if (!shaped) {
      rejected.push('shape');
      continue;
    }
    const range = findUnclaimedExactSpan(transcript, shaped.source_span, claimedRanges);
    if (!range) {
      rejected.push(transcript.includes(shaped.source_span) ? 'overlap' : 'invented_span');
      continue;
    }
    if (isInstructionSpan(shaped.source_span)) {
      rejected.push('instruction');
      continue;
    }

    const locallyParsed = parseVoiceTranscript(shaped.source_span);
    if (locallyParsed.items.length !== 1) {
      rejected.push('unsupported_name');
      continue;
    }
    const local = locallyParsed.items[0]!;
    if (!fieldSupported(shaped.name, shaped.source_span) ||
        typeof shaped.name.value !== 'string' ||
        !shaped.name.source_span ||
        !normalize(shaped.name.source_span).includes(normalize(shaped.name.value)) ||
        normalize(shaped.name.value) !== normalize(local.name)) {
      rejected.push('unsupported_name');
      continue;
    }

    if (
      !numberFieldSupported(shaped.container_count, shaped.source_span, local.quantity.containerCount) ||
      !numberFieldSupported(shaped.amount, shaped.source_span, local.quantity.amount) ||
      !scalarFieldSupported(shaped.unit, shaped.source_span, local.quantity.unit, MEASURE_UNITS) ||
      !scalarFieldSupported(shaped.fullness, shaped.source_span, local.fullness, FULLNESS_LEVELS) ||
      !scalarFieldSupported(shaped.opened, shaped.source_span, local.opened) ||
      !scalarFieldSupported(shaped.approximate, shaped.source_span, local.quantity.approximate)
    ) {
      rejected.push('unsupported_field');
    }

    const proposedLocationId = validateLocationField(shaped.location_id, shaped.source_span, locations);
    if (proposedLocationId === false) {
      rejected.push('unsupported_location');
    }
    // Acquisition dates are intentionally unsupported until the deterministic
    // date parser can independently prove relative and locale-specific dates.
    if (shaped.acquisition_date.value !== null || shaped.acquisition_date.source_span !== null) {
      rejected.push('unsupported_date');
    }

    const locationId = proposedLocationId === false ? null : proposedLocationId;
    const candidate: ParsedVoiceItem = locationId
      ? { ...local, locationId }
      : local;
    accepted.push({ range, item: candidate });
    claimedRanges.push(range);
  }

  return { accepted, rejected };
}

/** Parses provider-approved spans and every uncovered span through local code. */
export function reconcileVoiceParsing(
  transcript: string,
  validation: VoiceValidationResult,
  knownNames: readonly string[] = [],
): ParsedTranscript {
  if (validation.accepted.length === 0) {
    return filterInstructionCandidates(parseVoiceTranscript(transcript, { knownNames }));
  }

  // `String#indexOf` reports UTF-16 offsets, so split into UTF-16 code units
  // too; code-point iteration would corrupt ranges after emoji/surrogates.
  const characters = transcript.split('');
  for (const { range } of validation.accepted) {
    for (let index = range.start; index < range.end; index += 1) characters[index] = ' ';
    if (range.start < characters.length) characters[range.start] = ',';
  }
  const local = filterInstructionCandidates(parseVoiceTranscript(characters.join(''), { knownNames }));
  const ordered = [
    ...validation.accepted.map(({ range, item }) => ({ index: range.start, item })),
    ...local.items.map((item) => ({ index: bestSpanIndex(transcript, item.span), item })),
  ].sort((left, right) => left.index - right.index);

  return {
    items: ordered.map(({ item }) => item),
    unused: [...local.unused],
  };
}

export function isInstructionSpan(span: string): boolean {
  return /\bignore\s+(?:(?:all|any|the|these)\s+)?(?:(?:previous|prior|above)\s+)?(?:rules?|instructions?|prompts?)\b/i.test(span) ||
    /\b(?:delete|remove|alter|modify|merge|overwrite)\s+(?:the\s+|all\s+|my\s+|existing\s+)?(?:pantry|stock|inventory|database|items?)\b/i.test(span) ||
    /\bcreate\s+(?:a\s+|an\s+)?(?:canonical|alias)\b/i.test(span);
}

function evidenceSchema(value: object): object {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['value', 'source_span'],
    properties: {
      value: { anyOf: [value, { type: 'null' }] },
      source_span: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    },
  };
}

function parseItemShape(value: unknown): VoiceProviderItem | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ITEM_KEYS) ||
      typeof value['source_span'] !== 'string' || value['source_span'].length === 0) return null;
  for (const key of ITEM_KEYS.slice(1)) {
    const field = value[key];
    if (!isRecord(field) || !hasOnlyKeys(field, FIELD_KEYS) ||
        !('value' in field) ||
        !(typeof field['source_span'] === 'string' || field['source_span'] === null)) return null;
  }
  return value as unknown as VoiceProviderItem;
}

function fieldSupported<T>(field: VoiceEvidenceField<T>, itemSpan: string): boolean {
  return field.value === null
    ? field.source_span === null
    : typeof field.source_span === 'string' && field.source_span.length > 0 && itemSpan.includes(field.source_span);
}

function numberFieldSupported(
  field: VoiceEvidenceField<number>,
  itemSpan: string,
  local: number | null,
): boolean {
  if (!fieldSupported(field, itemSpan)) return false;
  if (field.value === null) return true;
  return typeof field.value === 'number' && Number.isFinite(field.value) && local !== null &&
    Math.abs(field.value - local) < 0.000_001;
}

function scalarFieldSupported<T extends string | boolean>(
  field: VoiceEvidenceField<T>,
  itemSpan: string,
  local: T | null,
  allowed?: readonly T[],
): boolean {
  if (!fieldSupported(field, itemSpan)) return false;
  if (field.value === null) return true;
  if (allowed && !allowed.includes(field.value)) return false;
  return field.value === local;
}

function validateLocationField(
  field: VoiceEvidenceField<string>,
  itemSpan: string,
  locations: readonly Pick<Location, 'id' | 'name'>[],
): string | null | false {
  if (!fieldSupported(field, itemSpan)) return false;
  if (field.value === null) return null;
  const location = locations.find(({ id }) => id === field.value);
  if (!location || !field.source_span) return false;
  const evidence = normalize(field.source_span);
  return evidence.includes(normalize(location.name)) || evidence.includes(normalize(location.id))
    ? location.id
    : false;
}

function findUnclaimedExactSpan(
  transcript: string,
  span: string,
  claimed: readonly { start: number; end: number }[],
): { start: number; end: number } | null {
  let start = transcript.indexOf(span);
  while (start >= 0) {
    const range = { start, end: start + span.length };
    if (!claimed.some((other) => range.start < other.end && range.end > other.start)) return range;
    start = transcript.indexOf(span, start + 1);
  }
  return null;
}

function filterInstructionCandidates(parsed: ParsedTranscript): ParsedTranscript {
  const kept = parsed.items.filter((item) => !isInstructionSpan(item.span));
  const rejected = parsed.items.filter((item) => isInstructionSpan(item.span)).map((item) => item.span);
  return { items: kept, unused: [...parsed.unused, ...rejected] };
}

function bestSpanIndex(transcript: string, span: string): number {
  const index = transcript.indexOf(span);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function normalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
}
