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
interface CaptureState {
  photoUri: string | null;
  base64: string | null;
  estimate: MealEstimate | null;
  mealDraft: NewMeal | null;
  set: (patch: Partial<Pick<CaptureState, 'photoUri' | 'base64' | 'estimate'>>) => void;
  setMealDraft: (mealDraft: NewMeal) => void;
  clear: () => void;
}

export const useCaptureStore = create<CaptureState>((set) => ({
  photoUri: null,
  base64: null,
  estimate: null,
  mealDraft: null,
  set: (patch) => set({ ...patch, mealDraft: null }),
  setMealDraft: (mealDraft) => set({
    photoUri: null,
    base64: null,
    estimate: null,
    mealDraft,
  }),
  clear: () => set({ photoUri: null, base64: null, estimate: null, mealDraft: null }),
}));
