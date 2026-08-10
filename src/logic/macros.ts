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

/** Fibre is an absolute user-owned daily target, never a calorie percentage. */
export const DEFAULT_FIBRE_TARGET_G = 30;

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
  fibreG: 0,
};

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    calories: addNullable(a.calories, b.calories),
    proteinG: addNullable(a.proteinG, b.proteinG),
    carbsG: addNullable(a.carbsG, b.carbsG),
    fatG: addNullable(a.fatG, b.fatG),
    fibreG: a.fibreG == null || b.fibreG == null ? null : a.fibreG + b.fibreG,
  };
}

function addNullable(left: number | null, right: number | null): number | null {
  return left === null || right === null ? null : left + right;
}
