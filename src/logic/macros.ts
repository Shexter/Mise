import type { Macros } from '@/types';

export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

export const DEFAULT_SPLIT = { proteinPct: 0.3, carbsPct: 0.4, fatPct: 0.3 };

export interface MacroSplit {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

export interface MacroTargets {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Grams of each macro implied by a calorie target and a percentage split. */
export function macroTargets(
  targetCalories: number,
  split: MacroSplit,
): MacroTargets {
  return {
    proteinG: Math.round((targetCalories * split.proteinPct) / KCAL_PER_GRAM.protein),
    carbsG: Math.round((targetCalories * split.carbsPct) / KCAL_PER_GRAM.carbs),
    fatG: Math.round((targetCalories * split.fatPct) / KCAL_PER_GRAM.fat),
  };
}

/**
 * True when the split sums to 100%.
 *
 * Preconditions:
 * split percentages are expressed as fractions, not whole numbers
 */
export function isValidSplit(split: MacroSplit): boolean {
  const total = split.proteinPct + split.carbsPct + split.fatPct;
  return Math.abs(total - 1) < 0.001;
}

export const EMPTY_MACROS: Macros = {
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
};

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories + b.calories,
    proteinG: a.proteinG + b.proteinG,
    carbsG: a.carbsG + b.carbsG,
    fatG: a.fatG + b.fatG,
  };
}
