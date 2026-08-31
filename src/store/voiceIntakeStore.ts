import { create } from 'zustand';

import {
  openReview,
  resolveIdentity as applyIdentity,
  setLocation as applyLocation,
  setQuantity as applyQuantity,
  skip as applySkip,
  toggleSelection as applyToggle,
  type IntakeReviewState,
} from '@/logic/intakeReview';
import type {
  IntakeIdentityOption,
  PantryIntakeDraft,
  StatedQuantity,
} from '@/types';

/**
 * The voice draft, in memory only, for as long as the user is looking at it.
 *
 * Nothing here is persisted, and that is the design rather than an omission.
 * Every other capture store in the app (`pantryCaptureStore`, `captureStore`)
 * is the same shape for the same reason: a draft is not evidence, and a draft
 * that survives the app is a draft that can be committed by accident later.
 * `pending_captures` exists for photographs that are waiting on a network call;
 * a transcript is waiting on nothing.
 *
 * It follows that killing the app during review loses the draft. That is the
 * correct trade — the alternative is a transcript of someone's kitchen sitting
 * in the database — and the recording surface says so before the user starts.
 */

interface VoiceIntakeState {
  draft: PantryIntakeDraft | null;
  review: IntakeReviewState | null;
  /** The batch just written, held only long enough to offer Undo. */
  lastBatch: { batchId: string; rowCount: number; skipped: number } | null;

  setDraft: (draft: PantryIntakeDraft) => void;
  toggle: (id: string) => void;
  skip: (id: string) => void;
  setLocation: (id: string, locationId: string) => void;
  setQuantity: (id: string, quantity: StatedQuantity) => void;
  resolveIdentity: (id: string, choice: IntakeIdentityOption) => void;
  recordBatch: (batch: { batchId: string; rowCount: number; skipped: number }) => void;
  clearBatch: () => void;
  clear: () => void;
}

export const useVoiceIntakeStore = create<VoiceIntakeState>((set) => ({
  draft: null,
  review: null,
  lastBatch: null,

  setDraft: (draft) => set({ draft, review: openReview(draft.id, draft.proposals) }),

  toggle: (id) =>
    set((state) => (state.review ? { review: applyToggle(state.review, id) } : state)),
  skip: (id) =>
    set((state) => (state.review ? { review: applySkip(state.review, id) } : state)),
  setLocation: (id, locationId) =>
    set((state) =>
      state.review ? { review: applyLocation(state.review, id, locationId) } : state,
    ),
  setQuantity: (id, quantity) =>
    set((state) =>
      state.review ? { review: applyQuantity(state.review, id, quantity) } : state,
    ),
  resolveIdentity: (id, choice) =>
    set((state) =>
      state.review ? { review: applyIdentity(state.review, id, choice) } : state,
    ),

  recordBatch: (lastBatch) => set({ lastBatch }),
  clearBatch: () => set({ lastBatch: null }),
  clear: () => set({ draft: null, review: null, lastBatch: null }),
}));
