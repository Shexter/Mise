import { create } from 'zustand';

import type { CaptureItemProposal } from '@/logic/captureItems';

interface PantryCaptureState {
  photoUri: string | null;
  purchasedAt: string | null;
  proposals: CaptureItemProposal[];
  set: (photoUri: string, purchasedAt: string, proposals: CaptureItemProposal[]) => void;
  clear: () => void;
}

export const usePantryCaptureStore = create<PantryCaptureState>((set) => ({
  photoUri: null,
  purchasedAt: null,
  proposals: [],
  set: (photoUri, purchasedAt, proposals) => set({ photoUri, purchasedAt, proposals }),
  clear: () => set({ photoUri: null, purchasedAt: null, proposals: [] }),
}));
