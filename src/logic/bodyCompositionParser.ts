import type {
  BodyCompositionConfidence,
  BodyCompositionPromptResponse,
  BodyCompositionProvider,
  BodyCompositionRawNumber,
} from '@/api/bodyCompositionPrompt';
import { lbToKgExact } from '@/logic/units';

export const BODY_COMPOSITION_PREFILL_BOUNDS = {
  weightKg: { exclusiveMin: 20 },
  bodyFatPct: { min: 3, max: 60 },
} as const;

export const MASS_CONTRADICTION_ABSOLUTE_KG = 1;
export const MASS_CONTRADICTION_PROPORTION = 0.02;

export type BodyCompositionNumericField =
  | 'weightKg'
  | 'bodyFatPct'
  | 'leanTissueKg'
  | 'boneMineralContentKg'
  | 'fatFreeMassKg'
  | 'bmrKcal';

export type BodyCompositionIssueCode =
  | 'invalid_value'
  | 'unsupported_unit'
  | 'outside_prefill_bounds'
  | 'exceeds_weight';

export interface BodyCompositionIssue {
  field: BodyCompositionNumericField;
  code: BodyCompositionIssueCode;
  message: string;
  receivedValue: number | null;
}

export interface BodyCompositionExtraction {
  provider: BodyCompositionProvider;
  weightKg: number | null;
  bodyFatPct: number | null;
  leanTissueKg: number | null;
  boneMineralContentKg: number | null;
  fatFreeMassKg: number | null;
  bmrKcal: number | null;
  confidence: BodyCompositionConfidence;
  issues: readonly BodyCompositionIssue[];
}

interface ParsedCandidate {
  value: number | null;
  issue: BodyCompositionIssue | null;
}

const MASS_FIELDS = [
  'weightKg',
  'leanTissueKg',
  'boneMineralContentKg',
  'fatFreeMassKg',
] as const satisfies readonly BodyCompositionNumericField[];

const MASS_PATTERN = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(kg|kgs|kilograms?|lb|lbs|pounds?)?$/i;
const PERCENT_PATTERN = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(%)?$/;
const BMR_PATTERN = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(kcal(?:\s*\/\s*day)?)?$/i;

/**
 * Converts provider output into review candidates. It does not derive domain
 * values and it never mutates a value to make it plausible.
 */
export function normalizeBodyComposition(
  raw: BodyCompositionPromptResponse,
): BodyCompositionExtraction {
  const parsed = new Map<BodyCompositionNumericField, ParsedCandidate>();
  for (const field of MASS_FIELDS) parsed.set(field, parseMass(field, raw[field]));
  parsed.set('bodyFatPct', parseScalar('bodyFatPct', raw.bodyFatPct, PERCENT_PATTERN));
  parsed.set('bmrKcal', parseScalar('bmrKcal', raw.bmrKcal, BMR_PATTERN));

  const issues = [...parsed.values()]
    .map((candidate) => candidate.issue)
    .filter((issue): issue is BodyCompositionIssue => issue !== null);

  let weightKg = valueFor(parsed, 'weightKg');
  if (weightKg !== null && weightKg <= BODY_COMPOSITION_PREFILL_BOUNDS.weightKg.exclusiveMin) {
    issues.push({
      field: 'weightKg',
      code: 'outside_prefill_bounds',
      message: 'Check the report weight before using it.',
      receivedValue: weightKg,
    });
    weightKg = null;
  }

  let bodyFatPct = valueFor(parsed, 'bodyFatPct');
  if (bodyFatPct !== null && (
    bodyFatPct < BODY_COMPOSITION_PREFILL_BOUNDS.bodyFatPct.min
    || bodyFatPct > BODY_COMPOSITION_PREFILL_BOUNDS.bodyFatPct.max
  )) {
    issues.push({
      field: 'bodyFatPct',
      code: 'outside_prefill_bounds',
      message: 'Check the body fat percentage before using it.',
      receivedValue: bodyFatPct,
    });
    bodyFatPct = null;
  }

  const leanTissueKg = valueFor(parsed, 'leanTissueKg');
  const boneMineralContentKg = valueFor(parsed, 'boneMineralContentKg');
  const fatFreeMassKg = valueFor(parsed, 'fatFreeMassKg');

  if (weightKg !== null) {
    const tolerance = contradictionTolerance(weightKg);
    if (fatFreeMassKg !== null && fatFreeMassKg > weightKg + tolerance) {
      issues.push(exceedsWeightIssue('fatFreeMassKg', fatFreeMassKg));
    }
    if (
      leanTissueKg !== null
      && boneMineralContentKg !== null
      && leanTissueKg + boneMineralContentKg > weightKg + tolerance
    ) {
      issues.push(exceedsWeightIssue('leanTissueKg', leanTissueKg));
    }
  }

  return {
    provider: raw.provider,
    weightKg,
    bodyFatPct,
    leanTissueKg,
    boneMineralContentKg,
    fatFreeMassKg,
    bmrKcal: valueFor(parsed, 'bmrKcal'),
    confidence: raw.confidence,
    issues,
  };
}

