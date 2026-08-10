import type { CanonicalItem, PantryItem, SuggestionTargetMacro } from '@/types';

import { canonical, item } from './kitchens';

/**
 * Offline macro-gap corpus. Each response is a stable, recorded contract
 * sample, never a runtime fallback or a claim about a configured provider.
 */
export interface MacroGapFixture {
  name: string;
  today: string;
  hour: number;
  targetMacro: SuggestionTargetMacro;
  shortfallG: number;
  canonicals: CanonicalItem[];
  items: PantryItem[];
  /** Raw response shape used by parsing assertions without a key or network. */
  recordedResponse: string;
  expectedDish: string;
}

const tofu = canonical({
  id: 'fixture-tofu', displayName: 'Firm tofu', foodClass: 'protein', defaultLocation: 'fridge',
  proteinPer100: 15, carbsPer100: 3, fatPer100: 9, kcalPer100: 145,
  shelfLifeDays: { fridge: 5 },
});
const chicken = canonical({
  id: 'fixture-chicken', displayName: 'Chicken breast', foodClass: 'protein', defaultLocation: 'fridge',
  proteinPer100: 31, carbsPer100: 0, fatPer100: 4, kcalPer100: 165,
  shelfLifeDays: { fridge: 3 },
});
const cucumber = canonical({
  id: 'fixture-cucumber', displayName: 'Cucumber', foodClass: 'produce', defaultLocation: 'fridge',
  proteinPer100: 1, carbsPer100: 4, fatPer100: 0, kcalPer100: 15,
  shelfLifeDays: { fridge: 5 },
});
const unknown = canonical({
  id: 'fixture-unknown', displayName: 'Family sauce', foodClass: 'condiment', defaultLocation: 'fridge',
  shelfLifeDays: { fridge: 10 },
});

function response(
  dish: string,
  uses: { canonical_id: string; qty: number; unit: 'g' }[],
  estimate: { calories: number; protein_g: number; carbs_g: number; fat_g: number },
): string {
  return JSON.stringify({
    suggestions: [{
      dish,
      reason_tags: ['uses measurable pantry stock'],
      kcal_per_serving: estimate.calories,
      servings: 1,
      effort_minutes: 10,
      uses,
      missing: [],
      method: ['Cook the ingredients simply.'],
      estimated_nutrition_per_serving: estimate,
    }],
  });
}

export const MACRO_GAP_FIXTURES: readonly MacroGapFixture[] = [
  {
    name: 'late small protein gap', today: '2026-06-10', hour: 23,
    targetMacro: 'protein', shortfallG: 12, canonicals: [tofu],
    items: [item({ canonicalId: tofu.id, qtyRemaining: 150, qtyUnit: 'g' })],
    recordedResponse: response('Warm tofu snack', [{ canonical_id: tofu.id, qty: 80, unit: 'g' }], {
      calories: 116, protein_g: 12, carbs_g: 2, fat_g: 7,
    }),
    expectedDish: 'Warm tofu snack',
  },
  {
    name: 'late large protein gap', today: '2026-06-10', hour: 23,
    targetMacro: 'protein', shortfallG: 90, canonicals: [chicken, tofu],
    items: [
      item({ canonicalId: chicken.id, qtyRemaining: 250, qtyUnit: 'g' }),
      item({ canonicalId: tofu.id, qtyRemaining: 200, qtyUnit: 'g' }),
    ],
    recordedResponse: response('Chicken and tofu plate', [
      { canonical_id: chicken.id, qty: 200, unit: 'g' },
      { canonical_id: tofu.id, qty: 150, unit: 'g' },
    ], { calories: 548, protein_g: 85, carbs_g: 5, fat_g: 22 }),
    expectedDish: 'Chicken and tofu plate',
  },
  {
    name: 'mealtime carbohydrate gap', today: '2026-06-10', hour: 18,
    targetMacro: 'carbs', shortfallG: 30, canonicals: [tofu, cucumber],
    items: [
      item({ canonicalId: tofu.id, qtyRemaining: 300, qtyUnit: 'g' }),
      item({ canonicalId: cucumber.id, qtyRemaining: 300, qtyUnit: 'g' }),
    ],
    recordedResponse: response('Tofu and cucumber bowl', [
      { canonical_id: tofu.id, qty: 200, unit: 'g' },
      { canonical_id: cucumber.id, qty: 200, unit: 'g' },
    ], { calories: 320, protein_g: 32, carbs_g: 14, fat_g: 18 }),
    expectedDish: 'Tofu and cucumber bowl',
  },
  {
    name: 'unclosable measurable protein gap', today: '2026-06-10', hour: 18,
    targetMacro: 'protein', shortfallG: 100, canonicals: [tofu],
    items: [item({ canonicalId: tofu.id, qtyRemaining: 200, qtyUnit: 'g' })],
    recordedResponse: response('Pan-seared tofu', [{ canonical_id: tofu.id, qty: 200, unit: 'g' }], {
      calories: 290, protein_g: 30, carbs_g: 6, fat_g: 18,
    }),
    expectedDish: 'Pan-seared tofu',
  },
  {
    name: 'expiring non-contributor beside protein stock', today: '2026-06-10', hour: 18,
    targetMacro: 'protein', shortfallG: 30, canonicals: [chicken, cucumber],
    items: [
      item({ canonicalId: chicken.id, qtyRemaining: 200, qtyUnit: 'g', expiresAt: '2026-06-13' }),
      item({ canonicalId: cucumber.id, qtyRemaining: 200, qtyUnit: 'g', expiresAt: '2026-06-11' }),
    ],
    recordedResponse: response('Chicken with cucumber', [
      { canonical_id: chicken.id, qty: 150, unit: 'g' },
      { canonical_id: cucumber.id, qty: 100, unit: 'g' },
    ], { calories: 263, protein_g: 48, carbs_g: 4, fat_g: 6 }),
    expectedDish: 'Chicken with cucumber',
  },
  {
    name: 'unknown nutrition beside measurable protein stock', today: '2026-06-10', hour: 18,
    targetMacro: 'protein', shortfallG: 35, canonicals: [tofu, unknown],
    items: [
      item({ canonicalId: tofu.id, qtyRemaining: 200, qtyUnit: 'g' }),
      item({ canonicalId: unknown.id, qtyRemaining: 100, qtyUnit: 'g' }),
    ],
    recordedResponse: response('Simple tofu', [{ canonical_id: tofu.id, qty: 200, unit: 'g' }], {
      calories: 290, protein_g: 30, carbs_g: 6, fat_g: 18,
    }),
    expectedDish: 'Simple tofu',
  },
];
