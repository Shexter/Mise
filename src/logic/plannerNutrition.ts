import type { DailyTarget, PlannerNutrition } from '@/types';

export interface PlannedNutritionEntry {
  id: string;
  portions: number;
  nutritionPerPortion: PlannerNutrition;
  linkedMealId: string | null;
}

export interface PlannerTargetSelection {
  target: DailyTarget | null;
  kind: 'dated' | 'projected' | 'unavailable';
}

export function selectPlannerTarget(
  localDate: string,
  datedTargets: readonly DailyTarget[],
  currentTarget: Omit<DailyTarget, 'localDate'> | null,
): PlannerTargetSelection {
  const dated = datedTargets.find((target) => target.localDate === localDate);
  if (dated) return { target: dated, kind: 'dated' };
  if (currentTarget) return { target: { ...currentTarget, localDate }, kind: 'projected' };
  return { target: null, kind: 'unavailable' };
}

export function scaleNutrition(nutrition: PlannerNutrition, portions: number): PlannerNutrition {
  const scale = (value: number | null) => value === null ? null : value * portions;
  return {
    calories: scale(nutrition.calories), proteinG: scale(nutrition.proteinG),
    carbsG: scale(nutrition.carbsG), fatG: scale(nutrition.fatG),
    fibreG: scale(nutrition.fibreG), source: nutrition.source,
  };
}

export function sumNutrition(values: readonly PlannerNutrition[]): PlannerNutrition {
  const sum = (field: keyof Omit<PlannerNutrition, 'source'>): number | null =>
    values.some((value) => value[field] === null)
      ? null
      : values.reduce((total, value) => total + (value[field] as number), 0);
  return {
    calories: sum('calories'), proteinG: sum('proteinG'), carbsG: sum('carbsG'),
    fatG: sum('fatG'), fibreG: sum('fibreG'),
    source: values.length > 0 && values.every((value) => value.source === values[0]!.source) ? values[0]!.source : null,
  };
}

export function projectedNutrition(
  eaten: readonly { mealId: string; nutrition: PlannerNutrition }[],
  planned: readonly PlannedNutritionEntry[],
): PlannerNutrition {
  const loggedIds = new Set(eaten.map((entry) => entry.mealId));
  return sumNutrition([
    ...eaten.map((entry) => entry.nutrition),
    ...planned.filter((entry) => !entry.linkedMealId || !loggedIds.has(entry.linkedMealId))
      .map((entry) => scaleNutrition(entry.nutritionPerPortion, entry.portions)),
  ]);
}

const FIT_MULTIPLIERS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export interface PortionFitResult { multiplier: number; score: number; improved: boolean }

export function projectRecipeQuantity(
  baseQuantity: number | null,
  baseYield: number,
  producedPortions: number,
): number | null {
  if (baseQuantity === null) return null;
  if (![baseQuantity, baseYield, producedPortions].every(Number.isFinite) || baseQuantity < 0 || baseYield <= 0 || producedPortions <= 0) {
    throw new Error('Recipe quantities and portions must be valid');
  }
  return baseQuantity * producedPortions / baseYield;
}

export function fitSingleMealPortion(
  meal: PlannerNutrition,
  other: PlannerNutrition,
  target: Pick<DailyTarget, 'targetCalories' | 'proteinG' | 'carbsG' | 'fatG'>,
  currentMultiplier = 1,
): PortionFitResult | null {
  const fields = ['calories', 'proteinG', 'carbsG', 'fatG'] as const;
  const targetValues = [target.targetCalories, target.proteinG, target.carbsG, target.fatG];
  if (!Number.isFinite(currentMultiplier) || currentMultiplier <= 0 ||
      fields.some((field) => meal[field] === null || other[field] === null) ||
      targetValues.some((value) => !Number.isFinite(value) || value <= 0)) return null;
  const score = (multiplier: number) => fields.reduce((total, field, index) =>
    total + Math.abs((other[field] as number) + (meal[field] as number) * multiplier - targetValues[index]!) / targetValues[index]!, 0) / fields.length;
  const currentScore = score(currentMultiplier);
  const ranked = [...FIT_MULTIPLIERS].sort((a, b) => score(a) - score(b) || Math.abs(a - currentMultiplier) - Math.abs(b - currentMultiplier) || a - b);
  const multiplier = ranked[0]!;
  return { multiplier, score: score(multiplier), improved: score(multiplier) < currentScore - Number.EPSILON };
}