/** Manual confirmation keeps positive finite outliers for domain warnings. */
export function sanitizeConfirmedBodyCompositionNumber(value: number | string | null): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseMass(
  field: Extract<BodyCompositionNumericField, 'weightKg' | 'leanTissueKg' | 'boneMineralContentKg' | 'fatFreeMassKg'>,
  raw: BodyCompositionRawNumber,
): ParsedCandidate {
  if (raw === null) return { value: null, issue: null };
  if (typeof raw === 'number') return positiveNumber(field, raw);

  const match = MASS_PATTERN.exec(raw.trim());
  if (match === null) return invalidString(field, raw);
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric) || numeric <= 0) return invalidNumber(field, numeric);

  const unit = match[2]?.toLowerCase();
  if (unit === undefined || unit === 'kg' || unit === 'kgs' || unit.startsWith('kilogram')) {
    return { value: numeric, issue: null };
  }
  if (unit === 'lb' || unit === 'lbs' || unit.startsWith('pound')) {
    return { value: lbToKgExact(numeric), issue: null };
  }
  return unsupportedUnit(field, numeric);
}

function parseScalar(
  field: Extract<BodyCompositionNumericField, 'bodyFatPct' | 'bmrKcal'>,
  raw: BodyCompositionRawNumber,
  pattern: RegExp,
): ParsedCandidate {
  if (raw === null) return { value: null, issue: null };
  if (typeof raw === 'number') return positiveNumber(field, raw);

  const match = pattern.exec(raw.trim());
  if (match === null) return invalidString(field, raw);
  const numeric = Number(match[1]);
  return positiveNumber(field, numeric);
}

function positiveNumber(field: BodyCompositionNumericField, value: number): ParsedCandidate {
  return Number.isFinite(value) && value > 0
    ? { value, issue: null }
    : invalidNumber(field, value);
}

function invalidString(field: BodyCompositionNumericField, raw: string): ParsedCandidate {
  const numericPrefix = Number.parseFloat(raw);
  const hasNumericPrefix = Number.isFinite(numericPrefix);
  return hasNumericPrefix
    ? unsupportedUnit(field, numericPrefix)
    : invalidNumber(field, null);
}

function invalidNumber(field: BodyCompositionNumericField, value: number | null): ParsedCandidate {
  return {
    value: null,
    issue: {
      field,
      code: 'invalid_value',
      message: 'This report value could not be used. Enter it manually if it is legible.',
      receivedValue: Number.isFinite(value) ? value : null,
    },
  };
}

function unsupportedUnit(field: BodyCompositionNumericField, value: number): ParsedCandidate {
  return {
    value: null,
    issue: {
      field,
      code: 'unsupported_unit',
      message: 'The unit on this report value needs manual checking.',
      receivedValue: value,
    },
  };
}

function valueFor(
  parsed: ReadonlyMap<BodyCompositionNumericField, ParsedCandidate>,
  field: BodyCompositionNumericField,
): number | null {
  return parsed.get(field)?.value ?? null;
}

function contradictionTolerance(weightKg: number): number {
  return Math.max(MASS_CONTRADICTION_ABSOLUTE_KG, weightKg * MASS_CONTRADICTION_PROPORTION);
}

function exceedsWeightIssue(
  field: Extract<BodyCompositionNumericField, 'leanTissueKg' | 'fatFreeMassKg'>,
  value: number,
): BodyCompositionIssue {
  return {
    field,
    code: 'exceeds_weight',
    message: 'This mass is higher than the report weight. Check both fields.',
    receivedValue: value,
  };
}
