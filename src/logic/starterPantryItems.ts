import type { StorageLocation } from '@/types';

export interface StarterPantryOption {
  canonicalId: string;
  name: string;
  category: 'protein' | 'staple' | 'produce' | 'seasoning';
  defaultLocation: StorageLocation;
}

export const COMMON_STARTER_PANTRY_ITEMS: readonly StarterPantryOption[] = [
  { canonicalId: 'chicken-breast', name: 'Chicken breast', category: 'protein', defaultLocation: 'fridge' },
  { canonicalId: 'eggs', name: 'Eggs', category: 'protein', defaultLocation: 'fridge' },
  { canonicalId: 'tofu-firm', name: 'Firm tofu', category: 'protein', defaultLocation: 'fridge' },
  { canonicalId: 'salmon', name: 'Salmon', category: 'protein', defaultLocation: 'fridge' },
  { canonicalId: 'jasmine-rice', name: 'White rice', category: 'staple', defaultLocation: 'pantry' },
  { canonicalId: 'dried-pasta', name: 'Pasta', category: 'staple', defaultLocation: 'pantry' },
  { canonicalId: 'oats', name: 'Rolled oats', category: 'staple', defaultLocation: 'pantry' },
  { canonicalId: 'broccoli', name: 'Broccoli', category: 'produce', defaultLocation: 'fridge' },
  { canonicalId: 'potato', name: 'Potatoes', category: 'produce', defaultLocation: 'pantry' },
  { canonicalId: 'yellow-onion', name: 'Onions', category: 'produce', defaultLocation: 'counter' },
  { canonicalId: 'garlic', name: 'Garlic', category: 'seasoning', defaultLocation: 'counter' },
  { canonicalId: 'olive-oil', name: 'Olive oil', category: 'seasoning', defaultLocation: 'pantry' },
  { canonicalId: 'soy-sauce-light', name: 'Soy sauce', category: 'seasoning', defaultLocation: 'pantry' },
];
