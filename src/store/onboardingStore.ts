import { create } from 'zustand';

import type { VisionErrorKind } from '@/api/errors';
import type {
  BodyCompositionExtraction,
  BodyCompositionIssue,
} from '@/logic/bodyCompositionParser';
import { DEFAULT_SPLIT } from '@/logic/macros';
import type { SportId } from '@/constants/sports';
import type {
  ActivityLevel,
  ApplianceId,
  Goal,
  OnboardingIntent,
  Sex,
  TargetSource,
  Units,
} from '@/types';

export type BodyCompositionScanPhase = 'selected' | 'extracting' | 'review' | 'error';
export type MeasuredFlowOrigin = 'onboarding' | 'settings';
export type ApiKeyReturnIntent =
  | { kind: 'default-onboarding' }
  | { kind: 'energy-onboarding'; source: 'dexa' | 'inbody' }
  | { kind: 'energy-settings'; source: 'dexa' | 'inbody' };

/** Transient report evidence. It is never persisted or exported. */
export interface BodyCompositionScanDraft {
  phase: BodyCompositionScanPhase;
  photoUri: string;
  extraction: BodyCompositionExtraction | null;
  confidence: BodyCompositionExtraction['confidence'] | null;
  issues: readonly BodyCompositionIssue[];
  errorKind: VisionErrorKind | null;
}

/**
 * The onboarding draft. Held in memory only — nothing is written to the database
 * until the user reaches the results screen and taps through.
 */
interface OnboardingDraft {
  intents: readonly OnboardingIntent[];
  sex: Sex | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel | null;
  /** Optional refinement on the activity step. Empty means "not volunteered". */
  sports: readonly SportId[];
  goal: Goal | null;
  units: Units;
  /** True when the user chose to skip the API key step. */
  skippedKey: boolean;
  targetSource: TargetSource;
  /** Optional pacing set from the goal step's "set a target and pace" affordance. */
  targetWeightKg: number | null;
  weightGoalRateKgPerWeek: number | null;
  /** Meal prep tool ownership selected during onboarding. */
  selectedAppliances: readonly ApplianceId[];
  noAppliancesChosen: boolean;
  /** Starter pantry draft selections before review confirmation. */
  starterPantryDraftIds: readonly string[];
  /** Confirmed starter pantry items inserted or ready to insert. */
  starterPantryConfirmedIds: readonly string[];
}

interface OnboardingState extends OnboardingDraft {
  startingPoint: OnboardingIntent | null;
  completedBranches: readonly OnboardingIntent[];
  scanDraft: BodyCompositionScanDraft | null;
  returnIntent: ApiKeyReturnIntent;
  measuredFlowOrigin: MeasuredFlowOrigin;
  set: (patch: Partial<OnboardingDraft>) => void;
  selectStartingPoint: (intent: OnboardingIntent) => void;
  completeBranch: (intent: OnboardingIntent) => void;
  toggleIntent: (intent: OnboardingIntent) => void;
  toggleAppliance: (appliance: ApplianceId) => void;
  setNoAppliances: (noAppliances: boolean) => void;
  toggleStarterPantryDraft: (canonicalId: string) => void;
  confirmStarterPantry: (canonicalIds: readonly string[]) => void;
  clearStarterPantryDraft: () => void;
  selectScanPhoto: (photoUri: string) => void;
  startScanExtraction: () => void;
  receiveScanExtraction: (extraction: BodyCompositionExtraction) => void;
  failScanExtraction: (errorKind: VisionErrorKind) => void;
  clearScanDraft: () => void;
  setReturnIntent: (intent: ApiKeyReturnIntent) => void;
  consumeReturnIntent: () => ApiKeyReturnIntent;
  setMeasuredFlowOrigin: (origin: MeasuredFlowOrigin) => void;
  reset: () => void;
}

