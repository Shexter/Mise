import { db } from '@/db';
import { DAILY_NUTRITION_METRICS, type DailyNutritionMetric } from '@/logic/dailyNutritionSummary';
import { bucketNutritionValues, customNutritionPeriod, nutritionTrend, type NutritionAggregation, type NutritionBucket, type NutritionDayValue, type NutritionPeriod } from '@/logic/nutritionRange';
import type { DailyTarget, DaySummary, MealItem, MealWithItems, PantryItem, Profile, RecipeWithIngredients, ShoppingListItem } from '@/types';
import {
  MealRow,
  MealItemRow,
  DailyTargetRow,
  toMeal,
  toMealItem,
  toDailyTarget,
  DaySummaryRow,
  ChartPreferenceRow,
} from './types';
import { getProfile } from './profile';
import { getRecipe, listRecipes } from './recipes';
import { listPantryItems } from './pantry';
import { listShoppingItems } from './shopping';



/** Every date that has at least one logged meal. */
export async function getLoggedDates(): Promise<string[]> {
  const rows = await db().getAllAsync<{ local_date: string }>(
    'SELECT DISTINCT local_date FROM meals',
  );
  return rows.map((row) => row.local_date);
}


/**
 * One grouped read for the whole calendar range. Starting from `meals` makes
 * an unlogged day structurally absent. A single unknown calorie value makes
 * the day's total unknown rather than letting SQL SUM silently skip it.
 */
export async function getDaySummaries(
  from: string,
  to: string,
): Promise<DaySummary[]> {
  const rows = await db().getAllAsync<DaySummaryRow>(
    `SELECT m.local_date,
            CASE
              WHEN COUNT(mi.id) > COUNT(mi.calories) THEN NULL
              ELSE COALESCE(SUM(mi.calories), 0)
            END AS calories,
            dt.target_calories
       FROM meals m
       LEFT JOIN meal_items mi ON mi.meal_id = m.id
       LEFT JOIN daily_targets dt ON dt.local_date = m.local_date
      WHERE m.local_date BETWEEN ? AND ?
      GROUP BY m.local_date, dt.target_calories
      ORDER BY m.local_date ASC`,
    [from, to],
  );
  return rows.map((row) => ({
    localDate: row.local_date,
    calories: row.calories,
    targetCalories: row.target_calories,
  }));
}


/**
 * Three bounded local reads for the whole range, independent of its day count.
 * The pure ranged model still calls `dailyNutritionSummary` once per date so
 * query optimisation cannot fork the app's coverage semantics.
 */
export async function getNutritionDayValues(
  metric: DailyNutritionMetric,
  from: string,
  to: string,
): Promise<NutritionDayValue[]> {
  if (from > to) throw new Error('Nutrition range start must not be after its end.');
  const [mealRows, itemRows, targetRows] = await Promise.all([
    db().getAllAsync<MealRow>(
      'SELECT * FROM meals WHERE local_date BETWEEN ? AND ? ORDER BY logged_at ASC',
      [from, to],
    ),
    db().getAllAsync<MealItemRow>(
      `SELECT mi.* FROM meal_items mi
       INNER JOIN meals m ON m.id = mi.meal_id
       WHERE m.local_date BETWEEN ? AND ?
       ORDER BY m.logged_at ASC, mi.sort_order ASC`,
      [from, to],
    ),
    db().getAllAsync<DailyTargetRow>(
      'SELECT * FROM daily_targets WHERE local_date BETWEEN ? AND ? ORDER BY local_date ASC',
      [from, to],
    ),
  ]);

  const itemsByMeal = new Map<string, MealItem[]>();
  for (const row of itemRows) {
    const current = itemsByMeal.get(row.meal_id) ?? [];
    current.push(toMealItem(row));
    itemsByMeal.set(row.meal_id, current);
  }
  const meals = mealRows.map((row): MealWithItems => ({
    ...toMeal(row),
    items: itemsByMeal.get(row.id) ?? [],
  }));

  return nutritionTrend(
    customNutritionPeriod(from, to),
    metric,
    meals,
    targetRows.map(toDailyTarget),
  );
}


