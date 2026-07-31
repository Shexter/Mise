import { create } from 'zustand';

import { DEFAULT_SPLIT } from '@/logic/macros';
import type { ActivityLevel, Goal, Sex, Units } from '@/types';

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
}

interface OnboardingState extends OnboardingDraft {
  set: (patch: Partial<OnboardingDraft>) => void;
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
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...EMPTY,
  set: (patch) => set(patch),
  reset: () => set(EMPTY),
}));

export const ONBOARDING_SPLIT = DEFAULT_SPLIT;

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
  'results',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}
