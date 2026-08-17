import { create } from 'zustand';

import type { OpenFoodFactsProduct } from '@/api/openFoodFacts';
import type { MeasureUnit, Product } from '@/types';
import type { BarcodeEvidence } from '@/api/barcodeRecovery';

export interface BarcodeSessionItem {
  id: string;
  product: Product;
  origin: BarcodeResultOrigin;
}

export type BarcodeResultOrigin = 'local' | 'open-food-facts' | 'user';

type ProductCorrection = Pick<Product, 'name' | 'brand' | 'pkgQty' | 'pkgUnit' | 'containerCount'>;

/** A short-lived scan session is intentionally in memory, never pantry data. */
interface BarcodeCaptureState {
  recoveryDraft: ({ gtin: string; returnToBatch: boolean } & BarcodeEvidence) | null;
  pendingMatch: {
    product: OpenFoodFactsProduct;
    canonicalId: string;
    confidence: number;
    returnToBatch: boolean;
  } | null;
  session: BarcodeSessionItem[];
  setPendingMatch: (pendingMatch: BarcodeCaptureState['pendingMatch']) => void;
  clearPendingMatch: () => void;
  addSessionProduct: (product: Product, origin?: BarcodeResultOrigin) => void;
  updateSessionProduct: (id: string, correction: Partial<ProductCorrection>) => void;
  removeSessionProduct: (id: string) => void;
  clearSession: () => void;
  startRecovery: (gtin: string, returnToBatch: boolean) => void;
  updateRecovery: (evidence: Partial<BarcodeEvidence>) => void;
  clearRecovery: () => void;
}

let nextSessionItem = 0;

export const useBarcodeCaptureStore = create<BarcodeCaptureState>((set) => ({
  pendingMatch: null,
  recoveryDraft: null,
  session: [],
  setPendingMatch: (pendingMatch) => set({ pendingMatch }),
  clearPendingMatch: () => set({ pendingMatch: null }),
  addSessionProduct: (product, origin = product.source === 'user' ? 'user' : 'local') => set((state) => ({
    session: [...state.session, { id: `scan-${nextSessionItem++}`, product, origin }],
  })),
  updateSessionProduct: (id, correction) => set((state) => ({
    session: state.session.map((item) => item.id === id ? { ...item, product: { ...item.product, ...correction } } : item),
  })),
  removeSessionProduct: (id) => set((state) => ({ session: state.session.filter((item) => item.id !== id) })),
  clearSession: () => set({ session: [] }),
  startRecovery: (gtin, returnToBatch) => set({ recoveryDraft: { gtin, returnToBatch, name: null, brand: null, pkgQty: null, pkgUnit: null, containerCount: null, kcalPer100: null, proteinPer100: null, carbsPer100: null, fatPer100: null, fibrePer100: null } }),
  updateRecovery: (evidence) => set((state) => ({ recoveryDraft: state.recoveryDraft ? { ...state.recoveryDraft, ...evidence } : null })),
  clearRecovery: () => set({ recoveryDraft: null }),
}));


export const BARCODE_REVIEW_UNITS: readonly MeasureUnit[] = ['g', 'ml', 'piece'];