const EMPTY: OnboardingDraft = {
  intents: ['calories'],
  sex: null,
  age: null,
  heightCm: null,
  weightKg: null,
  activityLevel: null,
  sports: [],
  goal: null,
  units: 'metric',
  skippedKey: false,
  targetSource: 'estimated',
  targetWeightKg: null,
  weightGoalRateKgPerWeek: null,
  selectedAppliances: [],
  noAppliancesChosen: false,
  starterPantryDraftIds: [],
  starterPantryConfirmedIds: [],
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...EMPTY,
  startingPoint: null,
  completedBranches: [],
  scanDraft: null,
  returnIntent: { kind: 'default-onboarding' },
  measuredFlowOrigin: 'onboarding',
  set: (patch) => set((state) => {
    const nextSource = patch.targetSource;
    if (nextSource === undefined || nextSource === state.targetSource) return patch;

    const reviewedProvider = state.scanDraft?.extraction?.provider;
    const keepReviewedDraft = reviewedProvider === 'dexa' || reviewedProvider === 'inbody'
      ? nextSource === reviewedProvider
      : false;
    return keepReviewedDraft ? patch : { ...patch, scanDraft: null };
  }),
  selectStartingPoint: (intent) => set({
    intents: [intent],
    startingPoint: intent,
    completedBranches: [],
  }),
  completeBranch: (intent) => set((state) => ({
    intents: state.intents.includes(intent) ? state.intents : [...state.intents, intent],
    completedBranches: state.completedBranches.includes(intent)
      ? state.completedBranches
      : [...state.completedBranches, intent],
  })),
  toggleIntent: (intent) => set((state) => {
    const exists = state.intents.includes(intent);
    const updated = exists
      ? state.intents.filter((i) => i !== intent)
      : [...state.intents, intent];
    // Keep at least one intent selected
    return updated.length > 0 ? { intents: updated } : state;
  }),
  toggleAppliance: (appliance) => set((state) => {
    const exists = state.selectedAppliances.includes(appliance);
    const updated = exists
      ? state.selectedAppliances.filter((a) => a !== appliance)
      : [...state.selectedAppliances, appliance];
    return {
      selectedAppliances: updated,
      noAppliancesChosen: false,
    };
  }),
  setNoAppliances: (noAppliances) => set({
    noAppliancesChosen: noAppliances,
    selectedAppliances: noAppliances ? [] : [],
  }),
  toggleStarterPantryDraft: (canonicalId) => set((state) => {
    const exists = state.starterPantryDraftIds.includes(canonicalId);
    const updated = exists
      ? state.starterPantryDraftIds.filter((id) => id !== canonicalId)
      : [...state.starterPantryDraftIds, canonicalId];
    return { starterPantryDraftIds: updated };
  }),
  confirmStarterPantry: (canonicalIds) => set({
    starterPantryConfirmedIds: canonicalIds,
    starterPantryDraftIds: [],
  }),
  clearStarterPantryDraft: () => set({ starterPantryDraftIds: [] }),
  selectScanPhoto: (photoUri) => set({
    scanDraft: {
      phase: 'selected',
      photoUri,
      extraction: null,
      confidence: null,
      issues: [],
      errorKind: null,
    },
  }),
  startScanExtraction: () => set((state) => state.scanDraft === null
    ? state
    : {
        scanDraft: {
          ...state.scanDraft,
          phase: 'extracting',
          errorKind: null,
        },
      }),
  receiveScanExtraction: (extraction) => set((state) => state.scanDraft === null
    ? state
    : {
        scanDraft: {
          ...state.scanDraft,
          phase: 'review',
          extraction,
          confidence: extraction.confidence,
          issues: extraction.issues,
          errorKind: null,
        },
      }),
  failScanExtraction: (errorKind) => set((state) => state.scanDraft === null
    ? state
    : {
        scanDraft: {
          ...state.scanDraft,
          phase: 'error',
          errorKind,
        },
      }),
  clearScanDraft: () => set({ scanDraft: null }),
  setReturnIntent: (returnIntent) => set({ returnIntent }),
  consumeReturnIntent: () => {
    const intent = get().returnIntent;
    set({ returnIntent: { kind: 'default-onboarding' } });
    return intent;
  },
  setMeasuredFlowOrigin: (measuredFlowOrigin) => set({ measuredFlowOrigin }),
  reset: () => set({
    ...EMPTY,
    startingPoint: null,
    completedBranches: [],
    scanDraft: null,
    returnIntent: { kind: 'default-onboarding' },
    measuredFlowOrigin: 'onboarding',
  }),
}));

