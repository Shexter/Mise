import type { DailyTarget, MealItem, MealWithItems } from '@/types';

export type DailyNutritionMetric =
  | 'energy'
  | 'protein'
  | 'carbohydrate'
  | 'fat'
  | 'fibre';

export type NutritionCoverage = 'no-meals' | 'complete' | 'partial' | 'unknown';

/** Metrics with durable per-meal consumed values and therefore honest trends. */
export const DAILY_NUTRITION_METRICS: readonly DailyNutritionMetric[] = [
  'energy',
  'protein',
  'carbohydrate',
  'fat',
  'fibre',
];

export interface DailyNutritionMetricSummary {
  metric: DailyNutritionMetric;
  unit: 'kcal' | 'g';
  /** Sum of known item values. Null means logged food exists but none is known. */
  knownValue: number | null;
  /** The target recorded for this date, not the profile's current target. */
  target: number | null;
  coverage: NutritionCoverage;
  knownItemCount: number;
  loggedItemCount: number;
}

export interface DailyNutritionSummary {
  localDate: string;
  hasMeals: boolean;
  metrics: Record<DailyNutritionMetric, DailyNutritionMetricSummary>;
}

export interface NutritionContributor {
  mealId: string;
  mealName: string;
  knownValue: number;
  coverage: Extract<NutritionCoverage, 'complete' | 'partial'>;
  knownItemCount: number;
  loggedItemCount: number;
}

const METRICS = [
  { metric: 'energy', unit: 'kcal', itemKey: 'calories', targetKey: 'targetCalories' },
  { metric: 'protein', unit: 'g', itemKey: 'proteinG', targetKey: 'proteinG' },
  { metric: 'carbohydrate', unit: 'g', itemKey: 'carbsG', targetKey: 'carbsG' },
  { metric: 'fat', unit: 'g', itemKey: 'fatG', targetKey: 'fatG' },
  { metric: 'fibre', unit: 'g', itemKey: 'fibreG', targetKey: 'fibreG' },
] as const satisfies readonly {
  metric: DailyNutritionMetric;
  unit: DailyNutritionMetricSummary['unit'];
  itemKey: keyof Pick<MealItem, 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'fibreG'>;
  targetKey: keyof Omit<DailyTarget, 'localDate'>;
}[];

/**
 * Builds Today and Analytics' shared nutrition read model from local records.
 *
 * Known values are summed even when coverage is partial. Callers must present
 * `coverage` with the value so a known subtotal is never mistaken for complete
 * intake. A day with no meals has a defensible consumed value of zero; a day
 * with logged items whose nutrient values are all missing remains null.
 */
export function dailyNutritionSummary(
  localDate: string,
  meals: readonly MealWithItems[],
  recordedTarget: DailyTarget | null,
): DailyNutritionSummary {
  const items = meals.flatMap((meal) => meal.items);

  const entries = METRICS.map((definition) => {
    const values = items
      .map((item) => item[definition.itemKey])
      .filter((value): value is number => value !== null);
    const coverage: NutritionCoverage = items.length === 0
      ? 'no-meals'
      : values.length === 0
        ? 'unknown'
        : values.length === items.length
          ? 'complete'
          : 'partial';

    const metric: DailyNutritionMetricSummary = {
      metric: definition.metric,
      unit: definition.unit,
      knownValue: items.length === 0
        ? 0
        : values.length === 0
          ? null
          : values.reduce((total, value) => total + value, 0),
      target: recordedTarget?.[definition.targetKey] ?? null,
      coverage,
      knownItemCount: values.length,
      loggedItemCount: items.length,
    };
    return [definition.metric, metric] as const;
  });

  return {
    localDate,
    hasMeals: meals.length > 0,
    metrics: Object.fromEntries(entries) as DailyNutritionSummary['metrics'],
  };
}

/** Known meal contributions ordered largest first; wholly unknown meals stay excluded. */
export function nutritionContributors(
  meals: readonly MealWithItems[],
  metric: DailyNutritionMetric,
): NutritionContributor[] {
  const definition = METRICS.find((candidate) => candidate.metric === metric);
  if (!definition) return [];

  return meals.flatMap((meal) => {
    const values = meal.items
      .map((item) => item[definition.itemKey])
      .filter((value): value is number => value !== null);
    if (values.length === 0) return [];
    return [{
      mealId: meal.id,
      mealName: meal.name,
      knownValue: values.reduce((total, value) => total + value, 0),
      coverage: values.length === meal.items.length ? 'complete' as const : 'partial' as const,
      knownItemCount: values.length,
      loggedItemCount: meal.items.length,
    }];
  }).sort((left, right) => right.knownValue - left.knownValue || left.mealName.localeCompare(right.mealName));
}