/** Daily or Monday-first weekly buckets from existing local meal and target records. */
export async function getNutritionRangeBuckets(
  metric: DailyNutritionMetric,
  period: NutritionPeriod,
  aggregation: NutritionAggregation,
): Promise<NutritionBucket[]> {
  const values = await getNutritionDayValues(metric, period.startDate, period.endDate);
  return bucketNutritionValues(values, period, aggregation);
}


/** Documented first-run default: energy is useful immediately without making
 * the initial dashboard noisy. Saving an empty list explicitly shows none. */
export const DEFAULT_CHART_METRICS: readonly DailyNutritionMetric[] = ['energy'];


export async function getChartPreference(): Promise<DailyNutritionMetric[]> {
  const row = await db().getFirstAsync<ChartPreferenceRow>(
    'SELECT enabled_metrics FROM chart_preferences WHERE id = 1',
  );
  if (!row) return [...DEFAULT_CHART_METRICS];
  try {
    const parsed: unknown = JSON.parse(row.enabled_metrics);
    if (!Array.isArray(parsed)) return [...DEFAULT_CHART_METRICS];
    return [...new Set(parsed.filter(
      (metric): metric is DailyNutritionMetric =>
        typeof metric === 'string'
        && DAILY_NUTRITION_METRICS.includes(metric as DailyNutritionMetric),
    ))];
  } catch {
    return [...DEFAULT_CHART_METRICS];
  }
}


export async function saveChartPreference(
  enabledMetrics: readonly DailyNutritionMetric[],
): Promise<void> {
  const unique = [...new Set(enabledMetrics)];
  if (
    unique.length !== enabledMetrics.length
    || unique.some((metric) => !DAILY_NUTRITION_METRICS.includes(metric))
  ) {
    throw new Error('Chart preferences contain an unavailable or repeated metric.');
  }
  await db().runAsync(
    `INSERT INTO chart_preferences (id, enabled_metrics, updated_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       enabled_metrics = excluded.enabled_metrics,
       updated_at = excluded.updated_at`,
    [JSON.stringify(unique), new Date().toISOString()],
  );
}


/* -------------------------------------------------------------------------- */
/* Export and wipe                                                             */
/* -------------------------------------------------------------------------- */

export interface ExportBundle {
  exportedAt: string;
  schemaVersion: number;
  profile: Profile | null;
  dailyTargets: DailyTarget[];
  meals: MealWithItems[];
  pantryItems: PantryItem[];
  recipes: RecipeWithIngredients[];
  shoppingList: ShoppingListItem[];
}


export async function exportEverything(
  schemaVersion: number,
): Promise<ExportBundle> {
  const profile = await getProfile();
  const targetRows = await db().getAllAsync<DailyTargetRow>(
    'SELECT * FROM daily_targets ORDER BY local_date ASC',
  );
  const mealRows = await db().getAllAsync<MealRow>(
    'SELECT * FROM meals ORDER BY logged_at ASC',
  );
  const itemRows = await db().getAllAsync<MealItemRow>(
    'SELECT * FROM meal_items ORDER BY sort_order ASC',
  );
  const shoppingList = await listShoppingItems(true);
  const pantryItems = await listPantryItems();
  const recipes = (await listRecipes()).map((recipe) => getRecipe(recipe.id));

  const itemsByMeal = new Map<string, MealItem[]>();
  for (const row of itemRows) {
    const list = itemsByMeal.get(row.meal_id) ?? [];
    list.push(toMealItem(row));
    itemsByMeal.set(row.meal_id, list);
  }

  return {
    exportedAt: new Date().toISOString(),
    schemaVersion,
    profile,
    dailyTargets: targetRows.map(toDailyTarget),
    meals: mealRows.map((row) => ({
      ...toMeal(row),
      items: itemsByMeal.get(row.id) ?? [],
    })),
    pantryItems,
    recipes: (await Promise.all(recipes)).filter((recipe): recipe is RecipeWithIngredients => recipe !== null),
    shoppingList,
  };
}
