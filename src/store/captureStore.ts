import { create } from 'zustand';

import type { NewMeal } from '@/db/queries';
import type { MealEstimate } from '@/types';

/**
 * Hands a captured photo from the camera screen to the review screen.
 *
 * The base64 payload is large and short-lived, so it rides in memory here rather
 * than through navigation params. The stored `uri` is the permanent file; the
 * `estimate` is filled in once the vision call returns, or left null when the
 * review screen is entered in manual-fallback mode.
 */

/**
 * Set only when review was entered from a planned meal's cooking guide.
 *
 * Its presence is what routes the save through `insertPlannedMeal`, so the meal,
 * its depletion and the slot's linkage land in one transaction. Absent — which
 * is every other entry point — review saves exactly as it always has.
 *
 * `idempotencyKey` is minted once when the guide opens, not per save attempt, so
 * a double submit resolves to the same meal instead of two.
 */
export interface PlannerCommitContext {
  slotId: string;
  idempotencyKey: string;
  eatenPortions: number;
  productionPortions: number;
}

interface CaptureState {
  photoUri: string | null;
  base64: string | null;
  estimate: MealEstimate | null;
  mealDraft: NewMeal | null;
  plannerCommit: PlannerCommitContext | null;
  set: (patch: Partial<Pick<CaptureState, 'photoUri' | 'base64' | 'estimate'>>) => void;
  setMealDraft: (mealDraft: NewMeal) => void;
  setPlannedMealDraft: (mealDraft: NewMeal, plannerCommit: PlannerCommitContext) => void;
  clear: () => void;
}

export const useCaptureStore = create<CaptureState>((set) => ({
  photoUri: null,
  base64: null,
  estimate: null,
  mealDraft: null,
  plannerCommit: null,
  set: (patch) => set({ ...patch, mealDraft: null, plannerCommit: null }),
  setMealDraft: (mealDraft) => set({
    photoUri: null,
    base64: null,
    estimate: null,
    mealDraft,
    plannerCommit: null,
  }),
  setPlannedMealDraft: (mealDraft, plannerCommit) => set({
    photoUri: null,
    base64: null,
    estimate: null,
    mealDraft,
    plannerCommit,
  }),
  clear: () => set({ photoUri: null, base64: null, estimate: null, mealDraft: null, plannerCommit: null }),
}));