export function resolveApiKeyReturnIntent(value: unknown): ApiKeyReturnIntent {
  if (!value || typeof value !== 'object') return { kind: 'default-onboarding' };
  const record = value as Record<string, unknown>;
  if (record.kind === 'default-onboarding') return { kind: 'default-onboarding' };
  if ((record.kind === 'energy-onboarding' || record.kind === 'energy-settings')
    && (record.source === 'dexa' || record.source === 'inbody')) {
    return { kind: record.kind, source: record.source };
  }
  return { kind: 'default-onboarding' };
}

export const ONBOARDING_SPLIT = DEFAULT_SPLIT;

/**
 * The standard route remains the default way into onboarding. Energy-source
 * routes are opt-in alternatives for someone who already has that input.
 */
export const ONBOARDING_ENTRY_ROUTES: Readonly<Record<TargetSource, string>> = {
  estimated: '/onboarding/sex',
  dexa: '/onboarding/energy',
  inbody: '/onboarding/energy',
  stated: '/onboarding/energy',
};

/** All potential onboarding steps across all intent branches. */
export const ALL_ONBOARDING_STEPS = [
  'welcome',
  'goals',
  'sex',
  'age',
  'height',
  'weight',
  'activity',
  'goal',
  'api-key',
  'dietary',
  'results',
  'appliances',
  'starter-pantry',
  'first-plan',
] as const;

/** Ordered standard calorie step routes, preserved for backwards compatibility. */
export const ONBOARDING_STEPS = [
  'welcome',
  'sex',
  'age',
  'height',
  'weight',
  'activity',
  'goal',
  'api-key',
  'dietary',
  'results',
] as const;

export type OnboardingStep = (typeof ALL_ONBOARDING_STEPS)[number];

/**
 * Resolves the dynamic sequence of steps for the given selected intents.
 */
export function getOnboardingSteps(
  intents: readonly OnboardingIntent[],
  startingPoint: OnboardingIntent | null = null,
  completedBranches: readonly OnboardingIntent[] = [],
): readonly OnboardingStep[] {
  const hasCalories = intents.includes('calories');
  const hasMealPrep = intents.includes('meal_prep');

  if (hasCalories && hasMealPrep) {
    const calorieSteps: readonly OnboardingStep[] = [
      'sex', 'age', 'height', 'weight', 'activity', 'goal', 'api-key', 'results',
    ];
    const kitchenSteps: readonly OnboardingStep[] = [
      'dietary', 'appliances', 'starter-pantry', 'first-plan',
    ];
    const routeOrigin = startingPoint ?? completedBranches[0] ?? intents[0] ?? 'calories';
    const first = routeOrigin === 'meal_prep' ? kitchenSteps : calorieSteps;
    const second = routeOrigin === 'meal_prep' ? calorieSteps : kitchenSteps;
    return ['welcome', ...first, ...second];
  }

  if (hasMealPrep) {
    return [
      'welcome',
      'dietary',
      'appliances',
      'starter-pantry',
      'first-plan',
    ];
  }

  // Calories only or default
  return [
    'welcome',
    'sex',
    'age',
    'height',
    'weight',
    'activity',
    'goal',
    'api-key',
    'dietary',
    'results',
  ];
}

export function stepIndex(
  step: OnboardingStep,
  intents?: readonly OnboardingIntent[],
  startingPoint?: OnboardingIntent | null,
  completedBranches?: readonly OnboardingIntent[],
): number {
  if (intents && intents.length > 0) {
    const steps = getOnboardingSteps(intents, startingPoint, completedBranches);
    const idx = steps.indexOf(step);
    if (idx >= 0) return idx;
  }
  const defaultIdx = (ONBOARDING_STEPS as readonly string[]).indexOf(step);
  if (defaultIdx >= 0) return defaultIdx;
  return ALL_ONBOARDING_STEPS.indexOf(step);
}
