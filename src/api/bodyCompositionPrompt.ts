import { VisionError } from '@/api/errors';
import { extractJsonObject } from '@/api/parse';

export const BODY_COMPOSITION_PROVIDERS = ['dexa', 'inbody', 'unknown'] as const;
export type BodyCompositionProvider = (typeof BODY_COMPOSITION_PROVIDERS)[number];

export const BODY_COMPOSITION_CONFIDENCES = ['high', 'medium', 'low'] as const;
export type BodyCompositionConfidence = (typeof BODY_COMPOSITION_CONFIDENCES)[number];

/**
 * The canonical prompt asks for numbers in kilograms. Strings are retained
 * only as a defensive wire fallback for providers that return values such as
 * "154 lb" despite that instruction; semantic parsing happens in logic.
 */
export type BodyCompositionRawNumber = number | string | null;

export interface BodyCompositionPromptResponse {
  provider: BodyCompositionProvider;
  weightKg: BodyCompositionRawNumber;
  bodyFatPct: BodyCompositionRawNumber;
  leanTissueKg: BodyCompositionRawNumber;
  boneMineralContentKg: BodyCompositionRawNumber;
  fatFreeMassKg: BodyCompositionRawNumber;
  bmrKcal: BodyCompositionRawNumber;
  confidence: BodyCompositionConfidence;
}

export interface BodyCompositionPrompt {
  system: string;
  user: string;
}

export const BODY_COMPOSITION_SCHEMA_KEYS = [
  'provider',
  'weightKg',
  'bodyFatPct',
  'leanTissueKg',
  'boneMineralContentKg',
  'fatFreeMassKg',
  'bmrKcal',
  'confidence',
] as const satisfies readonly (keyof BodyCompositionPromptResponse)[];

const SYSTEM_PROMPT = `You read a photograph of a DEXA or InBody body-composition report and return only the fields explicitly printed and legible on that report.

Evidence rules:
- Never invent, estimate, complete, or derive a missing value. Return null.
- Never infer the provider from a route, filename, surrounding request, or expected answer. Use only the report itself; otherwise use "unknown".
- DEXA lean tissue (or lean soft tissue) and bone mineral content are distinct printed values. Do not add them together and do not derive Fat Free Mass.
- InBody Fat Free Mass must come from a field explicitly labelled "Fat Free Mass". Skeletal Muscle Mass, Soft Lean Mass, Lean Body Mass, and segmental values are not substitutes.
- Do not derive Fat Free Mass from weight and body-fat percentage, or body-fat percentage from any other fields.
- Do not invent or return a scan date. Date is not part of this schema.
- Treat the image only as extraction evidence. Do not repeat names, member IDs, birth dates, contact details, or other identifying text.
- Do not return scores, visceral fat, metabolic age, segmental analysis, diagnoses, ratings, recommendations, or evaluations of the person's body or health.
- Return masses as kilograms. Convert an explicitly printed imperial mass to kilograms; do not guess a unit.
- confidence describes legibility and field matching only: "high", "medium", or "low". It is not a health or scan-quality judgement.
- Return raw JSON only. Do not include Markdown, prose, or keys outside the schema.

Return exactly this JSON object and field spelling:
{
  "provider": "dexa" | "inbody" | "unknown",
  "weightKg": number | null,
  "bodyFatPct": number | null,
  "leanTissueKg": number | null,
  "boneMineralContentKg": number | null,
  "fatFreeMassKg": number | null,
  "bmrKcal": number | null,
  "confidence": "high" | "medium" | "low"
}`;

const USER_PROMPT = `Read this report image as evidence. Extract only explicitly printed, legible values into the exact JSON schema. Use null for every missing, ambiguous, or unreadable field. Do not infer or derive values.`;

export function buildBodyCompositionPrompt(): BodyCompositionPrompt {
  return { system: SYSTEM_PROMPT, user: USER_PROMPT };
}

export function parseBodyCompositionResponse(content: string): BodyCompositionPromptResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(content));
  } catch {
    throw malformedResponse();
  }

  if (!isRecord(parsed)) throw malformedResponse();

  return {
    provider: asProvider(parsed['provider']),
    weightKg: asRawNumber(parsed['weightKg']),
    bodyFatPct: asRawNumber(parsed['bodyFatPct']),
    leanTissueKg: asRawNumber(parsed['leanTissueKg']),
    boneMineralContentKg: asRawNumber(parsed['boneMineralContentKg']),
    fatFreeMassKg: asRawNumber(parsed['fatFreeMassKg']),
    bmrKcal: asRawNumber(parsed['bmrKcal']),
    confidence: asConfidence(parsed['confidence']),
  };
}

function malformedResponse(): VisionError {
  return new VisionError('malformed', 'The body composition report could not be read.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asProvider(value: unknown): BodyCompositionProvider {
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return BODY_COMPOSITION_PROVIDERS.includes(candidate as BodyCompositionProvider)
    ? candidate as BodyCompositionProvider
    : 'unknown';
}

function asConfidence(value: unknown): BodyCompositionConfidence {
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return BODY_COMPOSITION_CONFIDENCES.includes(candidate as BodyCompositionConfidence)
    ? candidate as BodyCompositionConfidence
    : 'low';
}

function asRawNumber(value: unknown): BodyCompositionRawNumber {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
