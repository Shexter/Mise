import type {
  Goal,
  SavedSuggestionPreference,
  SuggestionBaseIntent,
  SuggestionPrepSpeed,
  TonightSuggestionPreference,
} from '@/types';

/** Baseline dish-scorer weights. Policies multiply these rather than branching by id. */
export const BASE_VALUE_AT_RISK_MULTIPLIER = 1;
export const BASE_EXPIRY_PRESSURE_MULTIPLIER = 1;
export const BASE_EFFORT_MULTIPLIER = 1;
export const BASE_CALORIE_FIT_MULTIPLIER = 1;
export const BASE_FAMILIARITY_MULTIPLIER = 1;
export const BASE_PROTEIN_DENSITY_MULTIPLIER = 0;

export const USE_IT_UP_VALUE_AT_RISK_MULTIPLIER = 1.6;
export const USE_IT_UP_EXPIRY_PRESSURE_MULTIPLIER = 1.4;
export const PROTEIN_FORWARD_DENSITY_MULTIPLIER = 1.25;
export const LIGHTER_PORTIONS_CALORIE_FIT_MULTIPLIER = 1.6;
export const FAMILIAR_FAVOURITES_MULTIPLIER = 2;
export const QUICK_EFFORT_MULTIPLIER = 4;
/** A quick cue is factual only at or below this model-provided effort estimate. */
export const QUICK_EFFORT_MINUTES = 25;
/** Never recommend less than half a serving from an automatically-derived portion. */
export const MIN_PORTION_SERVINGS = 0.5;

export interface SuggestionScoreMultipliers {
  valueAtRisk: number;
  expiryPressure: number;
  effort: number;
  calorieFit: number;
  familiarity: number;
  proteinDensity: number;
}

export interface SuggestionIntentPolicy {
  id: SuggestionBaseIntent;
  label: string;
  description: string;
  promptFraming: string;
  portionPolicy: 'standard' | 'lighter';
  multipliers: Omit<SuggestionScoreMultipliers, 'effort'>;
}

export interface SuggestionSpeedPolicy {
  id: SuggestionPrepSpeed;
  label: string;
  description: string;
  promptFraming: string | null;
  effortMultiplier: number;
}

const BASE_MULTIPLIERS: Omit<SuggestionScoreMultipliers, 'effort'> = {
  valueAtRisk: BASE_VALUE_AT_RISK_MULTIPLIER,
  expiryPressure: BASE_EXPIRY_PRESSURE_MULTIPLIER,
  calorieFit: BASE_CALORIE_FIT_MULTIPLIER,
  familiarity: BASE_FAMILIARITY_MULTIPLIER,
  proteinDensity: BASE_PROTEIN_DENSITY_MULTIPLIER,
};

/** Fixed, inspectable choices. Copy describes selection behaviour, never an outcome. */
export const SUGGESTION_INTENT_POLICIES: Record<SuggestionBaseIntent, SuggestionIntentPolicy> = {
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    description: 'A balanced starting point for tonight.',
    promptFraming: 'Keep a balanced mix of practical, varied dinner ideas.',
    portionPolicy: 'standard',
    multipliers: BASE_MULTIPLIERS,
  },
  use_it_up: {
    id: 'use_it_up',
    label: 'Use it up',
    description: 'Puts what needs using first.',
    promptFraming: 'Lean harder toward the valuable ingredients that need using soon.',
    portionPolicy: 'standard',
    multipliers: {
      ...BASE_MULTIPLIERS,
      valueAtRisk: USE_IT_UP_VALUE_AT_RISK_MULTIPLIER,
      expiryPressure: USE_IT_UP_EXPIRY_PRESSURE_MULTIPLIER,
    },
  },
  protein_forward: {
    id: 'protein_forward',
    label: 'Protein-forward',
    description: 'Leans toward protein-forward ideas when estimates support it.',
    promptFraming: 'Where the kitchen supports it, prefer protein-forward dinner ideas.',
    portionPolicy: 'standard',
    multipliers: { ...BASE_MULTIPLIERS, proteinDensity: PROTEIN_FORWARD_DENSITY_MULTIPLIER },
  },
  lighter_portions: {
    id: 'lighter_portions',
    label: 'Lighter portions',
    description: 'Sizes portions against what is left today.',
    promptFraming: 'Offer portions that sit comfortably within today’s remaining calories when possible.',
    portionPolicy: 'lighter',
    multipliers: { ...BASE_MULTIPLIERS, calorieFit: LIGHTER_PORTIONS_CALORIE_FIT_MULTIPLIER },
  },
  familiar_favourites: {
    id: 'familiar_favourites',
    label: 'Familiar favourites',
    description: 'Leans toward styles you already cook.',
    promptFraming: 'Lean toward the person’s usual cooking style while keeping the ideas varied.',
    portionPolicy: 'standard',
    multipliers: { ...BASE_MULTIPLIERS, familiarity: FAMILIAR_FAVOURITES_MULTIPLIER },
  },
};

export const SUGGESTION_SPEED_POLICIES: Record<SuggestionPrepSpeed, SuggestionSpeedPolicy> = {
  standard: {
    id: 'standard',
    label: 'Standard',
    description: 'No extra time preference.',
    promptFraming: null,
    effortMultiplier: BASE_EFFORT_MULTIPLIER,
  },
  quick: {
    id: 'quick',
    label: 'Quick',
    description: 'Leans toward ideas with less active time.',
    promptFraming: `Prefer ideas with about ${QUICK_EFFORT_MINUTES} minutes of active time or less where possible.`,
    effortMultiplier: QUICK_EFFORT_MULTIPLIER,
  },
};

export function defaultBaseIntent(goal: Goal): SuggestionBaseIntent {
  switch (goal) {
    case 'lose': return 'lighter_portions';
    case 'gain': return 'protein_forward';
    case 'maintain': return 'balanced';
  }
}

export function resolveTonightPreference(
  goal: Goal,
  saved: SavedSuggestionPreference | null,
): TonightSuggestionPreference {
  if (saved) {
    return { baseIntent: saved.baseIntent, prepSpeed: saved.prepSpeed, source: 'saved' };
  }
  return { baseIntent: defaultBaseIntent(goal), prepSpeed: 'standard', source: 'profile_default' };
}

export function scoreMultipliersFor(
  preference: TonightSuggestionPreference | null,
): SuggestionScoreMultipliers {
  const intent = SUGGESTION_INTENT_POLICIES[preference?.baseIntent ?? 'balanced'];
  const speed = SUGGESTION_SPEED_POLICIES[preference?.prepSpeed ?? 'standard'];
  return { ...intent.multipliers, effort: speed.effortMultiplier };
}

export function promptFramingFor(
  preference: TonightSuggestionPreference,
): readonly string[] {
  const intent = SUGGESTION_INTENT_POLICIES[preference.baseIntent];
  const speed = SUGGESTION_SPEED_POLICIES[preference.prepSpeed];
  return speed.promptFraming ? [intent.promptFraming, speed.promptFraming] : [intent.promptFraming];
}
