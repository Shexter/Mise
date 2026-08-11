import { create } from 'zustand';

import type { OpenFoodFactsProduct } from '@/api/openFoodFacts';
import type { MeasureUnit, Product } from '@/types';

export interface BarcodeSessionItem {
  id: string;
  product: Product;
}

type ProductCorrection = Pick<Product, 'name' | 'brand' | 'pkgQty' | 'pkgUnit' | 'containerCount'>;

/** A short-lived scan session is intentionally in memory, never pantry data. */
interface BarcodeCaptureState {
  pendingMatch: {
    product: OpenFoodFactsProduct;
    canonicalId: string;
    confidence: number;
    returnToBatch: boolean;
  } | null;
  session: BarcodeSessionItem[];
  setPendingMatch: (pendingMatch: BarcodeCaptureState['pendingMatch']) => void;
  clearPendingMatch: () => void;
  addSessionProduct: (product: Product) => void;
  updateSessionProduct: (id: string, correction: Partial<ProductCorrection>) => void;
  removeSessionProduct: (id: string) => void;
  clearSession: () => void;
}

let nextSessionItem = 0;

export const useBarcodeCaptureStore = create<BarcodeCaptureState>((set) => ({
  pendingMatch: null,
  session: [],
  setPendingMatch: (pendingMatch) => set({ pendingMatch }),
  clearPendingMatch: () => set({ pendingMatch: null }),
  addSessionProduct: (product) => set((state) => ({
    session: [...state.session, { id: `scan-${nextSessionItem++}`, product }],
  })),
  updateSessionProduct: (id, correction) => set((state) => ({
    session: state.session.map((item) => item.id === id ? { ...item, product: { ...item.product, ...correction } } : item),
  })),
  removeSessionProduct: (id) => set((state) => ({ session: state.session.filter((item) => item.id !== id) })),
  clearSession: () => set({ session: [] }),
}));

export const BARCODE_REVIEW_UNITS: readonly MeasureUnit[] = ['g', 'ml', 'piece'];
