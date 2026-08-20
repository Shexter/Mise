import { create } from 'zustand';

import type { VisionErrorKind } from '@/api/errors';
import type {
  BodyCompositionExtraction,
  BodyCompositionIssue,
} from '@/logic/bodyCompositionParser';
import { DEFAULT_SPLIT } from '@/logic/macros';
import type { ActivityLevel, Goal, Sex, TargetSource, Units } from '@/types';

export type BodyCompositionScanPhase = 'selected' | 'extracting' | 'review' | 'error';

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
  sex: Sex | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel | null;
  goal: Goal | null;
  units: Units;
  /** True when the user chose to skip the API key step. */
  skippedKey: boolean;
  targetSource: TargetSource;
  /** Optional pacing set from the goal step's "set a target and pace" affordance. */
  targetWeightKg: number | null;
  weightGoalRateKgPerWeek: number | null;
}

interface OnboardingState extends OnboardingDraft {
  scanDraft: BodyCompositionScanDraft | null;
  set: (patch: Partial<OnboardingDraft>) => void;
  selectScanPhoto: (photoUri: string) => void;
  startScanExtraction: () => void;
  receiveScanExtraction: (extraction: BodyCompositionExtraction) => void;
  failScanExtraction: (errorKind: VisionErrorKind) => void;
  clearScanDraft: () => void;
  reset: () => void;
}

const EMPTY: OnboardingDraft = {
  sex: null,
  age: null,
  heightCm: null,
  weightKg: null,
  activityLevel: null,
  goal: null,
  units: 'metric',
  skippedKey: false,
  targetSource: 'estimated',
  targetWeightKg: null,
  weightGoalRateKgPerWeek: null,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...EMPTY,
  scanDraft: null,
  set: (patch) => set((state) => {
    const nextSource = patch.targetSource;
    if (nextSource === undefined || nextSource === state.targetSource) return patch;

    const reviewedProvider = state.scanDraft?.extraction?.provider;
    const keepReviewedDraft = reviewedProvider === 'dexa' || reviewedProvider === 'inbody'
      ? nextSource === reviewedProvider
      : false;
    return keepReviewedDraft ? patch : { ...patch, scanDraft: null };
  }),
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
  reset: () => set({ ...EMPTY, scanDraft: null }),
}));

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

/** Ordered step routes, used by the progress indicator. */
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

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}
