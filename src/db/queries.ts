import { subDays } from 'date-fns';
import { randomUUID } from 'expo-crypto';

import canonicalSeed from '../../assets/canonical-items.json';
import derivativeSeed from '../../assets/canonical-derivatives.json';
import aliasSeed from '../../assets/item-aliases.json';

import { db } from '@/db';
import { localDateString } from '@/logic/dates';
import type { DailyNutritionMetric, NutritionCoverage } from '@/logic/dailyNutritionSummary';
import { mergeReceiptFrameLines, type ReceiptFrameLineInput } from '@/logic/receiptFrames';
import {
  bucketNutritionValues,
  type NutritionAggregation,
  type NutritionBucket,
  type NutritionDayValue,
  type NutritionPeriod,
} from '@/logic/nutritionRange';
import {
  canRecomputeExpiry,
  freezeExpiry,
  predictExpiry,
} from '@/logic/expiry';
import type { Decrement } from '@/logic/deplete';
import { DEFAULT_FIBRE_TARGET_G, macroTargets } from '@/logic/macros';
import { normalise } from '@/logic/normalise';
import { bigrams, dominantScript } from '@/logic/similarity';
import type { PantryChange } from '@/logic/receipt';
import type {
  CanonicalItem,
  BodyMeasurement,
  BarcodeMiss,
  Confidence,
  SuggestionMode,
  SuggestionTargetMacro,
  SuggestionBaseIntent,
  SuggestionPrepSpeed,
  SavedSuggestionPreference,
  TonightSuggestionPreference,
  SuggestionSet,
  Suggestion,
  MacroGapContext,
  StretchPlan,
  ConsumptionEvent,
  ConsumptionKind,
  DailyTarget,
  DaySummary,
  DietaryRule,
  DietaryRuleKind,
  ExpirySource,
  FoodClass,
  Fullness,
  ItemAlias,
  Location,
  LocationKind,
  MeasureUnit,
  Meal,
  MealItem,
  MealSource,
  MealType,
  MealVenue,
  MealWithItems,
  PantryItem,
  PendingCapture,
  PendingCaptureKind,
  Product,
  Profile,
  QuantitySource,
  QueuedMatch,
  Receipt,
  ReceiptLine,
  ReceiptLineKind,
  ReceiptType,
  QuantityKind,
  ReceiptWithLines,
  Recipe,
  RecipeIngredient,
  RecipeWithIngredients,
  ReceiptFrame,
  ReferenceSource,
  SourceId,
  StockStatus,
  StorageLocation,
  ShoppingListCategory,
  ShoppingListItem,
  ShoppingListReceiptMatch,
  ShoppingListSource,
  ShoppingListSourceKind,
  ShoppingListStatus,
} from '@/types';

/**
 * The transaction handle `withExclusiveTransactionAsync` hands back. Typed
 * structurally so the Node test stand-in satisfies it without importing
 * `expo-sqlite`.
 */
type BindParams = (string | number | null)[];

interface TransactionHandle {
  runAsync(sql: string, params: BindParams): Promise<unknown>;
  getFirstAsync<T>(sql: string, params: BindParams): Promise<T | null>;
  getAllAsync<T>(sql: string, params: BindParams): Promise<T[]>;
}

/* -------------------------------------------------------------------------- */
/* Row shapes                                                                  */
/* -------------------------------------------------------------------------- */

interface ProfileRow {
  sex: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number;
  activity_level: string;
  goal: string;
  target_calories: number;
  protein_pct: number;
  carbs_pct: number;
  fat_pct: number;
  fibre_target_g: number;
  units: string;
  onboarded_at: string;
  target_source: string;
  stated_calories: number | null;
  stated_figure_kind: string | null;
}

interface BodyMeasurementRow {
  provider: string;
  weight_kg: number;
  measured_at: string;
  body_fat_pct: number | null;
  lean_tissue_kg: number | null;
  bone_mineral_content_kg: number | null;
  fat_free_mass_kg: number;
}

interface MealRow {
  id: string;
  logged_at: string;
  local_date: string;
  meal_type: string;
  name: string;
  photo_uri: string | null;
  source: string;
  confidence: string | null;
  venue: string;
  servings_mult: number;
  created_at: string;
}

interface MealItemRow {
  id: string;
  meal_id: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
  is_manual_addition: number;
  sort_order: number;
  canonical_id: string | null;
}

interface ShoppingListItemRow {
  id: string;
  canonical_id: string | null;
  display_name: string;
  normalized_name: string;
  status: string;
  requested_qty: number | null;
  requested_unit: string | null;
  note: string | null;
  category: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface ShoppingListSourceRow {
  id: string;
  shopping_item_id: string;
  kind: string;
  source_id: string | null;
  recipe_id: string | null;
  suggestion_id: string | null;
  created_at: string;
}

interface ShoppingListReceiptMatchRow {
  id: string;
  shopping_item_id: string;
  receipt_id: string;
  receipt_line_id: string;
  previous_status: string;
  matched_at: string;
  undone_at: string | null;
}

interface DailyTargetRow {
  local_date: string;
  target_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
}

interface RecipeRow {
  id: string;
  title: string;
  source_link: string | null;
  steps_json: string;
  image_uri: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface RecipeIngredientRow {
  id: string;
  recipe_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  canonical_id: string | null;
  sort_order: number;
}

/* -------------------------------------------------------------------------- */
/* Mappers                                                                     */
/* -------------------------------------------------------------------------- */

function toProfile(row: ProfileRow): Profile {
  return {
    sex: row.sex as Profile['sex'],
    age: row.age,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    activityLevel: row.activity_level as Profile['activityLevel'],
    goal: row.goal as Profile['goal'],
    targetCalories: row.target_calories,
    targetSource: row.target_source as Profile['targetSource'],
    statedCalories: row.stated_calories,
    statedFigureKind: row.stated_figure_kind as Profile['statedFigureKind'],
    proteinPct: row.protein_pct,
    carbsPct: row.carbs_pct,
    fatPct: row.fat_pct,
    fibreTargetG: row.fibre_target_g,
    units: row.units as Profile['units'],
    onboardedAt: row.onboarded_at,
  };
}

function toBodyMeasurement(row: BodyMeasurementRow): BodyMeasurement {
  return {
    provider: row.provider as BodyMeasurement['provider'], weightKg: row.weight_kg,
    measuredAt: row.measured_at, bodyFatPct: row.body_fat_pct,
    leanTissueKg: row.lean_tissue_kg, boneMineralContentKg: row.bone_mineral_content_kg,
    fatFreeMassKg: row.fat_free_mass_kg,
  };
}

function toMeal(row: MealRow): Meal {
  return {
    id: row.id,
    loggedAt: row.logged_at,
    localDate: row.local_date,
    mealType: row.meal_type as MealType,
    name: row.name,
    photoUri: row.photo_uri,
    source: row.source as MealSource,
    confidence: row.confidence as Confidence | null,
    venue: row.venue as MealVenue,
    servingsMult: row.servings_mult,
    createdAt: row.created_at,
  };
}

function toMealItem(row: MealItemRow): MealItem {
  return {
    id: row.id,
    mealId: row.meal_id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit as MeasureUnit,
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    fibreG: row.fibre_g,
    isManualAddition: row.is_manual_addition === 1,
    sortOrder: row.sort_order,
    canonicalId: row.canonical_id,
  };
}

function toDailyTarget(row: DailyTargetRow): DailyTarget {
  return {
    localDate: row.local_date,
    targetCalories: row.target_calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    fibreG: row.fibre_g,
  };
}

function toRecipe(row: RecipeRow): Recipe {
  let steps: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.steps_json);
    if (Array.isArray(parsed)) {
      steps = parsed.filter((step): step is string => typeof step === 'string');
    }
  } catch {
    // An older or manually damaged row must remain viewable; the recipe data
    // is still useful even if its optional method cannot be read.
  }
  return {
    id: row.id,
    title: row.title,
    sourceLink: row.source_link,
    steps,
    imageUri: row.image_uri,
    status: row.status === 'awaiting_content' ? 'awaiting_content' : 'ready',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRecipeIngredient(row: RecipeIngredientRow): RecipeIngredient {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit as MeasureUnit | null,
    canonicalId: row.canonical_id,
    sortOrder: row.sort_order,
  };
}

/* -------------------------------------------------------------------------- */
/* Profile                                                                     */
/* -------------------------------------------------------------------------- */

export async function getProfile(): Promise<Profile | null> {
  const row = await db().getFirstAsync<ProfileRow>(
    'SELECT * FROM profile WHERE id = 1',
  );
  return row ? toProfile(row) : null;
}

export async function saveProfile(profile: Profile): Promise<void> {
  await db().runAsync(
    `INSERT INTO profile (
       id, sex, age, height_cm, weight_kg, activity_level, goal,
       target_calories, protein_pct, carbs_pct, fat_pct, fibre_target_g, units, onboarded_at,
       target_source, stated_calories, stated_figure_kind
     ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       sex = excluded.sex,
       age = excluded.age,
       height_cm = excluded.height_cm,
       weight_kg = excluded.weight_kg,
       activity_level = excluded.activity_level,
       goal = excluded.goal,
       target_calories = excluded.target_calories,
       protein_pct = excluded.protein_pct,
       carbs_pct = excluded.carbs_pct,
       fat_pct = excluded.fat_pct,
       fibre_target_g = excluded.fibre_target_g,
       units = excluded.units,
       target_source = excluded.target_source,
       stated_calories = excluded.stated_calories,
       stated_figure_kind = excluded.stated_figure_kind`,
    [
      profile.sex,
      profile.age,
      profile.heightCm,
      profile.weightKg,
      profile.activityLevel,
      profile.goal,
      profile.targetCalories,
      profile.proteinPct,
      profile.carbsPct,
      profile.fatPct,
      profile.fibreTargetG ?? DEFAULT_FIBRE_TARGET_G,
      profile.units,
      profile.onboardedAt,
      profile.targetSource,
      profile.statedCalories,
      profile.statedFigureKind,
    ],
  );
}

export async function getBodyMeasurements(): Promise<BodyMeasurement[]> {
  const rows = await db().getAllAsync<BodyMeasurementRow>('SELECT * FROM body_measurements');
  return rows.map(toBodyMeasurement);
}

/** Replaces only the measurement for this provider; the other provider remains. */
export async function saveBodyMeasurement(measurement: BodyMeasurement): Promise<void> {
  await db().runAsync(
    `INSERT INTO body_measurements (provider, weight_kg, measured_at, body_fat_pct, lean_tissue_kg, bone_mineral_content_kg, fat_free_mass_kg)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider) DO UPDATE SET weight_kg = excluded.weight_kg, measured_at = excluded.measured_at,
       body_fat_pct = excluded.body_fat_pct, lean_tissue_kg = excluded.lean_tissue_kg,
       bone_mineral_content_kg = excluded.bone_mineral_content_kg, fat_free_mass_kg = excluded.fat_free_mass_kg`,
    [measurement.provider, measurement.weightKg, measurement.measuredAt, measurement.bodyFatPct, measurement.leanTissueKg, measurement.boneMineralContentKg, measurement.fatFreeMassKg],
  );
}

/* -------------------------------------------------------------------------- */
/* Daily targets                                                               */
/* -------------------------------------------------------------------------- */

export async function getDailyTarget(
  localDate: string,
): Promise<DailyTarget | null> {
  const row = await db().getFirstAsync<DailyTargetRow>(
    'SELECT * FROM daily_targets WHERE local_date = ?',
    [localDate],
  );
  return row ? toDailyTarget(row) : null;
}

/**
 * Returns the target that was active on `localDate`, writing it on first use so
 * later profile edits do not rewrite history.
 */
export async function ensureDailyTarget(
  localDate: string,
  profile: Profile,
): Promise<DailyTarget> {
  const existing = await getDailyTarget(localDate);
  if (existing) return existing;

  const macros = macroTargets(profile.targetCalories, {
    proteinPct: profile.proteinPct,
    carbsPct: profile.carbsPct,
    fatPct: profile.fatPct,
  });
  const target: DailyTarget = {
    localDate,
    targetCalories: profile.targetCalories,
    proteinG: macros.proteinG,
    carbsG: macros.carbsG,
    fatG: macros.fatG,
    fibreG: profile.fibreTargetG ?? DEFAULT_FIBRE_TARGET_G,
  };
  await db().runAsync(
    `INSERT OR IGNORE INTO daily_targets
       (local_date, target_calories, protein_g, carbs_g, fat_g, fibre_g)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      target.localDate,
      target.targetCalories,
      target.proteinG,
      target.carbsG,
      target.fatG,
      target.fibreG ?? DEFAULT_FIBRE_TARGET_G,
    ],
  );
  return target;
}

/* -------------------------------------------------------------------------- */
/* Meals                                                                       */
/* -------------------------------------------------------------------------- */

export interface NewMealItem {
  name: string;
  quantity: number;
  unit: MeasureUnit;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fibreG?: number | null;
  isManualAddition: boolean;
  /** Carried identity from a cooked suggestion (decision 61). Optional; every existing caller omits it and gets today's resolve-by-name behaviour. */
  canonicalId?: string | null;
}

export interface NewMeal {
  loggedAt: string;
  localDate: string;
  mealType: MealType;
  name: string;
  photoUri: string | null;
  source: MealSource;
  confidence: Confidence | null;
  /** Defaults to home — the assumption every existing caller was making. */
  venue?: MealVenue;
  /** Servings the cooking produced. Forced to 1 for non-home venues. */
  servingsMult?: number;
  items: NewMealItem[];
}

export async function insertMeal(meal: NewMeal): Promise<MealWithItems> {
  const mealId = randomUUID();
  const createdAt = new Date().toISOString();

  const items: MealItem[] = meal.items.map((item, index) => ({
    id: randomUUID(),
    mealId,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    calories: item.calories,
    proteinG: item.proteinG,
    carbsG: item.carbsG,
    fatG: item.fatG,
    fibreG: item.fibreG ?? null,
    isManualAddition: item.isManualAddition,
    sortOrder: index,
    canonicalId: item.canonicalId ?? null,
  }));

  // A non-home meal never debits the pantry, so a multiplier on one would be
  // meaningless — forced to 1 here so the stored row cannot express it.
  const venue = meal.venue ?? 'home';
  const stored: MealWithItems = {
    id: mealId,
    loggedAt: meal.loggedAt,
    localDate: meal.localDate,
    mealType: meal.mealType,
    name: meal.name,
    photoUri: meal.photoUri,
    source: meal.source,
    confidence: meal.confidence,
    venue,
    servingsMult: venue === 'home' ? Math.max(1, meal.servingsMult ?? 1) : 1,
    createdAt,
    items,
  };

  await writeMeal(stored);
  return stored;
}

/** Re-inserts a previously deleted meal, ids intact. Used by undo. */
export async function restoreMeal(meal: MealWithItems): Promise<void> {
  await writeMeal(meal);
}

async function writeMeal(meal: MealWithItems): Promise<void> {
  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO meals
         (id, logged_at, local_date, meal_type, name, photo_uri, source, confidence,
          venue, servings_mult, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        meal.id,
        meal.loggedAt,
        meal.localDate,
        meal.mealType,
        meal.name,
        meal.photoUri,
        meal.source,
        meal.confidence,
        meal.venue,
        meal.servingsMult,
        meal.createdAt,
      ],
    );
    for (const item of meal.items) {
      await txn.runAsync(
        `INSERT INTO meal_items
           (id, meal_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g, fibre_g,
            is_manual_addition, sort_order, canonical_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.mealId,
          item.name,
          item.quantity,
          item.unit,
          item.calories,
          item.proteinG,
          item.carbsG,
          item.fatG,
          item.fibreG ?? null,
          item.isManualAddition ? 1 : 0,
          item.sortOrder,
          item.canonicalId,
        ],
      );
    }
  });
}

export async function getMealsForDate(
  localDate: string,
): Promise<MealWithItems[]> {
  const mealRows = await db().getAllAsync<MealRow>(
    'SELECT * FROM meals WHERE local_date = ? ORDER BY logged_at ASC',
    [localDate],
  );
  if (mealRows.length === 0) return [];

  const placeholders = mealRows.map(() => '?').join(', ');
  const itemRows = await db().getAllAsync<MealItemRow>(
    `SELECT * FROM meal_items WHERE meal_id IN (${placeholders})
     ORDER BY sort_order ASC`,
    mealRows.map((row) => row.id),
  );

  const itemsByMeal = new Map<string, MealItem[]>();
  for (const row of itemRows) {
    const list = itemsByMeal.get(row.meal_id) ?? [];
    list.push(toMealItem(row));
    itemsByMeal.set(row.meal_id, list);
  }

  return mealRows.map((row) => ({
    ...toMeal(row),
    items: itemsByMeal.get(row.id) ?? [],
  }));
}

export async function getMeal(id: string): Promise<MealWithItems | null> {
  const mealRow = await db().getFirstAsync<MealRow>(
    'SELECT * FROM meals WHERE id = ?',
    [id],
  );
  if (!mealRow) return null;
  const itemRows = await db().getAllAsync<MealItemRow>(
    'SELECT * FROM meal_items WHERE meal_id = ? ORDER BY sort_order ASC',
    [id],
  );
  return { ...toMeal(mealRow), items: itemRows.map(toMealItem) };
}

/* -------------------------------------------------------------------------- */
/* Saved recipes                                                               */
/* -------------------------------------------------------------------------- */

export interface NewRecipeIngredient {
  name: string;
  quantity: number | null;
  unit: MeasureUnit | null;
  canonicalId: string | null;
}

export interface NewRecipe {
  title: string;
  sourceLink: string | null;
  steps?: readonly string[];
  imageUri?: string | null;
  status?: Recipe['status'];
  ingredients?: readonly NewRecipeIngredient[];
}

/** Creates the recipe and its stated ingredients as one local transaction. */
export async function insertRecipe(input: NewRecipe): Promise<RecipeWithIngredients> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const recipe: Recipe = {
    id,
    title: input.title.trim() || 'Untitled recipe',
    sourceLink: input.sourceLink?.trim() || null,
    steps: input.steps?.filter((step) => step.trim().length > 0) ?? [],
    imageUri: input.imageUri ?? null,
    status: input.status ?? 'ready',
    createdAt: now,
    updatedAt: now,
  };
  const ingredients = (input.ingredients ?? []).map((ingredient, sortOrder) => ({
    id: randomUUID(),
    recipeId: id,
    name: ingredient.name.trim(),
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    canonicalId: ingredient.canonicalId,
    sortOrder,
  }));

  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO recipes
         (id, title, source_link, steps_json, image_uri, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recipe.id, recipe.title, recipe.sourceLink, JSON.stringify(recipe.steps),
        recipe.imageUri, recipe.status, recipe.createdAt, recipe.updatedAt,
      ],
    );
    for (const ingredient of ingredients) {
      await txn.runAsync(
        `INSERT INTO recipe_ingredients
           (id, recipe_id, name, quantity, unit, canonical_id, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          ingredient.id, ingredient.recipeId, ingredient.name, ingredient.quantity,
          ingredient.unit, ingredient.canonicalId, ingredient.sortOrder,
        ],
      );
    }
  });
  return { ...recipe, ingredients };
}

export async function getRecipe(id: string): Promise<RecipeWithIngredients | null> {
  const row = await db().getFirstAsync<RecipeRow>('SELECT * FROM recipes WHERE id = ?', [id]);
  if (!row) return null;
  const ingredients = await db().getAllAsync<RecipeIngredientRow>(
    'SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order ASC',
    [id],
  );
  return { ...toRecipe(row), ingredients: ingredients.map(toRecipeIngredient) };
}

/** Lists saved recipes without loading their ingredients. */
export async function listRecipes(): Promise<Recipe[]> {
  const rows = await db().getAllAsync<RecipeRow>(
    'SELECT * FROM recipes ORDER BY updated_at DESC, created_at DESC',
  );
  return rows.map(toRecipe);
}

/** Replaces editable recipe content while preserving provenance and source link. */
export async function updateRecipe(
  recipe: RecipeWithIngredients,
): Promise<RecipeWithIngredients> {
  const now = new Date().toISOString();
  const ingredients = recipe.ingredients.map((ingredient, sortOrder) => ({
    ...ingredient,
    id: ingredient.id || randomUUID(),
    recipeId: recipe.id,
    sortOrder,
  }));
  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `UPDATE recipes SET title = ?, steps_json = ?, image_uri = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [recipe.title, JSON.stringify(recipe.steps), recipe.imageUri, recipe.status, now, recipe.id],
    );
    await txn.runAsync('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [recipe.id]);
    for (const ingredient of ingredients) {
      await txn.runAsync(
        `INSERT INTO recipe_ingredients
           (id, recipe_id, name, quantity, unit, canonical_id, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ingredient.id, ingredient.recipeId, ingredient.name, ingredient.quantity,
          ingredient.unit, ingredient.canonicalId, ingredient.sortOrder],
      );
    }
  });
  return { ...recipe, ingredients, updatedAt: now };
}

export async function deleteRecipe(id: string): Promise<string | null> {
  const recipe = await getRecipe(id);
  if (!recipe) return null;
  await db().runAsync('DELETE FROM recipes WHERE id = ?', [id]);
  return recipe.imageUri;
}

export async function deleteMeal(id: string): Promise<void> {
  await db().runAsync('DELETE FROM meals WHERE id = ?', [id]);
}

export type MealEditFailureStage = 'meal' | 'item' | 'pantry' | 'event';

/** Test-only fault injection; production callers omit this argument. */
export interface MealEditOptions {
  failAt?: MealEditFailureStage;
}

/**
 * Replaces an edited meal and its depletion ledger as one transaction.
 * Immutable provenance columns are deliberately absent from the UPDATE.
 */
export async function updateMealWithDepletion(
  edited: MealWithItems,
  decrements: readonly Decrement[],
  options: MealEditOptions = {},
): Promise<MealWithItems> {
  const venue = edited.venue;
  const servingsMult = venue === 'home' ? Math.max(1, edited.servingsMult) : 1;
  let stored: MealWithItems | null = null;

  await db().withExclusiveTransactionAsync(async (txn) => {
    const row = await txn.getFirstAsync<MealRow>(
      'SELECT * FROM meals WHERE id = ?',
      [edited.id],
    );
    if (!row) throw new Error('Meal no longer exists.');
    const original = toMeal(row);
    const existingEvents = await txn.getAllAsync<ConsumptionEventRow>(
      'SELECT * FROM consumption_events WHERE meal_id = ?',
      [edited.id],
    );

    if (existingEvents.length > 0) {
      await reverseRows(txn, existingEvents, edited.id);
    }

    await txn.runAsync(
      `UPDATE meals
         SET meal_type = ?, name = ?, venue = ?, servings_mult = ?
       WHERE id = ?`,
      [edited.mealType, edited.name, venue, servingsMult, edited.id],
    );
    if (options.failAt === 'meal') throw new Error('Injected meal edit failure.');

    await txn.runAsync('DELETE FROM meal_items WHERE meal_id = ?', [edited.id]);
    const items = edited.items.map((item, sortOrder) => ({
      ...item,
      mealId: edited.id,
      sortOrder,
    }));
    for (const item of items) {
      await txn.runAsync(
        `INSERT INTO meal_items
           (id, meal_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g, fibre_g,
            is_manual_addition, sort_order, canonical_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id, item.mealId, item.name, item.quantity, item.unit,
          item.calories, item.proteinG, item.carbsG, item.fatG, item.fibreG ?? null,
          item.isManualAddition ? 1 : 0, item.sortOrder, item.canonicalId,
        ],
      );
    }
    if (options.failAt === 'item') throw new Error('Injected item edit failure.');

    const now = new Date().toISOString();
    for (const decrement of decrements) {
      const applied = decrement.pantryItemId
        ? await applyToItem(txn, decrement, now)
        : decrement.qty;
      if (options.failAt === 'pantry') throw new Error('Injected pantry edit failure.');
      await txn.runAsync(
        `INSERT INTO consumption_events
           (id, pantry_item_id, canonical_id, meal_id, qty, unit, uses,
            servings_mult, kind, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(), decrement.pantryItemId, decrement.canonicalId, edited.id,
          applied, decrement.unit, decrement.uses, servingsMult, decrement.kind, now,
        ],
      );
      if (options.failAt === 'event') throw new Error('Injected event edit failure.');
    }

    stored = {
      ...original,
      mealType: edited.mealType,
      name: edited.name,
      venue,
      servingsMult,
      items,
    };
  });

  if (!stored) throw new Error('Meal update did not complete.');
  return stored;
}

/**
 * Meals logged in the last `days` days (inclusive of today). Nothing reads
 * a window today — `getMealsForDate` reads one day and `getLoggedDates`
 * reads none of the content — so personalisation has no source without it.
 */
export async function getRecentMeals(days: number): Promise<MealWithItems[]> {
  const since = localDateString(subDays(new Date(), days));
  const mealRows = await db().getAllAsync<MealRow>(
    'SELECT * FROM meals WHERE local_date >= ? ORDER BY logged_at ASC',
    [since],
  );
  if (mealRows.length === 0) return [];

  const placeholders = mealRows.map(() => '?').join(', ');
  const itemRows = await db().getAllAsync<MealItemRow>(
    `SELECT * FROM meal_items WHERE meal_id IN (${placeholders})
     ORDER BY sort_order ASC`,
    mealRows.map((row) => row.id),
  );

  const itemsByMeal = new Map<string, MealItem[]>();
  for (const row of itemRows) {
    const list = itemsByMeal.get(row.meal_id) ?? [];
    list.push(toMealItem(row));
    itemsByMeal.set(row.meal_id, list);
  }

  return mealRows.map((row) => ({
    ...toMeal(row),
    items: itemsByMeal.get(row.id) ?? [],
  }));
}

/** Every date that has at least one logged meal. */
export async function getLoggedDates(): Promise<string[]> {
  const rows = await db().getAllAsync<{ local_date: string }>(
    'SELECT DISTINCT local_date FROM meals',
  );
  return rows.map((row) => row.local_date);
}

interface DaySummaryRow {
  local_date: string;
  calories: number | null;
  target_calories: number | null;
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

interface NutritionDayRow {
  local_date: string;
  meal_count: number;
  item_count: number;
  known_count: number;
  known_value: number | null;
  recorded_target: number | null;
}

const NUTRITION_RANGE_COLUMNS = {
  energy: { value: 'calories', target: 'target_calories' },
  protein: { value: 'protein_g', target: 'protein_g' },
  carbohydrate: { value: 'carbs_g', target: 'carbs_g' },
  fat: { value: 'fat_g', target: 'fat_g' },
  fibre: { value: 'fibre_g', target: 'fibre_g' },
} as const satisfies Record<DailyNutritionMetric, { value: string; target: string }>;

/**
 * One bounded local read for nutrition history. The selected columns come
 * from the closed metric map above; dates remain parameterized. Target-only
 * dates are retained, while dates with neither a meal nor a recorded target
 * are filled by `bucketNutritionValues` as absent rather than known zero.
 */
export async function getNutritionDayValues(
  metric: DailyNutritionMetric,
  from: string,
  to: string,
): Promise<NutritionDayValue[]> {
  if (from > to) throw new Error('Nutrition range start must not be after its end.');
  const columns = NUTRITION_RANGE_COLUMNS[metric];
  const rows = await db().getAllAsync<NutritionDayRow>(
    `WITH range_dates AS (
       SELECT local_date FROM meals WHERE local_date BETWEEN ? AND ?
       UNION
       SELECT local_date FROM daily_targets WHERE local_date BETWEEN ? AND ?
     ), item_totals AS (
       SELECT m.local_date,
              COUNT(DISTINCT m.id) AS meal_count,
              COUNT(mi.id) AS item_count,
              COUNT(mi.${columns.value}) AS known_count,
              SUM(mi.${columns.value}) AS known_value
         FROM meals m
         LEFT JOIN meal_items mi ON mi.meal_id = m.id
        WHERE m.local_date BETWEEN ? AND ?
        GROUP BY m.local_date
     )
     SELECT d.local_date,
            COALESCE(i.meal_count, 0) AS meal_count,
            COALESCE(i.item_count, 0) AS item_count,
            COALESCE(i.known_count, 0) AS known_count,
            CASE WHEN COALESCE(i.known_count, 0) = 0 THEN NULL ELSE i.known_value END AS known_value,
            t.${columns.target} AS recorded_target
       FROM range_dates d
       LEFT JOIN item_totals i ON i.local_date = d.local_date
       LEFT JOIN daily_targets t ON t.local_date = d.local_date
      ORDER BY d.local_date ASC`,
    [from, to, from, to, from, to],
  );

  return rows.map((row) => ({
    localDate: row.local_date,
    knownValue: row.known_value,
    coverage: nutritionRowCoverage(row),
    hasMeals: row.meal_count > 0,
    recordedTarget: row.recorded_target,
  }));
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

function nutritionRowCoverage(row: NutritionDayRow): NutritionCoverage {
  if (row.meal_count === 0) return 'no-meals';
  if (row.known_count === 0) return 'unknown';
  return row.known_count === row.item_count ? 'complete' : 'partial';
}

/* -------------------------------------------------------------------------- */
/* Ingredient identity: row shapes and mappers                                 */
/* -------------------------------------------------------------------------- */

interface CanonicalItemRow {
  id: string;
  display_name: string;
  class: string;
  default_location: string;
  shelf_life_days: string;
  early_warning_days: number | null;
  open_life_days: number | null;
  sources: string;
  kcal_per_100: number | null;
  protein_per_100: number | null;
  carbs_per_100: number | null;
  fat_per_100: number | null;
  fibre_per_100: number | null;
  typical_use_qty: number | null;
  typical_use_unit: string | null;
  typical_pkg_qty: number | null;
  typical_pkg_unit: string | null;
  density_g_per_ml: number | null;
  is_seed: number;
  created_at: string;
}

interface ItemAliasRow {
  id: string;
  alias_norm: string;
  alias_raw: string;
  canonical_id: string;
  source: string;
  locale: string | null;
  confidence: number;
  times_confirmed: number;
  created_at: string;
}

interface ProductRow {
  id: string;
  gtin: string | null;
  brand: string | null;
  name: string;
  pkg_qty: number | null;
  pkg_unit: string | null;
  container_count: number | null;
  canonical_id: string;
  kcal_per_100: number | null;
  protein_per_100: number | null;
  carbs_per_100: number | null;
  fat_per_100: number | null;
  fibre_per_100: number | null;
  source: string;
  fetched_at: string | null;
  last_scanned_at: string | null;
}

interface QueuedMatchRow {
  id: string;
  raw_text: string;
  source: string;
  context: string | null;
  suggested_id: string | null;
  confidence: number | null;
  created_at: string;
}

function toCanonicalItem(row: CanonicalItemRow): CanonicalItem {
  return {
    id: row.id,
    displayName: row.display_name,
    foodClass: row.class as FoodClass,
    defaultLocation: row.default_location as StorageLocation,
    shelfLifeDays: JSON.parse(row.shelf_life_days) as CanonicalItem['shelfLifeDays'],
    earlyWarningDays: row.early_warning_days,
    openLifeDays: row.open_life_days,
    sources: JSON.parse(row.sources) as CanonicalItem['sources'],
    kcalPer100: row.kcal_per_100,
    proteinPer100: row.protein_per_100,
    carbsPer100: row.carbs_per_100,
    fatPer100: row.fat_per_100,
    fibrePer100: row.fibre_per_100,
    typicalUseQty: row.typical_use_qty,
    typicalUseUnit: row.typical_use_unit as MeasureUnit | null,
    typicalPkgQty: row.typical_pkg_qty,
    typicalPkgUnit: row.typical_pkg_unit as MeasureUnit | null,
    densityGPerMl: row.density_g_per_ml,
    isSeed: row.is_seed === 1,
    createdAt: row.created_at,
  };
}

function toItemAlias(row: ItemAliasRow): ItemAlias {
  return {
    id: row.id,
    aliasNorm: row.alias_norm,
    aliasRaw: row.alias_raw,
    canonicalId: row.canonical_id,
    source: row.source as ReferenceSource,
    locale: row.locale,
    confidence: row.confidence,
    timesConfirmed: row.times_confirmed,
    createdAt: row.created_at,
  };
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    gtin: row.gtin,
    brand: row.brand,
    name: row.name,
    pkgQty: row.pkg_qty,
    pkgUnit: row.pkg_unit as MeasureUnit | null,
    containerCount: row.container_count,
    canonicalId: row.canonical_id,
    kcalPer100: row.kcal_per_100,
    proteinPer100: row.protein_per_100,
    carbsPer100: row.carbs_per_100,
    fatPer100: row.fat_per_100,
    fibrePer100: row.fibre_per_100,
    source: row.source as ReferenceSource,
    fetchedAt: row.fetched_at,
    lastScannedAt: row.last_scanned_at,
  };
}

function toQueuedMatch(row: QueuedMatchRow): QueuedMatch {
  return {
    id: row.id,
    rawText: row.raw_text,
    source: row.source as ReferenceSource,
    context: row.context,
    suggestedId: row.suggested_id,
    confidence: row.confidence,
    createdAt: row.created_at,
  };
}

/* -------------------------------------------------------------------------- */
/* Seed data                                                                   */
/* -------------------------------------------------------------------------- */

interface CanonicalSeedEntry {
  id: string;
  displayName: string;
  class: FoodClass;
  defaultLocation: StorageLocation;
  shelfLifeDays: Partial<Record<StorageLocation, number>>;
  earlyWarningDays?: number | null;
  openLifeDays?: number | null;
  sources?: Partial<Record<string, SourceId>>;
  kcalPer100?: number | null;
  proteinPer100?: number | null;
  carbsPer100?: number | null;
  fatPer100?: number | null;
  fibrePer100?: number | null;
  typicalUseQty?: number;
  typicalUseUnit?: MeasureUnit;
  typicalPkgQty?: number;
  typicalPkgUnit?: MeasureUnit;
  densityGPerMl?: number;
}

interface AliasSeedEntry {
  alias: string;
  canonicalId: string;
  locale?: string;
}

interface DerivativeSeedEntry {
  parent: string;
  child: string;
}

/**
 * Loads the shipped canonical ingredients, aliases, and derivative edges.
 * Idempotent: canonicals are keyed on their slug, aliases on the unique
 * `(alias_norm, canonical_id)` pair, and derivative edges on the
 * `(parent_id, child_id)` primary key — so re-running after a catalogue
 * update inserts only what is new and never duplicates what is there. There
 * is no separate "catalogue version" to bump (confirmed by reading this
 * function before touching it, per task 3.4): this already runs on every
 * app launch (`src/db/index.ts`), so a JSON edit alone is what an existing
 * install needs to pick up new edges. Each canonical's display name is also
 * registered as an alias so the display name itself always resolves.
 */
export async function loadSeedData(): Promise<void> {
  const now = new Date().toISOString();
  const canonicals = canonicalSeed as CanonicalSeedEntry[];
  const aliases = aliasSeed as AliasSeedEntry[];
  const derivatives = derivativeSeed as DerivativeSeedEntry[];

  await db().withExclusiveTransactionAsync(async (txn) => {
    for (const entry of canonicals) {
      await txn.runAsync(
        `INSERT INTO canonical_items
           (id, display_name, class, default_location, shelf_life_days,
            early_warning_days, open_life_days, sources, kcal_per_100,
            protein_per_100, carbs_per_100, fat_per_100, fibre_per_100, typical_use_qty,
            typical_use_unit, typical_pkg_qty, typical_pkg_unit,
            density_g_per_ml, is_seed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
         ON CONFLICT(id) DO UPDATE SET
           display_name = excluded.display_name,
           class = excluded.class,
           default_location = excluded.default_location,
           shelf_life_days = excluded.shelf_life_days,
           early_warning_days = excluded.early_warning_days,
           open_life_days = excluded.open_life_days,
           sources = excluded.sources,
           kcal_per_100 = excluded.kcal_per_100,
           protein_per_100 = excluded.protein_per_100,
           carbs_per_100 = excluded.carbs_per_100,
           fat_per_100 = excluded.fat_per_100,
           fibre_per_100 = excluded.fibre_per_100,
           typical_use_qty = excluded.typical_use_qty,
           typical_use_unit = excluded.typical_use_unit,
           typical_pkg_qty = excluded.typical_pkg_qty,
           typical_pkg_unit = excluded.typical_pkg_unit,
           density_g_per_ml = excluded.density_g_per_ml
         WHERE canonical_items.is_seed = 1`,
        [
          entry.id,
          entry.displayName,
          entry.class,
          entry.defaultLocation,
          JSON.stringify(entry.shelfLifeDays),
          entry.earlyWarningDays ?? null,
          entry.openLifeDays ?? null,
          JSON.stringify(entry.sources ?? defaultHandAuthoredSources(entry)),
          entry.kcalPer100 ?? null,
          entry.proteinPer100 ?? null,
          entry.carbsPer100 ?? null,
          entry.fatPer100 ?? null,
          entry.fibrePer100 ?? null,
          entry.typicalUseQty ?? null,
          entry.typicalUseUnit ?? null,
          entry.typicalPkgQty ?? null,
          entry.typicalPkgUnit ?? null,
          entry.densityGPerMl ?? null,
          now,
        ],
      );
    }

    const seedAliases: AliasSeedEntry[] = [
      ...canonicals.map((entry) => ({
        alias: entry.displayName,
        canonicalId: entry.id,
      })),
      ...aliases,
    ];
    for (const entry of seedAliases) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO item_aliases
           (id, alias_norm, alias_raw, canonical_id, source, locale,
            confidence, times_confirmed, created_at)
         VALUES (?, ?, ?, ?, 'seed', ?, 1, 0, ?)`,
        [
          randomUUID(),
          normalise(entry.alias),
          entry.alias,
          entry.canonicalId,
          entry.locale ?? null,
          now,
        ],
      );
    }

    for (const entry of derivatives) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO canonical_derivatives (parent_id, child_id) VALUES (?, ?)`,
        [entry.parent, entry.child],
      );
    }

    // `INSERT OR IGNORE` above means a conflicting alias keeps its original
    // row and id — the freshly generated id in the VALUES clause was never
    // written. A backfill pass over every non-Latin alias, rather than
    // trying to track insert-vs-ignore per row, is what actually gets this
    // right: idempotent (each call checks for existing rows first), and it
    // self-heals any alias — seeded or user-added — that predates this
    // migration.
    const nonLatinAliases = await txn.getAllAsync<{
      id: string;
      alias_norm: string;
    }>(`SELECT id, alias_norm FROM item_aliases WHERE alias_norm GLOB '*[^ -~]*'`, []);
    for (const row of nonLatinAliases) {
      await ensureAliasBigrams(txn, row.id, row.alias_norm);
    }
  });
}

function defaultHandAuthoredSources(
  entry: CanonicalSeedEntry,
): Partial<Record<string, SourceId>> {
  const sources: Partial<Record<string, SourceId>> = {
    shelfLifeDays: 'hand-authored',
  };
  for (const key of [
    'openLifeDays',
    'typicalUseQty',
    'typicalUseUnit',
    'typicalPkgQty',
    'typicalPkgUnit',
    'densityGPerMl',
  ] as const) {
    if (entry[key] != null) sources[key] = 'hand-authored';
  }
  return sources;
}

/* -------------------------------------------------------------------------- */
/* Ingredient identity: reads                                                  */
/* -------------------------------------------------------------------------- */

export async function getCanonicalById(
  id: string,
): Promise<CanonicalItem | null> {
  const row = await db().getFirstAsync<CanonicalItemRow>(
    'SELECT * FROM canonical_items WHERE id = ?',
    [id],
  );
  return row ? toCanonicalItem(row) : null;
}

export async function getAllCanonicals(): Promise<CanonicalItem[]> {
  const rows = await db().getAllAsync<CanonicalItemRow>(
    'SELECT * FROM canonical_items ORDER BY display_name COLLATE NOCASE ASC',
  );
  return rows.map(toCanonicalItem);
}

export async function getProductByBarcode(
  gtin: string,
): Promise<Product | null> {
  const row = await db().getFirstAsync<ProductRow>(
    'SELECT * FROM products WHERE gtin = ?',
    [gtin],
  );
  return row ? toProduct(row) : null;
}

/** Records a successful recognition without changing product facts. */
export async function markProductScanned(id: string, scannedAt: string = new Date().toISOString()): Promise<Product> {
  await db().runAsync('UPDATE products SET last_scanned_at = ? WHERE id = ?', [scannedAt, id]);
  const row = await db().getFirstAsync<ProductRow>('SELECT * FROM products WHERE id = ?', [id]);
  if (!row) throw new Error('Scanned product no longer exists.');
  return toProduct(row);
}

export async function listRecentScannedProducts(): Promise<Product[]> {
  const rows = await db().getAllAsync<ProductRow>(
    'SELECT * FROM products WHERE last_scanned_at IS NOT NULL ORDER BY last_scanned_at DESC',
  );
  return rows.map(toProduct);
}

/** Clears only recency metadata; cached products and pantry stock remain. */
export async function clearRecentBarcodeHistory(): Promise<void> {
  await db().runAsync('UPDATE products SET last_scanned_at = NULL WHERE last_scanned_at IS NOT NULL');
}

export async function getBarcodeMiss(gtin: string): Promise<BarcodeMiss | null> {
  return db().getFirstAsync<BarcodeMiss>(
    'SELECT gtin, fetched_at AS fetchedAt FROM barcode_misses WHERE gtin = ?',
    [gtin],
  );
}

export async function recordBarcodeMiss(gtin: string): Promise<BarcodeMiss> {
  const fetchedAt = new Date().toISOString();
  await db().runAsync(
    `INSERT INTO barcode_misses (gtin, fetched_at) VALUES (?, ?)
     ON CONFLICT(gtin) DO UPDATE SET fetched_at = excluded.fetched_at`,
    [gtin, fetchedAt],
  );
  return { gtin, fetchedAt };
}

/**
 * The best alias for an exact normalised form. Where the same form points at
 * more than one canonical, a user-made alias wins, then the most-confirmed,
 * then the most confident, then the newest — so a correction beats the
 * mistake it corrected.
 */
export async function getBestAliasByNorm(
  norm: string,
): Promise<ItemAlias | null> {
  const row = await db().getFirstAsync<ItemAliasRow>(
    `SELECT * FROM item_aliases WHERE alias_norm = ?
     ORDER BY (source = 'user') DESC, times_confirmed DESC,
              confidence DESC, created_at DESC
     LIMIT 1`,
    [norm],
  );
  return row ? toItemAlias(row) : null;
}

/**
 * The candidate prefilter for approximate matching. Branches on script
 * (decision 67, task 5.4): a CJK reference often shares no whole token and
 * its first three characters are frequently the entire string, so the
 * Latin prefilter below can withhold the correct candidate from the scorer
 * even when the scorer itself would rank it well — the risk `design.md`
 * calls out as worse than a slow scorer. For CJK, aliases sharing any
 * bigram with the reference are retrieved instead, via `alias_bigrams`.
 */
export async function getCandidateAliases(norm: string): Promise<ItemAlias[]> {
  if (dominantScript(norm) !== 'latin') {
    return getCjkCandidateAliases(norm);
  }

  const clauses: string[] = [];
  const params: string[] = [];

  if (norm.length >= 3) {
    clauses.push('alias_norm LIKE ?');
    params.push(`${norm.slice(0, 3)}%`);
  }
  const tokens = norm
    .split(' ')
    .filter((token) => token.length >= 2 || /[^\x20-\x7e]/.test(token))
    .slice(0, 6);
  for (const token of tokens) {
    clauses.push("(' ' || alias_norm || ' ') LIKE ?");
    params.push(`% ${token} %`);
  }
  if (clauses.length === 0) return [];

  const rows = await db().getAllAsync<ItemAliasRow>(
    `SELECT * FROM item_aliases WHERE ${clauses.join(' OR ')} LIMIT 200`,
    params,
  );
  return rows.map(toItemAlias);
}

/**
 * The bigram-based prefilter for non-Latin references. Whole-string
 * padded bigrams, not the mixed-script token segmentation `similarity.ts`
 * uses for scoring — retrieval only needs one shared bigram to surface a
 * candidate, so the coarser computation is sufficient and keeps this
 * function independent of the scorer's internals.
 */
async function getCjkCandidateAliases(norm: string): Promise<ItemAlias[]> {
  const grams = [...bigrams(norm)];
  if (grams.length === 0) return [];

  const placeholders = grams.map(() => '?').join(', ');
  const rows = await db().getAllAsync<ItemAliasRow>(
    `SELECT DISTINCT ia.* FROM item_aliases ia
     JOIN alias_bigrams ab ON ab.alias_id = ia.id
     WHERE ab.bigram IN (${placeholders})
     LIMIT 200`,
    grams,
  );
  return rows.map(toItemAlias);
}

/**
 * Backfills `alias_bigrams` for one alias, if it does not have rows yet.
 * Called after every write to `item_aliases` that could be non-Latin —
 * seed load, write-back, and user confirmation — so a reference resolved
 * only once still becomes locally retrievable next time (task 5.3). Skips
 * pure-Latin aliases, which the Latin prefilter already covers.
 */
async function ensureAliasBigrams(
  runner: TransactionHandle,
  aliasId: string,
  aliasNorm: string,
): Promise<void> {
  if (dominantScript(aliasNorm) === 'latin') return;
  const existing = await runner.getFirstAsync<{ hit: number }>(
    'SELECT 1 as hit FROM alias_bigrams WHERE alias_id = ? LIMIT 1',
    [aliasId],
  );
  if (existing) return;
  for (const gram of bigrams(aliasNorm)) {
    await runner.runAsync(
      'INSERT INTO alias_bigrams (alias_id, bigram) VALUES (?, ?)',
      [aliasId, gram],
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Ingredient identity: writes                                                 */
/* -------------------------------------------------------------------------- */

export interface NewCanonicalItem {
  id: string;
  displayName: string;
  foodClass: FoodClass;
  defaultLocation: StorageLocation;
  shelfLifeDays: Partial<Record<StorageLocation, number>>;
  earlyWarningDays?: number | null;
  openLifeDays?: number | null;
  sources?: Partial<Record<string, SourceId>>;
  kcalPer100?: number | null;
  proteinPer100?: number | null;
  carbsPer100?: number | null;
  fatPer100?: number | null;
  fibrePer100?: number | null;
  typicalUseQty?: number | null;
  typicalUseUnit?: MeasureUnit | null;
  typicalPkgQty?: number | null;
  typicalPkgUnit?: MeasureUnit | null;
  densityGPerMl?: number | null;
}

export async function insertCanonicalItem(
  item: NewCanonicalItem,
): Promise<CanonicalItem> {
  const createdAt = new Date().toISOString();
  await db().runAsync(
    `INSERT INTO canonical_items
       (id, display_name, class, default_location, shelf_life_days,
        early_warning_days, open_life_days, sources, kcal_per_100,
        protein_per_100, carbs_per_100, fat_per_100, fibre_per_100, typical_use_qty,
        typical_use_unit, typical_pkg_qty, typical_pkg_unit,
        density_g_per_ml, is_seed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      item.id,
      item.displayName,
      item.foodClass,
      item.defaultLocation,
      JSON.stringify(item.shelfLifeDays),
      item.earlyWarningDays ?? null,
      item.openLifeDays ?? null,
      JSON.stringify(item.sources ?? {
        shelfLifeDays: 'hand-authored',
        openLifeDays: 'hand-authored',
      }),
      item.kcalPer100 ?? null,
      item.proteinPer100 ?? null,
      item.carbsPer100 ?? null,
      item.fatPer100 ?? null,
      item.fibrePer100 ?? null,
      item.typicalUseQty ?? null,
      item.typicalUseUnit ?? null,
      item.typicalPkgQty ?? null,
      item.typicalPkgUnit ?? null,
      item.densityGPerMl ?? null,
      createdAt,
    ],
  );
  return {
    id: item.id,
    displayName: item.displayName,
    foodClass: item.foodClass,
    defaultLocation: item.defaultLocation,
    shelfLifeDays: item.shelfLifeDays,
    earlyWarningDays: item.earlyWarningDays ?? null,
    openLifeDays: item.openLifeDays ?? null,
    sources: item.sources ?? {
      shelfLifeDays: 'hand-authored',
      openLifeDays: 'hand-authored',
    },
    kcalPer100: item.kcalPer100 ?? null,
    proteinPer100: item.proteinPer100 ?? null,
    carbsPer100: item.carbsPer100 ?? null,
    fatPer100: item.fatPer100 ?? null,
    fibrePer100: item.fibrePer100 ?? null,
    typicalUseQty: item.typicalUseQty ?? null,
    typicalUseUnit: item.typicalUseUnit ?? null,
    typicalPkgQty: item.typicalPkgQty ?? null,
    typicalPkgUnit: item.typicalPkgUnit ?? null,
    densityGPerMl: item.densityGPerMl ?? null,
    isSeed: false,
    createdAt,
  };
}

export interface NewItemAlias {
  aliasRaw: string;
  canonicalId: string;
  source: ReferenceSource;
  locale?: string | null;
  confidence?: number;
}

/**
 * Records a resolution as an alias (decision 27). Upserts on the
 * `(alias_norm, canonical_id)` pair: seeing the same mapping again counts as
 * a confirmation rather than creating a duplicate.
 */
export async function recordAlias(alias: NewItemAlias): Promise<void> {
  const norm = normalise(alias.aliasRaw);
  await db().runAsync(
    `INSERT INTO item_aliases
       (id, alias_norm, alias_raw, canonical_id, source, locale,
        confidence, times_confirmed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(alias_norm, canonical_id) DO UPDATE SET
       times_confirmed = times_confirmed + 1,
       confidence = MAX(confidence, excluded.confidence),
       source = CASE WHEN excluded.source = 'user' THEN 'user' ELSE source END`,
    [
      randomUUID(),
      norm,
      alias.aliasRaw,
      alias.canonicalId,
      alias.source,
      alias.locale ?? null,
      alias.confidence ?? 1,
      new Date().toISOString(),
    ],
  );

  // The upsert above may have kept an existing row's original id rather
  // than the one just generated (`ON CONFLICT` never touches `id`) — look
  // it up rather than assume, so a non-Latin write-back is retrievable by
  // the next unseeded sighting of the same reference (task 5.3).
  const row = await db().getFirstAsync<{ id: string }>(
    'SELECT id FROM item_aliases WHERE alias_norm = ? AND canonical_id = ?',
    [norm, alias.canonicalId],
  );
  if (row) await ensureAliasBigrams(db(), row.id, norm);
}

/**
 * Records a user confirmation or correction. The corrected mapping is
 * written with source `user`, and any alias with the same normalised form
 * pointing elsewhere is removed, so the correction wins every later lookup.
 */
export async function recordUserResolution(
  aliasRaw: string,
  canonicalId: string,
): Promise<void> {
  const norm = normalise(aliasRaw);
  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      'DELETE FROM item_aliases WHERE alias_norm = ? AND canonical_id != ?',
      [norm, canonicalId],
    );
    await txn.runAsync(
      `INSERT INTO item_aliases
         (id, alias_norm, alias_raw, canonical_id, source, locale,
          confidence, times_confirmed, created_at)
       VALUES (?, ?, ?, ?, 'user', NULL, 1, 1, ?)
       ON CONFLICT(alias_norm, canonical_id) DO UPDATE SET
         times_confirmed = times_confirmed + 1,
         confidence = 1,
         source = 'user'`,
      [randomUUID(), norm, aliasRaw, canonicalId, new Date().toISOString()],
    );

    const row = await txn.getFirstAsync<{ id: string }>(
      'SELECT id FROM item_aliases WHERE alias_norm = ? AND canonical_id = ?',
      [norm, canonicalId],
    );
    if (row) await ensureAliasBigrams(txn, row.id, norm);
  });
}

/**
 * Removes a learned alias — used when the user rejects a proposed match so
 * the same wrong mapping is not offered again. Seed aliases stay.
 */
export async function deleteLearnedAlias(
  aliasRaw: string,
  canonicalId: string,
): Promise<void> {
  await db().runAsync(
    `DELETE FROM item_aliases
     WHERE alias_norm = ? AND canonical_id = ? AND source != 'seed'`,
    [normalise(aliasRaw), canonicalId],
  );
}

export interface NewProduct {
  gtin?: string | null;
  brand?: string | null;
  name: string;
  pkgQty?: number | null;
  pkgUnit?: MeasureUnit | null;
  /** Explicit pack count only; omit when an update must preserve the current count. */
  containerCount?: number | null;
  canonicalId: string;
  kcalPer100?: number | null;
  proteinPer100?: number | null;
  carbsPer100?: number | null;
  fatPer100?: number | null;
  fibrePer100?: number | null;
  source: ReferenceSource;
}

export async function insertProduct(product: NewProduct): Promise<Product> {
  const id = randomUUID();
  const fetchedAt = new Date().toISOString();
  await db().runAsync(
    `INSERT INTO products
       (id, gtin, brand, name, pkg_qty, pkg_unit, container_count, canonical_id,
        kcal_per_100, protein_per_100, carbs_per_100, fat_per_100, fibre_per_100, source, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      product.gtin ?? null,
      product.brand ?? null,
      product.name,
      product.pkgQty ?? null,
      product.pkgUnit ?? null,
      product.containerCount ?? null,
      product.canonicalId,
      product.kcalPer100 ?? null,
      product.proteinPer100 ?? null,
      product.carbsPer100 ?? null,
      product.fatPer100 ?? null,
      product.fibrePer100 ?? null,
      product.source,
      fetchedAt,
    ],
  );
  return {
    id,
    gtin: product.gtin ?? null,
    brand: product.brand ?? null,
    name: product.name,
    pkgQty: product.pkgQty ?? null,
    pkgUnit: product.pkgUnit ?? null,
    containerCount: product.containerCount ?? null,
    canonicalId: product.canonicalId,
    kcalPer100: product.kcalPer100 ?? null,
    proteinPer100: product.proteinPer100 ?? null,
    carbsPer100: product.carbsPer100 ?? null,
    fatPer100: product.fatPer100 ?? null,
    fibrePer100: product.fibrePer100 ?? null,
    source: product.source,
    fetchedAt,
    lastScannedAt: null,
  };
}

/** Stores refreshed Open Food Facts fields without creating a second GTIN row. */
export async function upsertProduct(product: NewProduct): Promise<Product> {
  const existing = product.gtin ? await getProductByBarcode(product.gtin) : null;
  if (!existing) return insertProduct(product);
  const fetchedAt = new Date().toISOString();
  const containerCount = product.containerCount === undefined ? existing.containerCount : product.containerCount;
  await db().runAsync(
    `UPDATE products SET brand = ?, name = ?, pkg_qty = ?, pkg_unit = ?, container_count = ?, canonical_id = ?,
      kcal_per_100 = ?, protein_per_100 = ?, carbs_per_100 = ?, fat_per_100 = ?, fibre_per_100 = ?, source = ?, fetched_at = ?
     WHERE id = ?`,
    [product.brand ?? null, product.name, product.pkgQty ?? null, product.pkgUnit ?? null, containerCount,
      product.canonicalId, product.kcalPer100 ?? null, product.proteinPer100 ?? null,
      product.carbsPer100 ?? null, product.fatPer100 ?? null, product.fibrePer100 ?? null, product.source, fetchedAt, existing.id],
  );
  return { ...existing, ...product, containerCount, gtin: product.gtin ?? null, fetchedAt };
}

/* -------------------------------------------------------------------------- */
/* Match queue                                                                 */
/* -------------------------------------------------------------------------- */

export interface NewQueuedMatch {
  rawText: string;
  source: ReferenceSource;
  context?: string | null;
  suggestedId?: string | null;
  confidence?: number | null;
}

export async function enqueueMatch(entry: NewQueuedMatch): Promise<void> {
  await db().runAsync(
    `INSERT INTO match_queue
       (id, raw_text, source, context, suggested_id, confidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      entry.rawText,
      entry.source,
      entry.context ?? null,
      entry.suggestedId ?? null,
      entry.confidence ?? null,
      new Date().toISOString(),
    ],
  );
}

export async function getMatchQueue(): Promise<QueuedMatch[]> {
  const rows = await db().getAllAsync<QueuedMatchRow>(
    'SELECT * FROM match_queue ORDER BY created_at DESC',
  );
  return rows.map(toQueuedMatch);
}

export async function deleteQueuedMatch(id: string): Promise<void> {
  await db().runAsync('DELETE FROM match_queue WHERE id = ?', [id]);
}

/**
 * Resolves a queued reference to a canonical ingredient: writes the alias so
 * the same reference resolves automatically next time, then removes the
 * queue entry.
 */
export async function resolveQueuedMatch(
  id: string,
  canonicalId: string,
): Promise<void> {
  const row = await db().getFirstAsync<QueuedMatchRow>(
    'SELECT * FROM match_queue WHERE id = ?',
    [id],
  );
  if (!row) return;
  await recordUserResolution(row.raw_text, canonicalId);
  await deleteQueuedMatch(id);
}

/* -------------------------------------------------------------------------- */
/* Merge                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Merges two canonical ingredients (decision 29). One transaction: aliases
 * and products repoint at the survivor, queue suggestions follow, and the
 * absorbed canonical is deleted so it can never be offered as a match again.
 * Where both sides carry the same alias form, the survivor's row is kept and
 * the absorbed duplicate is dropped by the cascade delete. Not undoable.
 */
export async function mergeCanonicals(
  survivorId: string,
  absorbedId: string,
): Promise<void> {
  if (survivorId === absorbedId) {
    throw new Error('Cannot merge a canonical ingredient into itself.');
  }
  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      'UPDATE OR IGNORE item_aliases SET canonical_id = ? WHERE canonical_id = ?',
      [survivorId, absorbedId],
    );
    await txn.runAsync(
      'UPDATE products SET canonical_id = ? WHERE canonical_id = ?',
      [survivorId, absorbedId],
    );
    await txn.runAsync(
      'UPDATE match_queue SET suggested_id = ? WHERE suggested_id = ?',
      [survivorId, absorbedId],
    );
    await txn.runAsync('DELETE FROM canonical_items WHERE id = ?', [
      absorbedId,
    ]);
  });
}

/* -------------------------------------------------------------------------- */
/* Pantry: row shapes and mappers                                              */
/* -------------------------------------------------------------------------- */

interface LocationRow {
  id: string;
  name: string;
  kind: string;
  sort_order: number;
}

interface PantryItemRow {
  id: string;
  canonical_id: string;
  product_id: string | null;
  location_id: string;
  qty_remaining: number | null;
  qty_unit: string | null;
  qty_source: string | null;
  fullness: string | null;
  uses_count: number;
  purchased_at: string;
  opened_at: string | null;
  expires_at: string | null;
  expiry_source: string | null;
  price_cents: number | null;
  photo_uri: string | null;
  status: string;
  estimated_decrements_since_anchor: number;
  last_anchor_at: string | null;
  replacement_asked: number;
  created_at: string;
  updated_at: string;
}

function toLocation(row: LocationRow): Location {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as LocationKind,
    sortOrder: row.sort_order,
  };
}

function toPantryItem(row: PantryItemRow): PantryItem {
  return {
    id: row.id,
    canonicalId: row.canonical_id,
    productId: row.product_id,
    locationId: row.location_id,
    qtyRemaining: row.qty_remaining,
    qtyUnit: row.qty_unit as MeasureUnit | null,
    qtySource: row.qty_source as QuantitySource | null,
    fullness: row.fullness as Fullness | null,
    usesCount: row.uses_count,
    purchasedAt: row.purchased_at,
    openedAt: row.opened_at,
    expiresAt: row.expires_at,
    expirySource: row.expiry_source as ExpirySource | null,
    priceCents: row.price_cents,
    photoUri: row.photo_uri,
    status: row.status as StockStatus,
    estimatedDecrementsSinceAnchor: row.estimated_decrements_since_anchor,
    lastAnchorAt: row.last_anchor_at,
    replacementAsked: row.replacement_asked === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* -------------------------------------------------------------------------- */
/* Locations                                                                   */
/* -------------------------------------------------------------------------- */

export async function getLocations(): Promise<Location[]> {
  const rows = await db().getAllAsync<LocationRow>(
    'SELECT * FROM locations ORDER BY sort_order ASC, name ASC',
  );
  return rows.map(toLocation);
}

export async function addLocation(
  name: string,
  kind: LocationKind,
): Promise<Location> {
  const id = randomUUID();
  const row = await db().getFirstAsync<{ top: number | null }>(
    'SELECT MAX(sort_order) AS top FROM locations',
  );
  const sortOrder = (row?.top ?? -1) + 1;
  await db().runAsync(
    'INSERT INTO locations (id, name, kind, sort_order) VALUES (?, ?, ?, ?)',
    [id, name, kind, sortOrder],
  );
  return { id, name, kind, sortOrder };
}

export async function renameLocation(id: string, name: string): Promise<void> {
  await db().runAsync('UPDATE locations SET name = ? WHERE id = ?', [name, id]);
}

/**
 * Removes a location by first moving its items to a destination the user
 * chose — never deleting them, never leaving them locationless. One
 * transaction; expiry is recomputed for the moved items because their
 * location kind may have changed.
 */
export async function removeLocation(
  id: string,
  destinationId: string,
): Promise<void> {
  if (id === destinationId) {
    throw new Error('Cannot move a location’s items into itself.');
  }
  const destination = await db().getFirstAsync<LocationRow>(
    'SELECT * FROM locations WHERE id = ?',
    [destinationId],
  );
  if (!destination) {
    throw new Error('The destination location does not exist.');
  }

  const moved = await db().getAllAsync<PantryItemRow>(
    'SELECT * FROM pantry_items WHERE location_id = ?',
    [id],
  );
  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      'UPDATE pantry_items SET location_id = ?, updated_at = ? WHERE location_id = ?',
      [destinationId, new Date().toISOString(), id],
    );
    await txn.runAsync('DELETE FROM locations WHERE id = ?', [id]);
  });
  for (const row of moved) {
    await recomputeExpiry(row.id);
  }
}

/* -------------------------------------------------------------------------- */
/* Pantry items                                                                */
/* -------------------------------------------------------------------------- */

export interface NewPantryItem {
  canonicalId: string;
  locationId: string;
  /** Local date (yyyy-MM-dd). Defaults to today. */
  purchasedAt?: string;
  productId?: string | null;
  /** A quantity the user typed, echoable back to them. */
  qtyRemaining?: number | null;
  qtyUnit?: MeasureUnit | null;
  /**
   * Defaults to `'user'` when a quantity is given, matching manual add.
   * A receipt line's quantity is a model read of a photograph, not
   * something the user typed, so the receipt-import path overrides this
   * to `'estimate'` — the same distinction decision 74 already draws.
   */
  qtySource?: QuantitySource;
  /** A date from a label or the user; suppresses prediction. */
  expiresAt?: string | null;
  expirySource?: Exclude<ExpirySource, 'predicted'>;
  priceCents?: number | null;
  photoUri?: string | null;
}

/**
 * Inserts a pantry item, predicting its expiry from the canonical shelf
 * life and the location kind unless the caller supplied a date.
 */
export async function insertPantryItem(
  input: NewPantryItem,
): Promise<PantryItem> {
  const canonical = await getCanonicalById(input.canonicalId);
  if (!canonical) {
    throw new Error(`Unknown canonical ingredient: ${input.canonicalId}`);
  }
  const location = await db().getFirstAsync<LocationRow>(
    'SELECT * FROM locations WHERE id = ?',
    [input.locationId],
  );
  if (!location) {
    throw new Error(`Unknown location: ${input.locationId}`);
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const purchasedAt = input.purchasedAt ?? localDateString();

  let expiresAt: string | null;
  let expirySource: ExpirySource | null;
  if (input.expiresAt != null) {
    expiresAt = input.expiresAt;
    expirySource = input.expirySource ?? 'user';
  } else {
    expiresAt = predictExpiry(
      canonical,
      location.kind as LocationKind,
      purchasedAt,
      null,
    );
    expirySource = expiresAt != null ? 'predicted' : null;
  }

  await db().runAsync(
    `INSERT INTO pantry_items
       (id, canonical_id, product_id, location_id, qty_remaining, qty_unit,
        qty_source, fullness, uses_count, purchased_at, opened_at, expires_at,
        expiry_source, price_cents, photo_uri, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, NULL, ?, ?, ?, ?, 'in_stock', ?, ?)`,
    [
      id,
      input.canonicalId,
      input.productId ?? null,
      input.locationId,
      input.qtyRemaining ?? null,
      input.qtyUnit ?? null,
      input.qtyRemaining != null ? (input.qtySource ?? 'user') : null,
      purchasedAt,
      expiresAt,
      expirySource,
      input.priceCents ?? null,
      input.photoUri ?? null,
      now,
      now,
    ],
  );
  const stored = await getPantryItem(id);
  if (!stored) throw new Error('Pantry item vanished on insert.');
  return stored;
}

export interface UpdatePantryItemInput {
  canonicalId: string;
  locationId: string;
  purchasedAt: string;
  qtyRemaining: number | null;
  qtyUnit: MeasureUnit | null;
  expiresAt: string | null;
}

/** Updates only user-owned pantry fields; derived expiry is recomputed when it was predicted. */
export async function updatePantryItem(
  id: string,
  input: UpdatePantryItemInput,
): Promise<PantryItem> {
  const canonical = await getCanonicalById(input.canonicalId);
  if (!canonical) throw new Error(`Unknown canonical ingredient: ${input.canonicalId}`);
  const location = await db().getFirstAsync<LocationRow>(
    'SELECT * FROM locations WHERE id = ?',
    [input.locationId],
  );
  if (!location) throw new Error(`Unknown location: ${input.locationId}`);
  const existing = await getPantryItem(id);
  if (!existing) throw new Error('Pantry item no longer exists.');

  let expiresAt = input.expiresAt;
  let expirySource: ExpirySource | null = input.expiresAt != null
    ? (input.expiresAt === existing.expiresAt ? existing.expirySource ?? 'user' : 'user')
    : null;
  if (input.expiresAt == null && canRecomputeExpiry(existing.expirySource)) {
    expiresAt = predictExpiry(
      canonical,
      location.kind as LocationKind,
      input.purchasedAt,
      existing.openedAt,
    );
    expirySource = expiresAt != null ? 'predicted' : null;
  }
  await db().runAsync(
    `UPDATE pantry_items
     SET canonical_id = ?, location_id = ?, purchased_at = ?,
         qty_remaining = ?, qty_unit = ?, qty_source = ?,
         expires_at = ?, expiry_source = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.canonicalId,
      input.locationId,
      input.purchasedAt,
      input.qtyRemaining,
      input.qtyUnit,
      input.qtyRemaining != null ? 'user' : null,
      expiresAt,
      expirySource,
      new Date().toISOString(),
      id,
    ],
  );
  const updated = await getPantryItem(id);
  if (!updated) throw new Error('Pantry item vanished after update.');
  return updated;
}

/** One accepted rapid-scan session becomes pantry stock atomically. */
export async function applyBarcodeSession(
  items: readonly (NewPantryItem & { productId: string })[],
): Promise<string[]> {
  const now = new Date().toISOString();
  const ids: string[] = [];
  await db().withExclusiveTransactionAsync(async (txn) => {
    for (const item of items) {
      const canonical = await txn.getFirstAsync<CanonicalItemRow>(
        'SELECT * FROM canonical_items WHERE id = ?',
        [item.canonicalId],
      );
      const location = await txn.getFirstAsync<LocationRow>(
        'SELECT * FROM locations WHERE id = ?',
        [item.locationId],
      );
      if (!canonical || !location) throw new Error('A scanned item no longer has a valid ingredient or location.');
      const id = randomUUID();
      const purchasedAt = item.purchasedAt ?? localDateString();
      const expiresAt = item.expiresAt ?? predictExpiry(toCanonicalItem(canonical), location.kind as LocationKind, purchasedAt, null);
      const expirySource = item.expiresAt != null ? (item.expirySource ?? 'user') : (expiresAt != null ? 'predicted' : null);
      await txn.runAsync(
        `INSERT INTO pantry_items
           (id, canonical_id, product_id, location_id, qty_remaining, qty_unit,
            qty_source, fullness, uses_count, purchased_at, opened_at, expires_at,
            expiry_source, price_cents, photo_uri, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, NULL, ?, ?, ?, ?, 'in_stock', ?, ?)`,
        [
          id, item.canonicalId, item.productId, item.locationId,
          item.qtyRemaining ?? null, item.qtyUnit ?? null,
          item.qtyRemaining != null ? (item.qtySource ?? 'estimate') : null,
          purchasedAt, expiresAt, expirySource, item.priceCents ?? null,
          item.photoUri ?? null, now, now,
        ],
      );
      ids.push(id);
    }
  });
  return ids;
}

export async function getPantryItem(id: string): Promise<PantryItem | null> {
  const row = await db().getFirstAsync<PantryItemRow>(
    'SELECT * FROM pantry_items WHERE id = ?',
    [id],
  );
  return row ? toPantryItem(row) : null;
}

/**
 * The catalogue, soonest expiry first; undated items follow dated ones.
 * Discarded and replaced items are excluded — a replaced item was
 * superseded by the new purchase that created it, so it is no longer a
 * live container either (decision 68).
 */
export async function listPantryItems(): Promise<PantryItem[]> {
  const rows = await db().getAllAsync<PantryItemRow>(
    `SELECT * FROM pantry_items
     WHERE status NOT IN ('discarded', 'replaced')
     ORDER BY expires_at IS NULL ASC, expires_at ASC, created_at ASC`,
  );
  return rows.map(toPantryItem);
}

async function touchPantryItem(
  id: string,
  fields: string,
  params: (string | number | null)[],
): Promise<void> {
  await db().runAsync(
    `UPDATE pantry_items SET ${fields}, updated_at = ? WHERE id = ?`,
    [...params, new Date().toISOString(), id],
  );
}

/**
 * Recomputes and stores a predicted expiry from the item's current state.
 * One of the few writers of `expires_at` — creation, opening, moving, and
 * freezing route through here or set it directly. A user or label date is
 * left alone (`canRecomputeExpiry`).
 */
async function recomputeExpiry(id: string): Promise<void> {
  const item = await getPantryItem(id);
  if (!item || !canRecomputeExpiry(item.expirySource)) return;
  const canonical = await getCanonicalById(item.canonicalId);
  const location = await db().getFirstAsync<LocationRow>(
    'SELECT * FROM locations WHERE id = ?',
    [item.locationId],
  );
  if (!canonical || !location) return;

  const expiresAt = predictExpiry(
    canonical,
    location.kind as LocationKind,
    item.purchasedAt,
    item.openedAt,
  );
  await touchPantryItem(id, 'expires_at = ?, expiry_source = ?', [
    expiresAt,
    expiresAt != null ? 'predicted' : null,
  ]);
}

/** Marks an item opened today and recomputes its (predicted) expiry. */
export async function markItemOpened(id: string): Promise<void> {
  await touchPantryItem(id, 'opened_at = ?', [localDateString()]);
  await recomputeExpiry(id);
}

/** Moves an item and recomputes its (predicted) expiry for the new kind. */
export async function updateItemLocation(
  id: string,
  locationId: string,
): Promise<void> {
  await touchPantryItem(id, 'location_id = ?', [locationId]);
  await recomputeExpiry(id);
}

/**
 * The freeze action (decision 20): move to a freezer location and recount
 * expiry from the freezer shelf life as of today. A user or label date
 * still wins over the recount.
 */
export async function freezeItem(
  id: string,
  freezerLocationId: string,
): Promise<void> {
  const item = await getPantryItem(id);
  if (!item) return;
  const canonical = await getCanonicalById(item.canonicalId);
  if (!canonical) return;

  if (canRecomputeExpiry(item.expirySource)) {
    const expiresAt = freezeExpiry(canonical, localDateString());
    await touchPantryItem(
      id,
      'location_id = ?, expires_at = ?, expiry_source = ?',
      [freezerLocationId, expiresAt, expiresAt != null ? 'predicted' : null],
    );
  } else {
    await touchPantryItem(id, 'location_id = ?', [freezerLocationId]);
  }
}

/**
 * A fullness tap (decision 14): authoritative over any estimate at the
 * moment it is given, so the stored advisory status is reset to match.
 */
export async function setItemFullness(
  id: string,
  fullness: Fullness,
): Promise<void> {
  // A fullness tap is ground truth (decision 14), so it is an anchor: the
  // drift counter resets and the app may speak confidently again.
  await touchPantryItem(
    id,
    `fullness = ?, status = ?,
     estimated_decrements_since_anchor = 0, last_anchor_at = ?`,
    [fullness, fullness === 'out' ? 'out' : 'in_stock', new Date().toISOString()],
  );
}

/**
 * A quantity the user typed. The other ground-truth anchor: it zeroes
 * drift, and it restores `qty_source` to `user`, which is what makes the
 * pantry screen echo the figure back to them again (decision 74).
 */
export async function setItemQuantity(
  id: string,
  qtyRemaining: number,
  qtyUnit: MeasureUnit,
): Promise<void> {
  await touchPantryItem(
    id,
    `qty_remaining = ?, qty_unit = ?, qty_source = 'user',
     estimated_decrements_since_anchor = 0, last_anchor_at = ?`,
    [qtyRemaining, qtyUnit, new Date().toISOString()],
  );
}

/**
 * A receipt re-anchor (decision 55): the purchased quantity *sets* the
 * amount rather than adding to it, and drift zeroes. Adding to a drifted
 * estimate compounds the error; setting discards it, which is the point of
 * receipts being the ground-truth re-anchor.
 *
 * Note the boundary with decision 68: this applies when a receipt matches
 * an *existing* item. A purchase of a container the user does not yet have
 * creates a new pantry item instead, which `add-receipt-import` owns.
 */
export async function reanchorFromReceipt(
  id: string,
  qtyRemaining: number,
  qtyUnit: MeasureUnit,
): Promise<void> {
  await touchPantryItem(
    id,
    `qty_remaining = ?, qty_unit = ?, qty_source = 'user', status = 'in_stock',
     uses_count = 0, fullness = NULL,
     estimated_decrements_since_anchor = 0, last_anchor_at = ?`,
    [qtyRemaining, qtyUnit, new Date().toISOString()],
  );
}

export async function markItemUsedUp(id: string): Promise<void> {
  await touchPantryItem(id, "status = 'out'", []);
}

export async function markItemRunningLow(id: string): Promise<void> {
  await touchPantryItem(id, "status = 'running_low'", []);
}

/** Discarded, not consumed — the raw material for waste figures later. */
export async function discardItem(id: string): Promise<void> {
  await touchPantryItem(id, "status = 'discarded'", []);
}

/* -------------------------------------------------------------------------- */
/* Depletion                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The servings a dish made last time, so a repeated dish remembers its
 * yield. Matched on the normalised meal name, which is how the same dish
 * typed slightly differently still finds its own history.
 */
export async function lastServingsForDish(
  mealName: string,
): Promise<number | null> {
  const row = await db().getFirstAsync<{ servings_mult: number }>(
    `SELECT servings_mult FROM meals
     WHERE venue = 'home' AND LOWER(TRIM(name)) = ?
     ORDER BY logged_at DESC LIMIT 1`,
    [mealName.trim().toLowerCase()],
  );
  return row?.servings_mult ?? null;
}

/** The user's latest correction for this normalised dish, if any. */
export async function getDishVenueDefault(
  mealName: string,
): Promise<MealVenue | null> {
  const dishNorm = normalise(mealName);
  if (!dishNorm) return null;
  const row = await db().getFirstAsync<{ venue: string }>(
    'SELECT venue FROM dish_venue_defaults WHERE dish_norm = ?',
    [dishNorm],
  );
  return (row?.venue as MealVenue) ?? null;
}

/** Records only an explicit correction from an unknown-origin flow. A later
 * correction replaces the earlier one for the same normalised dish. */
export async function saveDishVenueDefault(
  mealName: string,
  venue: MealVenue,
): Promise<void> {
  const dishNorm = normalise(mealName);
  if (!dishNorm) return;
  await db().runAsync(
    `INSERT INTO dish_venue_defaults (dish_norm, venue, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(dish_norm) DO UPDATE SET
       venue = excluded.venue,
       updated_at = excluded.updated_at`,
    [dishNorm, venue, new Date().toISOString()],
  );
}

/** Remaining portions from the most recent batch of this dish. The meal
 * logged when the batch was cooked accounts for one portion; each later
 * leftovers meal accounts for one more. */
export async function outstandingPortionsForDish(
  mealName: string,
): Promise<number> {
  const dishNorm = normalise(mealName);
  if (!dishNorm) return 0;
  const batches = await db().getAllAsync<{
    name: string;
    logged_at: string;
    servings_mult: number;
  }>(
    `SELECT m.name, m.logged_at,
            COALESCE(MAX(e.servings_mult), m.servings_mult) AS servings_mult
     FROM meals m
     LEFT JOIN consumption_events e ON e.meal_id = m.id
     WHERE m.venue = 'home' AND m.servings_mult > 1
     GROUP BY m.id
     ORDER BY m.logged_at DESC`,
  );
  const batch = batches.find((row) => normalise(row.name) === dishNorm);
  if (!batch) return 0;

  const laterLeftovers = await db().getAllAsync<{ name: string }>(
    `SELECT name FROM meals
     WHERE venue = 'leftovers' AND logged_at > ?`,
    [batch.logged_at],
  );
  const consumed = laterLeftovers.filter(
    (row) => normalise(row.name) === dishNorm,
  ).length;
  return Math.max(0, batch.servings_mult - 1 - consumed);
}

interface ConsumptionEventRow {
  id: string;
  pantry_item_id: string | null;
  canonical_id: string;
  meal_id: string | null;
  qty: number | null;
  unit: string | null;
  uses: number;
  servings_mult: number;
  kind: string;
  created_at: string;
}

function toConsumptionEvent(row: ConsumptionEventRow): ConsumptionEvent {
  return {
    id: row.id,
    pantryItemId: row.pantry_item_id,
    canonicalId: row.canonical_id,
    mealId: row.meal_id,
    qty: row.qty,
    unit: row.unit as MeasureUnit | null,
    uses: row.uses,
    servingsMult: row.servings_mult,
    kind: row.kind as ConsumptionKind,
    createdAt: row.created_at,
  };
}

export async function getConsumptionEvents(
  mealId: string,
): Promise<ConsumptionEvent[]> {
  const rows = await db().getAllAsync<ConsumptionEventRow>(
    'SELECT * FROM consumption_events WHERE meal_id = ? ORDER BY created_at ASC',
    [mealId],
  );
  return rows.map(toConsumptionEvent);
}

export async function getConsumptionEventsForItem(
  pantryItemId: string,
): Promise<ConsumptionEvent[]> {
  const rows = await db().getAllAsync<ConsumptionEventRow>(
    'SELECT * FROM consumption_events WHERE pantry_item_id = ? ORDER BY created_at ASC',
    [pantryItemId],
  );
  return rows.map(toConsumptionEvent);
}

/**
 * Writes a planned set of decrements and applies them, in one transaction.
 *
 * Three rules are enforced here rather than in the planner, because they are
 * about the stored row rather than the intention:
 *
 * - **Clamping.** A decrement larger than what is left empties the item and
 *   marks it out, rather than storing a negative amount. The clamp is drift
 *   evidence — the estimate was already wrong.
 * - **Drift.** Every estimated decrement increments the counter that gates
 *   how confidently the interface speaks (decision 53).
 * - **Provenance.** The first estimated decrement against a user-entered
 *   quantity flips `qty_source` to `estimated` (decision 74). Leaving it as
 *   `user` would let the pantry screen render a decremented estimate
 *   labelled as the figure the user typed.
 */
export async function applyDepletion(
  mealId: string,
  decrements: readonly Decrement[],
  servingsMult: number,
): Promise<void> {
  if (decrements.length === 0) return;
  const now = new Date().toISOString();

  await db().withExclusiveTransactionAsync(async (txn) => {
    for (const decrement of decrements) {
      const applied = decrement.pantryItemId
        ? await applyToItem(txn, decrement, now)
        : decrement.qty;
      await txn.runAsync(
        `INSERT INTO consumption_events
           (id, pantry_item_id, canonical_id, meal_id, qty, unit, uses,
            servings_mult, kind, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          decrement.pantryItemId,
          decrement.canonicalId,
          mealId,
          applied,
          decrement.unit,
          decrement.uses,
          servingsMult,
          decrement.kind,
          now,
        ],
      );
    }
  });
}

/**
 * Applies one decrement to its pantry item and reports the amount actually
 * removed, which is not always the amount intended: a decrement larger than
 * what is left empties the item rather than going negative.
 *
 * The *applied* figure is what the consumption event stores, so reversing a
 * clamped decrement restores exactly what it took and not the larger amount
 * it wanted. Recording the intention instead would hand an item free stock
 * every time an over-decrement was undone.
 */
async function applyToItem(
  txn: TransactionHandle,
  decrement: Decrement,
  now: string,
): Promise<number | null> {
  const row = await txn.getFirstAsync<PantryItemRow>(
    'SELECT * FROM pantry_items WHERE id = ?',
    [decrement.pantryItemId],
  );
  if (!row) return decrement.qty;

  const uses = row.uses_count + decrement.uses;

  if (decrement.qty === null) {
    // Uses-tracked, or unconvertible: the count moves, the amount does not.
    await txn.runAsync(
      `UPDATE pantry_items
         SET uses_count = ?,
             estimated_decrements_since_anchor = estimated_decrements_since_anchor + 1,
             updated_at = ?
       WHERE id = ?`,
      [uses, now, decrement.pantryItemId],
    );
    return null;
  }

  const remaining = row.qty_remaining ?? 0;
  const next = remaining - decrement.qty;
  const clamped = next <= 0;
  const applied = clamped ? remaining : decrement.qty;

  await txn.runAsync(
    `UPDATE pantry_items
       SET qty_remaining = ?,
           qty_unit = COALESCE(qty_unit, ?),
           qty_source = 'estimated',
           uses_count = ?,
           status = CASE WHEN ? THEN 'out' ELSE status END,
           estimated_decrements_since_anchor = estimated_decrements_since_anchor + 1,
           updated_at = ?
     WHERE id = ?`,
    [
      clamped ? 0 : next,
      decrement.unit,
      uses,
      clamped ? 1 : 0,
      now,
      decrement.pantryItemId,
    ],
  );
  return applied;
}

/**
 * Reverses a meal's depletion: restores what its events recorded, then
 * deletes them. Drift counters unwind with the amounts, so a reversed meal
 * leaves no trace of confidence it should not have cost.
 */
export async function reverseDepletion(mealId: string): Promise<void> {
  const rows = await db().getAllAsync<ConsumptionEventRow>(
    'SELECT * FROM consumption_events WHERE meal_id = ?',
    [mealId],
  );
  if (rows.length === 0) return;
  await db().withExclusiveTransactionAsync(async (txn) => {
    await reverseRows(txn, rows, mealId);
  });
}

async function reverseRows(
  txn: TransactionHandle,
  rows: readonly ConsumptionEventRow[],
  mealId: string,
): Promise<void> {
  const now = new Date().toISOString();
  for (const row of rows) {
    if (row.pantry_item_id) {
      const item = await txn.getFirstAsync<PantryItemRow>(
        'SELECT * FROM pantry_items WHERE id = ?',
        [row.pantry_item_id],
      );
      if (item) {
        const restoredQty =
          row.qty === null ? item.qty_remaining : (item.qty_remaining ?? 0) + row.qty;
        await txn.runAsync(
          `UPDATE pantry_items
             SET qty_remaining = ?,
                 uses_count = MAX(0, uses_count - ?),
                 status = CASE WHEN status = 'out' AND ? > 0 THEN 'in_stock' ELSE status END,
                 estimated_decrements_since_anchor =
                   MAX(0, estimated_decrements_since_anchor - 1),
                 updated_at = ?
           WHERE id = ?`,
          [restoredQty, row.uses, restoredQty ?? 0, now, row.pantry_item_id],
        );
      }
    }
  }
  await txn.runAsync('DELETE FROM consumption_events WHERE meal_id = ?', [
    mealId,
  ]);
}

/**
 * Re-commits an edited meal: reverse, then reapply, in one transaction.
 *
 * Deliberately not a computed delta between the old and new meals. A diff
 * would have to be simultaneously correct for added items, removed items,
 * changed quantities, and a changed multiplier, and it drifts out of
 * agreement with itself the moment one of those cases is handled slightly
 * differently. Reverse-then-reapply has one code path, and the events table
 * exists precisely to make it cheap.
 */
export async function reapplyDepletion(
  mealId: string,
  decrements: readonly Decrement[],
  servingsMult: number,
): Promise<void> {
  const existing = await db().getAllAsync<ConsumptionEventRow>(
    'SELECT * FROM consumption_events WHERE meal_id = ?',
    [mealId],
  );
  const now = new Date().toISOString();

  await db().withExclusiveTransactionAsync(async (txn) => {
    if (existing.length > 0) {
      await reverseRows(txn, existing, mealId);
    }
    for (const decrement of decrements) {
      const applied = decrement.pantryItemId
        ? await applyToItem(txn, decrement, now)
        : decrement.qty;
      await txn.runAsync(
        `INSERT INTO consumption_events
           (id, pantry_item_id, canonical_id, meal_id, qty, unit, uses,
            servings_mult, kind, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          decrement.pantryItemId,
          decrement.canonicalId,
          mealId,
          applied,
          decrement.unit,
          decrement.uses,
          servingsMult,
          decrement.kind,
          now,
        ],
      );
    }
  });
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

/* -------------------------------------------------------------------------- */
/* Shopping list                                                              */
/* -------------------------------------------------------------------------- */

export interface NewShoppingListItem {
  id?: string;
  canonicalId?: string | null;
  displayName: string;
  normalizedName: string;
  status?: ShoppingListStatus;
  requestedQty?: number | null;
  requestedUnit?: MeasureUnit | null;
  note?: string | null;
  category?: ShoppingListCategory;
  sortOrder?: number;
}

export interface NewShoppingListSource {
  shoppingItemId: string;
  kind: ShoppingListSourceKind;
  sourceId?: string | null;
  recipeId?: string | null;
  suggestionId?: string | null;
}

function toShoppingListItem(row: ShoppingListItemRow, sources: ShoppingListSource[]): ShoppingListItem {
  return {
    id: row.id,
    canonicalId: row.canonical_id,
    displayName: row.display_name,
    normalizedName: row.normalized_name,
    status: row.status as ShoppingListStatus,
    requestedQty: row.requested_qty,
    requestedUnit: row.requested_unit as MeasureUnit | null,
    note: row.note,
    category: row.category as ShoppingListCategory,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    sources,
  };
}

function toShoppingListSource(row: ShoppingListSourceRow): ShoppingListSource {
  return {
    id: row.id,
    shoppingItemId: row.shopping_item_id,
    kind: row.kind as ShoppingListSourceKind,
    sourceId: row.source_id,
    recipeId: row.recipe_id,
    suggestionId: row.suggestion_id,
    createdAt: row.created_at,
  };
}

function toShoppingListReceiptMatch(row: ShoppingListReceiptMatchRow): ShoppingListReceiptMatch {
  return {
    id: row.id,
    shoppingItemId: row.shopping_item_id,
    receiptId: row.receipt_id,
    receiptLineId: row.receipt_line_id,
    previousStatus: row.previous_status as ShoppingListStatus,
    matchedAt: row.matched_at,
    undoneAt: row.undone_at,
  };
}

export async function listShoppingItems(includeClosed = false): Promise<ShoppingListItem[]> {
  const rows = await db().getAllAsync<ShoppingListItemRow>(
    includeClosed
      ? 'SELECT * FROM shopping_list_items ORDER BY sort_order ASC, display_name ASC'
      : "SELECT * FROM shopping_list_items WHERE status = 'open' ORDER BY sort_order ASC, display_name ASC",
  );
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const sources = await db().getAllAsync<ShoppingListSourceRow>(
    `SELECT * FROM shopping_list_sources WHERE shopping_item_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at ASC`,
    ids,
  );
  const sourcesByItem = new Map<string, ShoppingListSource[]>();
  for (const source of sources) {
    const list = sourcesByItem.get(source.shopping_item_id) ?? [];
    list.push(toShoppingListSource(source));
    sourcesByItem.set(source.shopping_item_id, list);
  }
  return rows.map((row) => toShoppingListItem(row, sourcesByItem.get(row.id) ?? []));
}

export async function insertShoppingListItem(input: NewShoppingListItem): Promise<ShoppingListItem> {
  const id = input.id ?? randomUUID();
  const now = new Date().toISOString();
  await db().runAsync(
    `INSERT INTO shopping_list_items
      (id, canonical_id, display_name, normalized_name, status, requested_qty,
       requested_unit, note, category, sort_order, created_at, updated_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [id, input.canonicalId ?? null, input.displayName, input.normalizedName,
      input.status ?? 'open', input.requestedQty ?? null, input.requestedUnit ?? null,
      input.note ?? null, input.category ?? 'other', input.sortOrder ?? 0, now, now],
  );
  const item = (await listShoppingItems(true)).find((candidate) => candidate.id === id);
  if (!item) throw new Error('Shopping item vanished on insert.');
  return item;
}

export async function updateShoppingListItem(
  id: string,
  patch: Partial<Pick<ShoppingListItem, 'displayName' | 'normalizedName' | 'requestedQty' | 'requestedUnit' | 'note' | 'category' | 'sortOrder' | 'status'>>,
): Promise<void> {
  const current = await db().getFirstAsync<ShoppingListItemRow>('SELECT * FROM shopping_list_items WHERE id = ?', [id]);
  if (!current) throw new Error('Shopping item not found.');
  const now = new Date().toISOString();
  const nextStatus = patch.status ?? current.status;
  await db().runAsync(
    `UPDATE shopping_list_items SET display_name = ?, normalized_name = ?,
       requested_qty = ?, requested_unit = ?, note = ?, category = ?,
       sort_order = ?, status = ?, updated_at = ?, completed_at = ? WHERE id = ?`,
    [patch.displayName ?? current.display_name, patch.normalizedName ?? current.normalized_name,
      patch.requestedQty === undefined ? current.requested_qty : patch.requestedQty,
      patch.requestedUnit === undefined ? current.requested_unit : patch.requestedUnit,
      patch.note === undefined ? current.note : patch.note, patch.category ?? current.category,
      patch.sortOrder ?? current.sort_order, nextStatus, now,
      nextStatus === 'purchased' ? (current.completed_at ?? now) : null, id],
  );
}

export async function deleteShoppingListItem(id: string): Promise<void> {
  await db().runAsync('DELETE FROM shopping_list_items WHERE id = ?', [id]);
}

export async function addShoppingListSource(input: NewShoppingListSource): Promise<void> {
  await db().runAsync(
    `INSERT OR IGNORE INTO shopping_list_sources
       (id, shopping_item_id, kind, source_id, recipe_id, suggestion_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), input.shoppingItemId, input.kind, input.sourceId ?? null,
      input.recipeId ?? null, input.suggestionId ?? null, new Date().toISOString()],
  );
}

export async function removeShoppingListSource(
  shoppingItemId: string,
  source: Pick<NewShoppingListSource, 'kind' | 'sourceId' | 'recipeId' | 'suggestionId'>,
): Promise<void> {
  await db().runAsync(
    `DELETE FROM shopping_list_sources
     WHERE shopping_item_id = ? AND kind = ?
       AND source_id IS ? AND recipe_id IS ? AND suggestion_id IS ?`,
    [shoppingItemId, source.kind, source.sourceId ?? null, source.recipeId ?? null, source.suggestionId ?? null],
  );
}

export async function matchShoppingItemToReceipt(
  shoppingItemId: string,
  receiptId: string,
  receiptLineId: string,
): Promise<ShoppingListReceiptMatch | null> {
  const item = await db().getFirstAsync<ShoppingListItemRow>('SELECT * FROM shopping_list_items WHERE id = ?', [shoppingItemId]);
  if (!item || item.status !== 'open') return null;
  const existing = await db().getFirstAsync<ShoppingListReceiptMatchRow>(
    'SELECT * FROM shopping_list_receipt_matches WHERE shopping_item_id = ? AND receipt_line_id = ?',
    [shoppingItemId, receiptLineId],
  );
  if (existing && existing.undone_at === null) return toShoppingListReceiptMatch(existing);
  const id = randomUUID();
  const now = new Date().toISOString();
  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync("UPDATE shopping_list_items SET status = 'purchased', completed_at = ?, updated_at = ? WHERE id = ?", [now, now, shoppingItemId]);
    await txn.runAsync(
      `INSERT OR REPLACE INTO shopping_list_receipt_matches
        (id, shopping_item_id, receipt_id, receipt_line_id, previous_status, matched_at, undone_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      [id, shoppingItemId, receiptId, receiptLineId, item.status, now],
    );
  });
  const row = await db().getFirstAsync<ShoppingListReceiptMatchRow>('SELECT * FROM shopping_list_receipt_matches WHERE id = ?', [id]);
  return row ? toShoppingListReceiptMatch(row) : null;
}

export async function undoShoppingReceiptMatch(matchId: string): Promise<void> {
  const match = await db().getFirstAsync<ShoppingListReceiptMatchRow>('SELECT * FROM shopping_list_receipt_matches WHERE id = ?', [matchId]);
  if (!match || match.undone_at !== null) return;
  const now = new Date().toISOString();
  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('UPDATE shopping_list_items SET status = ?, completed_at = NULL, updated_at = ? WHERE id = ?', [match.previous_status, now, match.shopping_item_id]);
    await txn.runAsync('UPDATE shopping_list_receipt_matches SET undone_at = ? WHERE id = ?', [now, matchId]);
  });
}

export async function listShoppingReceiptMatches(receiptId: string): Promise<ShoppingListReceiptMatch[]> {
  const rows = await db().getAllAsync<ShoppingListReceiptMatchRow>(
    'SELECT * FROM shopping_list_receipt_matches WHERE receipt_id = ? ORDER BY matched_at ASC', [receiptId],
  );
  return rows.map(toShoppingListReceiptMatch);
}

/* -------------------------------------------------------------------------- */
/* Dinner decision: suggestion cache                                          */
/* -------------------------------------------------------------------------- */

interface SuggestionCacheRow {
  id: string;
  local_date: string;
  mode: string;
  target_macro: string | null;
  template_id: string | null;
  prep_speed: string | null;
  fingerprint: string;
  payload: string;
  created_at: string;
}

interface SuggestionPreferenceRow {
  base_intent: string;
  prep_speed: string;
  updated_at: string;
}

function toSavedSuggestionPreference(row: SuggestionPreferenceRow): SavedSuggestionPreference {
  return {
    baseIntent: row.base_intent as SuggestionBaseIntent,
    prepSpeed: row.prep_speed as SuggestionPrepSpeed,
    updatedAt: row.updated_at,
  };
}

/** The durable explicit choice. Profile remains the owner of long-term targets. */
export async function getSuggestionPreference(): Promise<SavedSuggestionPreference | null> {
  const row = await db().getFirstAsync<SuggestionPreferenceRow>(
    'SELECT * FROM suggestion_preferences WHERE id = 1',
  );
  return row ? toSavedSuggestionPreference(row) : null;
}

export async function saveSuggestionPreference(
  baseIntent: SuggestionBaseIntent,
  prepSpeed: SuggestionPrepSpeed,
): Promise<SavedSuggestionPreference> {
  const updatedAt = new Date().toISOString();
  await db().runAsync(
    `INSERT INTO suggestion_preferences (id, base_intent, prep_speed, updated_at)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       base_intent = excluded.base_intent,
       prep_speed = excluded.prep_speed,
       updated_at = excluded.updated_at`,
    [baseIntent, prepSpeed, updatedAt],
  );
  return { baseIntent, prepSpeed, updatedAt };
}

export async function clearSuggestionPreference(): Promise<void> {
  await db().runAsync('DELETE FROM suggestion_preferences WHERE id = 1');
}

interface CachedPayload {
  suggestions: Suggestion[];
  stretch: StretchPlan | null;
  /** Absent on rows cached before task 11 shipped — treated as zero. */
  droppedForConstraint?: number;
  /**
   * Absent on rows cached before `add-dish-scorer` shipped. Falls back to
   * `suggestions` itself (design's rollback note: a pool equal to the
   * displayed count degrades to a same-three reorder, not a break).
   */
  pool?: Suggestion[];
  /** Absent on rows cached before `add-dietary-profile` shipped — treated as zero. */
  droppedForDiet?: number;
  /** Null before macro-gap support, and for non-macro request modes. */
  macroGapContext?: MacroGapContext | null;
}

function toSuggestionSet(row: SuggestionCacheRow): SuggestionSet {
  const payload = JSON.parse(row.payload) as CachedPayload;
  return {
    id: row.id,
    localDate: row.local_date,
    mode: row.mode as SuggestionMode,
    targetMacro: row.target_macro as SuggestionTargetMacro | null,
    tonightPreference: row.template_id && row.prep_speed
      ? {
          baseIntent: row.template_id as SuggestionBaseIntent,
          prepSpeed: row.prep_speed as SuggestionPrepSpeed,
          source: 'saved',
        }
      : null,
    macroGapContext: payload.macroGapContext ?? null,
    fingerprint: row.fingerprint,
    suggestions: payload.suggestions,
    stretch: payload.stretch,
    createdAt: row.created_at,
    droppedForConstraint: payload.droppedForConstraint ?? 0,
    pool: payload.pool ?? payload.suggestions,
    droppedForDiet: payload.droppedForDiet ?? 0,
  };
}

/**
 * The cached set for today and this mode, whatever its fingerprint — the
 * caller compares fingerprints to decide reuse versus regeneration
 * (decision 40). Returns the most recent row if more than one somehow
 * exists for the same day and mode.
 */
export async function getSuggestionCache(
  localDate: string,
  mode: SuggestionMode,
  targetMacro: SuggestionTargetMacro | null = null,
  preference: TonightSuggestionPreference | null = null,
): Promise<SuggestionSet | null> {
  const row = await db().getFirstAsync<SuggestionCacheRow>(
    `SELECT * FROM suggestion_cache
     WHERE local_date = ? AND mode = ? AND target_macro IS ?
       AND template_id IS ? AND prep_speed IS ?
     ORDER BY created_at DESC LIMIT 1`,
    [localDate, mode, targetMacro, preference?.baseIntent ?? null, preference?.prepSpeed ?? null],
  );
  return row ? toSuggestionSet(row) : null;
}

/**
 * Replaces the cached set for a day and mode. One active set per
 * (local_date, mode): the old row is cleared first so reopening after a
 * regeneration never reads a stale one.
 */
export async function saveSuggestionCache(
  localDate: string,
  mode: SuggestionMode,
  targetMacro: SuggestionTargetMacro | null,
  preference: TonightSuggestionPreference | null,
  fingerprint: string,
  suggestions: Suggestion[],
  stretch: StretchPlan | null,
  droppedForConstraint: number,
  pool: Suggestion[],
  droppedForDiet: number,
  macroGapContext: MacroGapContext | null,
): Promise<SuggestionSet> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const payload: CachedPayload = {
    suggestions, stretch, droppedForConstraint, pool, droppedForDiet, macroGapContext,
  };

  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `DELETE FROM suggestion_cache
       WHERE local_date = ? AND mode = ? AND target_macro IS ?
         AND template_id IS ? AND prep_speed IS ?`,
      [localDate, mode, targetMacro, preference?.baseIntent ?? null, preference?.prepSpeed ?? null],
    );
    await txn.runAsync(
      `INSERT INTO suggestion_cache
       (id, local_date, mode, target_macro, template_id, prep_speed, fingerprint, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, localDate, mode, targetMacro, preference?.baseIntent ?? null, preference?.prepSpeed ?? null,
        fingerprint, JSON.stringify(payload), createdAt],
    );
  });

  return {
    id,
    localDate,
    mode,
    targetMacro,
    tonightPreference: preference,
    macroGapContext,
    fingerprint,
    suggestions,
    stretch,
    createdAt,
    droppedForConstraint,
    pool,
    droppedForDiet,
  };
}

/* -------------------------------------------------------------------------- */
/* Receipts                                                                    */
/* -------------------------------------------------------------------------- */

interface ReceiptRow {
  id: string;
  type: string;
  store: string | null;
  purchased_at: string;
  subtotal_cents: number | null;
  tax_cents: number | null;
  total_cents: number | null;
  image_uri: string;
  status: string;
  frame_edits_locked: number;
  created_at: string;
}

interface ReceiptLineRow {
  id: string;
  receipt_id: string;
  raw_text: string;
  kind: string;
  qty: number | null;
  unit: string | null;
  quantity_kind: string | null;
  line_total_cents: number | null;
  unit_price_cents: number | null;
  canonical_id: string | null;
  applies_to_line_id: string | null;
  pantry_item_id: string | null;
  excluded: number;
  created_at: string;
}

interface ReceiptFrameRow {
  id: string;
  receipt_id: string;
  image_uri: string;
  sort_order: number;
  status: string;
  last_error_kind: string | null;
  store: string | null;
  purchased_at: string | null;
  receipt_type: string | null;
  subtotal_cents: number | null;
  tax_cents: number | null;
  total_cents: number | null;
  created_at: string;
  extracted_at: string | null;
}

interface ReceiptFrameLineRow {
  frame_id: string;
  frame_position: number;
  raw_text: string;
  kind: string;
  qty: number | null;
  unit: string | null;
  quantity_kind: string | null;
  line_total_cents: number | null;
  unit_price_cents: number | null;
  applies_to_text: string | null;
}

interface PendingCaptureRow {
  id: string;
  image_uri: string;
  detected_kind: string | null;
  status: string;
  retry_count: number;
  last_error_kind: string | null;
  created_at: string;
  updated_at: string;
}

/** A small, explicit bound prevents retained camera files growing forever. */
export const MAX_PENDING_CAPTURES = 20;

export class ReceiptFrameEditsLockedError extends Error {
  constructor() {
    super('Finish or discard this receipt before changing its photos.');
    this.name = 'ReceiptFrameEditsLockedError';
  }
}

export class PendingCaptureLimitError extends Error {
  constructor() {
    super(`Only ${MAX_PENDING_CAPTURES} captures can wait at once.`);
    this.name = 'PendingCaptureLimitError';
  }
}

function toPendingCapture(row: PendingCaptureRow): PendingCapture {
  return {
    id: row.id,
    imageUri: row.image_uri,
    detectedKind: row.detected_kind as PendingCaptureKind | null,
    status: row.status as PendingCapture['status'],
    retryCount: row.retry_count,
    lastErrorKind: row.last_error_kind,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toReceipt(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    type: row.type as ReceiptType,
    store: row.store,
    purchasedAt: row.purchased_at,
    subtotalCents: row.subtotal_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    imageUri: row.image_uri,
    status: row.status as Receipt['status'],
    frameEditsLocked: row.frame_edits_locked === 1,
    createdAt: row.created_at,
  };
}

function toReceiptLine(row: ReceiptLineRow): ReceiptLine {
  return {
    id: row.id,
    receiptId: row.receipt_id,
    rawText: row.raw_text,
    kind: row.kind as ReceiptLineKind,
    qty: row.qty,
    unit: row.unit as MeasureUnit | null,
    quantityKind: row.quantity_kind as QuantityKind | null,
    lineTotalCents: row.line_total_cents,
    unitPriceCents: row.unit_price_cents,
    canonicalId: row.canonical_id,
    appliesToLineId: row.applies_to_line_id,
    pantryItemId: row.pantry_item_id,
    excluded: row.excluded === 1,
    createdAt: row.created_at,
  };
}

function toReceiptFrame(row: ReceiptFrameRow): ReceiptFrame {
  return {
    id: row.id,
    receiptId: row.receipt_id,
    imageUri: row.image_uri,
    sortOrder: row.sort_order,
    status: row.status as ReceiptFrame['status'],
    lastErrorKind: row.last_error_kind,
    createdAt: row.created_at,
    extractedAt: row.extracted_at,
  };
}

export interface NewReceiptLine {
  rawText: string;
  kind: ReceiptLineKind;
  qty: number | null;
  unit: MeasureUnit | null;
  quantityKind: QuantityKind | null;
  lineTotalCents: number | null;
  unitPriceCents: number | null;
  /**
   * For a `discount` line only: the exact raw text of the food line it
   * reduces, resolved to that line's real id at insert time. Null for
   * every other kind, and for a discount naming no line.
   */
  appliesToText: string | null;
}

export interface ExtractedReceiptHeader {
  store: string | null;
  purchasedAt: string;
  receiptType: ReceiptType;
  subtotalCents: number | null;
  taxCents: number | null;
  totalCents: number | null;
  lines: NewReceiptLine[];
}

/**
 * Records a receipt the moment it is captured, before extraction has run —
 * the shell a photograph taken offline is retained as (task 7.3). It has
 * no lines yet; `getReceipt` returning zero lines *is* "not yet extracted",
 * so no separate status is needed to say so. `purchasedAt` defaults to the
 * capture date and is overwritten if extraction reads a real one.
 */
export async function insertCapturedReceipt(
  imageUri: string,
  captureDate: string,
): Promise<ReceiptWithLines> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await db().runAsync(
    `INSERT INTO receipts (id, type, store, purchased_at, subtotal_cents, tax_cents, total_cents, image_uri, status, created_at)
     VALUES (?, 'grocery', NULL, ?, NULL, NULL, NULL, ?, 'pending', ?)`,
    [id, captureDate, imageUri, now],
  );
  await db().runAsync(
    `INSERT INTO receipt_frames
       (id, receipt_id, image_uri, sort_order, status, last_error_kind, created_at, extracted_at)
     VALUES (?, ?, ?, 0, 'pending', NULL, ?, NULL)`,
    [randomUUID(), id, imageUri, now],
  );
  const stored = await getReceipt(id);
  if (!stored) throw new Error('Receipt vanished on insert.');
  return stored;
}

/** Frames are ordered photographs of one receipt, retained before extraction. */
export async function addReceiptFrame(
  receiptId: string,
  imageUri: string,
): Promise<ReceiptFrame> {
  await assertReceiptFramesEditable(receiptId);
  const next = await db().getFirstAsync<{ next: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM receipt_frames WHERE receipt_id = ?',
    [receiptId],
  );
  const id = randomUUID();
  const now = new Date().toISOString();
  await db().runAsync(
    `INSERT INTO receipt_frames
       (id, receipt_id, image_uri, sort_order, status, last_error_kind, created_at, extracted_at)
     VALUES (?, ?, ?, ?, 'pending', NULL, ?, NULL)`,
    [id, receiptId, imageUri, next?.next ?? 0, now],
  );
  const stored = await db().getFirstAsync<ReceiptFrameRow>('SELECT * FROM receipt_frames WHERE id = ?', [id]);
  if (!stored) throw new Error('Receipt frame vanished on insert.');
  return toReceiptFrame(stored);
}

async function assertReceiptFramesEditable(receiptId: string): Promise<void> {
  const receipt = await db().getFirstAsync<Pick<ReceiptRow, 'status' | 'frame_edits_locked'>>(
    'SELECT status, frame_edits_locked FROM receipts WHERE id = ?',
    [receiptId],
  );
  if (!receipt) throw new Error('Receipt not found.');
  if (receipt.status !== 'pending' || receipt.frame_edits_locked === 1) {
    throw new ReceiptFrameEditsLockedError();
  }
}

export async function getReceiptFrames(receiptId: string): Promise<ReceiptFrame[]> {
  const rows = await db().getAllAsync<ReceiptFrameRow>(
    'SELECT * FROM receipt_frames WHERE receipt_id = ? ORDER BY sort_order ASC',
    [receiptId],
  );
  return rows.map(toReceiptFrame);
}

export async function recordReceiptFrameFailure(frameId: string, errorKind: string): Promise<void> {
  await db().runAsync(
    "UPDATE receipt_frames SET status = 'failed', last_error_kind = ? WHERE id = ?",
    [errorKind, frameId],
  );
}

/** Stores one frame's complete raw result, then rematerializes the review draft. */
export async function recordReceiptFrameExtraction(
  frameId: string,
  extracted: ExtractedReceiptHeader,
): Promise<void> {
  const now = new Date().toISOString();
  await db().withExclusiveTransactionAsync(async (txn) => {
    const frame = await txn.getFirstAsync<Pick<ReceiptFrameRow, 'receipt_id'>>(
      'SELECT receipt_id FROM receipt_frames WHERE id = ?',
      [frameId],
    );
    if (!frame) throw new Error('Receipt frame not found.');
    const receipt = await txn.getFirstAsync<Pick<ReceiptRow, 'frame_edits_locked'>>(
      'SELECT frame_edits_locked FROM receipts WHERE id = ?',
      [frame.receipt_id],
    );
    if (receipt?.frame_edits_locked === 1) throw new ReceiptFrameEditsLockedError();
    await txn.runAsync('DELETE FROM receipt_frame_lines WHERE frame_id = ?', [frameId]);
    await txn.runAsync(
      `UPDATE receipt_frames
       SET status = 'extracted', last_error_kind = NULL, store = ?, purchased_at = ?, receipt_type = ?,
           subtotal_cents = ?, tax_cents = ?, total_cents = ?, extracted_at = ?
       WHERE id = ?`,
      [
        extracted.store,
        extracted.purchasedAt,
        extracted.receiptType,
        extracted.subtotalCents,
        extracted.taxCents,
        extracted.totalCents,
        now,
        frameId,
      ],
    );
    for (const [position, line] of extracted.lines.entries()) {
      await txn.runAsync(
        `INSERT INTO receipt_frame_lines
           (id, frame_id, frame_position, raw_text, kind, qty, unit, quantity_kind, line_total_cents,
            unit_price_cents, applies_to_text, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(), frameId, position, line.rawText, line.kind, line.qty, line.unit,
          line.quantityKind, line.lineTotalCents, line.unitPriceCents, line.appliesToText, now,
        ],
      );
    }
  });
  const frame = await db().getFirstAsync<Pick<ReceiptFrameRow, 'receipt_id'>>(
    'SELECT receipt_id FROM receipt_frames WHERE id = ?',
    [frameId],
  );
  if (!frame) throw new Error('Receipt frame not found.');
  await rebuildReceiptFromReceipt(frame.receipt_id);
}

/** Recreates unreviewed receipt lines from all extracted frames of one receipt. */
async function rebuildReceiptFromReceipt(receiptId: string): Promise<void> {
  await db().withExclusiveTransactionAsync(async (txn) => {
    const frames = await txn.getAllAsync<ReceiptFrameRow>(
      "SELECT * FROM receipt_frames WHERE receipt_id = ? AND status = 'extracted' ORDER BY sort_order ASC",
      [receiptId],
    );
    const rawLines = await txn.getAllAsync<ReceiptFrameLineRow>(
      `SELECT receipt_frame_lines.* FROM receipt_frame_lines
       JOIN receipt_frames ON receipt_frames.id = receipt_frame_lines.frame_id
       WHERE receipt_frames.receipt_id = ? AND receipt_frames.status = 'extracted'
       ORDER BY receipt_frames.sort_order ASC, receipt_frame_lines.frame_position ASC`,
      [receiptId],
    );
    const linesByFrame = new Map<string, ReceiptFrameLineInput[]>();
    for (const line of rawLines) {
      const lines = linesByFrame.get(line.frame_id) ?? [];
      lines.push({
        rawText: line.raw_text, kind: line.kind, qty: line.qty, unit: line.unit,
        quantityKind: line.quantity_kind, lineTotalCents: line.line_total_cents,
        unitPriceCents: line.unit_price_cents, appliesToText: line.applies_to_text,
      });
      linesByFrame.set(line.frame_id, lines);
    }
    const merged = mergeReceiptFrameLines(frames.map((item) => ({
      frameId: item.id,
      lines: linesByFrame.get(item.id) ?? [],
    })));
    const header = [...frames].reverse().find((item) => item.total_cents !== null) ?? frames.at(-1);
    const now = new Date().toISOString();
    await txn.runAsync('DELETE FROM receipt_lines WHERE receipt_id = ?', [receiptId]);
    if (!header) {
      await txn.runAsync(
        `UPDATE receipts SET store = NULL, type = 'grocery', subtotal_cents = NULL, tax_cents = NULL, total_cents = NULL
         WHERE id = ?`,
        [receiptId],
      );
      return;
    }
    const ids = merged.map(() => randomUUID());
    const idByRawText = new Map<string, string>();
    merged.forEach((line, index) => {
      if (!idByRawText.has(line.rawText)) idByRawText.set(line.rawText, ids[index]!);
    });
    await txn.runAsync(
      `UPDATE receipts SET store = ?, purchased_at = ?, type = ?, subtotal_cents = ?, tax_cents = ?, total_cents = ?
       WHERE id = ?`,
      [header.store, header.purchased_at, header.receipt_type, header.subtotal_cents,
        header.tax_cents, header.total_cents, receiptId],
    );
    for (const [index, line] of merged.entries()) {
      await txn.runAsync(
        `INSERT INTO receipt_lines
           (id, receipt_id, raw_text, kind, qty, unit, quantity_kind, line_total_cents,
            unit_price_cents, canonical_id, applies_to_line_id, pantry_item_id, excluded, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, 0, ?)`,
        [ids[index]!, receiptId, line.rawText, line.kind, line.qty, line.unit,
          line.quantityKind, line.lineTotalCents, line.unitPriceCents,
          line.appliesToText ? (idByRawText.get(line.appliesToText) ?? null) : null, now],
      );
    }
  });
}

/** Removes one retained frame and rematerializes the draft from the survivors. */
export async function removeReceiptFrame(receiptId: string, frameId: string): Promise<string> {
  await assertReceiptFramesEditable(receiptId);
  const frame = await db().getFirstAsync<ReceiptFrameRow>(
    'SELECT * FROM receipt_frames WHERE id = ? AND receipt_id = ?',
    [frameId, receiptId],
  );
  if (!frame) throw new Error('Receipt frame not found.');
  const count = await db().getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM receipt_frames WHERE receipt_id = ?',
    [receiptId],
  );
  if ((count?.count ?? 0) <= 1) throw new Error('A receipt needs at least one photo.');
  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM receipt_frames WHERE id = ?', [frameId]);
    await txn.runAsync(
      `UPDATE receipt_frames
       SET sort_order = sort_order - 1
       WHERE receipt_id = ? AND sort_order > ?`,
      [receiptId, frame.sort_order],
    );
  });
  await rebuildReceiptFromReceipt(receiptId);
  return frame.image_uri;
}

/** Replaces one durable source image while retaining its place in the receipt. */
export async function replaceReceiptFrame(
  receiptId: string,
  frameId: string,
  imageUri: string,
): Promise<string> {
  await assertReceiptFramesEditable(receiptId);
  const frame = await db().getFirstAsync<ReceiptFrameRow>(
    'SELECT * FROM receipt_frames WHERE id = ? AND receipt_id = ?',
    [frameId, receiptId],
  );
  if (!frame) throw new Error('Receipt frame not found.');
  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM receipt_frame_lines WHERE frame_id = ?', [frameId]);
    await txn.runAsync(
      `UPDATE receipt_frames
       SET image_uri = ?, status = 'pending', last_error_kind = NULL, store = NULL, purchased_at = NULL,
           receipt_type = NULL, subtotal_cents = NULL, tax_cents = NULL, total_cents = NULL, extracted_at = NULL
       WHERE id = ?`,
      [imageUri, frameId],
    );
  });
  await rebuildReceiptFromReceipt(receiptId);
  return frame.image_uri;
}

/** Retains an uninterpretable capture without storing a credential or result. */
export async function insertPendingCapture(
  imageUri: string,
  detectedKind: PendingCaptureKind | null = null,
): Promise<PendingCapture> {
  const count = await db().getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM pending_captures',
  );
  if ((count?.count ?? 0) >= MAX_PENDING_CAPTURES) throw new PendingCaptureLimitError();
  const id = randomUUID();
  const now = new Date().toISOString();
  await db().runAsync(
    `INSERT INTO pending_captures
       (id, image_uri, detected_kind, status, retry_count, last_error_kind, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', 0, NULL, ?, ?)`,
    [id, imageUri, detectedKind, now, now],
  );
  return { id, imageUri, detectedKind, status: 'pending', retryCount: 0, lastErrorKind: null, createdAt: now, updatedAt: now };
}

export async function listPendingCaptures(): Promise<PendingCapture[]> {
  const rows = await db().getAllAsync<PendingCaptureRow>(
    'SELECT * FROM pending_captures ORDER BY created_at ASC',
  );
  return rows.map(toPendingCapture);
}

export async function getPendingCapture(id: string): Promise<PendingCapture | null> {
  const row = await db().getFirstAsync<PendingCaptureRow>(
    'SELECT * FROM pending_captures WHERE id = ?', [id],
  );
  return row ? toPendingCapture(row) : null;
}

export async function recordPendingCaptureAttempt(
  id: string,
  errorKind: string | null,
  failed: boolean,
): Promise<void> {
  await db().runAsync(
    `UPDATE pending_captures
     SET retry_count = retry_count + 1, last_error_kind = ?, status = ?, updated_at = ?
     WHERE id = ?`,
    [errorKind, failed ? 'failed' : 'pending', new Date().toISOString(), id],
  );
}

export async function removePendingCapture(id: string): Promise<string | null> {
  const capture = await db().getFirstAsync<PendingCaptureRow>(
    'SELECT * FROM pending_captures WHERE id = ?', [id],
  );
  if (!capture) return null;
  await db().runAsync('DELETE FROM pending_captures WHERE id = ?', [id]);
  return capture.image_uri;
}

/**
 * Attaches a completed extraction to a captured receipt: the header
 * fields extraction read (or corrected from the capture-time defaults)
 * and every line. Called once, when the receipt has no lines yet.
 *
 * Line ids are generated before the insert loop so a discount's
 * `appliesToText` can be resolved to a sibling line's real id in the same
 * pass — the attribution decision.md calls for, without a second query.
 */
export async function attachExtractedLines(
  receiptId: string,
  extracted: ExtractedReceiptHeader,
): Promise<void> {
  const frame = await db().getFirstAsync<ReceiptFrameRow>(
    'SELECT * FROM receipt_frames WHERE receipt_id = ? ORDER BY sort_order ASC LIMIT 1', [receiptId],
  );
  if (frame) {
    await recordReceiptFrameExtraction(frame.id, extracted);
    return;
  }
  const now = new Date().toISOString();
  const ids = extracted.lines.map(() => randomUUID());
  const idByRawText = new Map<string, string>();
  extracted.lines.forEach((line, index) => {
    if (!idByRawText.has(line.rawText)) idByRawText.set(line.rawText, ids[index]!);
  });

  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `UPDATE receipts SET store = ?, purchased_at = ?, type = ?, subtotal_cents = ?, tax_cents = ?, total_cents = ?
       WHERE id = ?`,
      [
        extracted.store,
        extracted.purchasedAt,
        extracted.receiptType,
        extracted.subtotalCents,
        extracted.taxCents,
        extracted.totalCents,
        receiptId,
      ],
    );
    for (const [index, line] of extracted.lines.entries()) {
      const appliesToLineId = line.appliesToText
        ? (idByRawText.get(line.appliesToText) ?? null)
        : null;
      await txn.runAsync(
        `INSERT INTO receipt_lines
           (id, receipt_id, raw_text, kind, qty, unit, quantity_kind, line_total_cents,
            unit_price_cents, canonical_id, applies_to_line_id, pantry_item_id, excluded, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, 0, ?)`,
        [
          ids[index]!,
          receiptId,
          line.rawText,
          line.kind,
          line.qty,
          line.unit,
          line.quantityKind,
          line.lineTotalCents,
          line.unitPriceCents,
          appliesToLineId,
          now,
        ],
      );
    }
  });
}

export async function getReceipt(id: string): Promise<ReceiptWithLines | null> {
  const row = await db().getFirstAsync<ReceiptRow>(
    'SELECT * FROM receipts WHERE id = ?',
    [id],
  );
  if (!row) return null;
  const lineRows = await db().getAllAsync<ReceiptLineRow>(
    'SELECT * FROM receipt_lines WHERE receipt_id = ? ORDER BY rowid ASC',
    [id],
  );
  return { ...toReceipt(row), lines: lineRows.map(toReceiptLine) };
}

/** Every receipt, most recently purchased first. */
export async function listReceipts(): Promise<Receipt[]> {
  const rows = await db().getAllAsync<ReceiptRow>(
    'SELECT * FROM receipts ORDER BY purchased_at DESC, created_at DESC',
  );
  return rows.map(toReceipt);
}

/**
 * Sets a line's matched ingredient — written by resolution when a line
 * settles, and by the user correcting a match during review. The caller is
 * responsible for teaching the matcher a correction via `confirmMatch`;
 * this only updates the receipt's own record.
 */
export async function setReceiptLineCanonical(
  lineId: string,
  canonicalId: string | null,
  manual = false,
): Promise<void> {
  await db().runAsync('UPDATE receipt_lines SET canonical_id = ? WHERE id = ?', [
    canonicalId,
    lineId,
  ]);
  if (manual) await lockReceiptFrameEdits(lineId);
}

/** A quantity or price correction made during review. */
export async function setReceiptLineDetails(
  lineId: string,
  details: { qty: number | null; unit: MeasureUnit | null; lineTotalCents: number | null },
): Promise<void> {
  await db().runAsync(
    'UPDATE receipt_lines SET qty = ?, unit = ?, line_total_cents = ? WHERE id = ?',
    [details.qty, details.unit, details.lineTotalCents, lineId],
  );
  await lockReceiptFrameEdits(lineId);
}

/** Excluding a line during review: it creates no pantry item and is not queued (spec). */
export async function setReceiptLineExcluded(
  lineId: string,
  excluded: boolean,
): Promise<void> {
  await db().runAsync('UPDATE receipt_lines SET excluded = ? WHERE id = ?', [
    excluded ? 1 : 0,
    lineId,
  ]);
  await lockReceiptFrameEdits(lineId);
}

/**
 * Reclassifies a line — recovery from a wrong non-food call (task 8.3). The
 * caller re-resolves afterward if the new kind is `food`; this only
 * updates the record.
 */
export async function setReceiptLineKind(
  lineId: string,
  kind: ReceiptLineKind,
): Promise<void> {
  await db().runAsync('UPDATE receipt_lines SET kind = ? WHERE id = ?', [kind, lineId]);
  await lockReceiptFrameEdits(lineId);
}

/** Any human line edit makes a whole-draft frame rebuild destructive. */
async function lockReceiptFrameEdits(lineId: string): Promise<void> {
  await db().runAsync(
    `UPDATE receipts SET frame_edits_locked = 1
     WHERE id = (SELECT receipt_id FROM receipt_lines WHERE id = ?)`,
    [lineId],
  );
}

export async function setReceiptType(
  receiptId: string,
  type: ReceiptType,
): Promise<void> {
  await db().runAsync('UPDATE receipts SET type = ? WHERE id = ?', [type, receiptId]);
}

export async function discardReceipt(id: string): Promise<void> {
  await db().runAsync("UPDATE receipts SET status = 'discarded' WHERE id = ?", [id]);
}

/** Removes an unaccepted receipt draft and returns its unshared image URI. */
export async function deletePendingReceiptDraft(id: string): Promise<string | null> {
  const receipt = await db().getFirstAsync<ReceiptRow>(
    "SELECT * FROM receipts WHERE id = ? AND status = 'pending'", [id],
  );
  if (!receipt) return null;
  await db().runAsync("DELETE FROM receipts WHERE id = ? AND status = 'pending'", [id]);
  return receipt.image_uri;
}

/** Removes a pending receipt draft and returns every distinct retained frame image. */
export async function deletePendingReceiptFrames(id: string): Promise<string[]> {
  const receipt = await db().getFirstAsync<ReceiptRow>(
    "SELECT * FROM receipts WHERE id = ? AND status = 'pending'", [id],
  );
  if (!receipt) return [];
  const frames = await db().getAllAsync<{ image_uri: string }>(
    'SELECT image_uri FROM receipt_frames WHERE receipt_id = ?', [id],
  );
  await db().runAsync("DELETE FROM receipts WHERE id = ? AND status = 'pending'", [id]);
  return [...new Set(frames.map((frame) => frame.image_uri).concat(receipt.image_uri))];
}

/**
 * Removes the pantry items this receipt's lines created, and forgets the
 * link — used when the receipt type changes away from grocery after
 * having already been applied (task 8.4's "re-planning rather than
 * undoing"). Reconciliation side effects on *other* items (a mark as
 * replaced, an asked-once flag) are not reversed: the spec asks only that
 * the created items go, not that the rest of the catalogue's history be
 * rewritten.
 */
export async function clearReceiptPantryItems(receiptId: string): Promise<void> {
  await db().withExclusiveTransactionAsync(async (txn) => {
    // The authoritative link: a count line's several containers all carry
    // receipt_line_id, where receipt_lines.pantry_item_id only ever named one.
    await txn.runAsync(
      `DELETE FROM pantry_items WHERE receipt_line_id IN
         (SELECT id FROM receipt_lines WHERE receipt_id = ?)`,
      [receiptId],
    );
    await txn.runAsync(
      `UPDATE receipt_lines SET pantry_item_id = NULL WHERE receipt_id = ?`,
      [receiptId],
    );
  });
}

/**
 * Applies a receipt's planned changes in one transaction: creates the
 * pantry items a grocery receipt's resolved lines call for, links each
 * line to the item it created, marks superseded items replaced, flags
 * running-low items for the asked-once prompt, and marks the receipt
 * applied. Nothing is applied before this runs (task 6.3) — an abandoned
 * review simply never calls it, leaving no trace.
 */
export async function applyReceiptChanges(
  receiptId: string,
  changes: readonly PantryChange[],
): Promise<void> {
  const now = new Date().toISOString();
  // A count line creates several items from one `create` change each; only
  // the first links back via receipt_lines.pantry_item_id (a single-item
  // pointer, kept for the common case). `pantry_items.receipt_line_id` is
  // the authoritative one-to-many link every item gets, count or not.
  const linkedLines = new Set<string>();

  await db().withExclusiveTransactionAsync(async (txn) => {
    for (const change of changes) {
      if (change.kind === 'create') {
        const itemId = randomUUID();
        const { item } = change;
        const expiresAt = await predictExpiryWithin(txn, item.canonicalId, item.locationId, item.purchasedAt);
        await txn.runAsync(
          `INSERT INTO pantry_items
             (id, canonical_id, product_id, location_id, qty_remaining, qty_unit,
              qty_source, fullness, uses_count, purchased_at, opened_at, expires_at,
              expiry_source, price_cents, photo_uri, status, receipt_line_id, created_at, updated_at)
           VALUES (?, ?, NULL, ?, ?, ?, ?, NULL, 0, ?, NULL, ?, ?, ?, NULL, 'in_stock', ?, ?, ?)`,
          [
            itemId,
            item.canonicalId,
            item.locationId,
            item.qtyRemaining,
            item.qtyUnit,
            item.qtyRemaining != null ? 'estimate' : null,
            item.purchasedAt,
            expiresAt,
            expiresAt != null ? 'predicted' : null,
            item.priceCents,
            change.lineId,
            now,
            now,
          ],
        );
        if (!linkedLines.has(change.lineId)) {
          linkedLines.add(change.lineId);
          await txn.runAsync(
            'UPDATE receipt_lines SET pantry_item_id = ? WHERE id = ?',
            [itemId, change.lineId],
          );
        }
      } else if (change.kind === 'mark_replaced') {
        await txn.runAsync(
          "UPDATE pantry_items SET status = 'replaced', updated_at = ? WHERE id = ?",
          [now, change.pantryItemId],
        );
      } else {
        await txn.runAsync(
          'UPDATE pantry_items SET replacement_asked = 1, updated_at = ? WHERE id = ?',
          [now, change.pantryItemId],
        );
      }
    }

    await txn.runAsync("UPDATE receipts SET status = 'applied' WHERE id = ?", [receiptId]);
  });
}

/** Expiry prediction for a receipt-created item, read fresh within the transaction. */
async function predictExpiryWithin(
  txn: TransactionHandle,
  canonicalId: string,
  locationId: string,
  purchasedAt: string,
): Promise<string | null> {
  const canonical = await txn.getFirstAsync<CanonicalItemRow>(
    'SELECT * FROM canonical_items WHERE id = ?',
    [canonicalId],
  );
  const location = await txn.getFirstAsync<LocationRow>(
    'SELECT * FROM locations WHERE id = ?',
    [locationId],
  );
  if (!canonical || !location) return null;
  return predictExpiry(
    toCanonicalItem(canonical),
    location.kind as LocationKind,
    purchasedAt,
    null,
  );
}

/* -------------------------------------------------------------------------- */
/* Dietary profile                                                            */
/* -------------------------------------------------------------------------- */

interface DietaryRuleRow {
  id: string;
  kind: string;
  canonical_id: string | null;
  text: string;
  normalised_text: string;
  created_at: string;
}

function toDietaryRule(row: DietaryRuleRow): DietaryRule {
  return {
    id: row.id,
    kind: row.kind as DietaryRuleKind,
    canonicalId: row.canonical_id,
    text: row.text,
    normalisedText: row.normalised_text,
    createdAt: row.created_at,
  };
}

export interface NewDietaryRule {
  kind: DietaryRuleKind;
  canonicalId: string | null;
  text: string;
  normalisedText: string;
}

export async function createDietaryRule(input: NewDietaryRule): Promise<DietaryRule> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  await db().runAsync(
    `INSERT INTO dietary_rules (id, kind, canonical_id, text, normalised_text, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.kind, input.canonicalId, input.text, input.normalisedText, createdAt],
  );
  return { id, kind: input.kind, canonicalId: input.canonicalId, text: input.text, normalisedText: input.normalisedText, createdAt };
}

export async function listDietaryRules(): Promise<DietaryRule[]> {
  const rows = await db().getAllAsync<DietaryRuleRow>(
    'SELECT * FROM dietary_rules ORDER BY created_at ASC',
  );
  return rows.map(toDietaryRule);
}

/** Changing a rule's kind changes only its enforcement policy — the text and resolution stand. */
export async function updateDietaryRuleKind(
  id: string,
  kind: DietaryRuleKind,
): Promise<void> {
  await db().runAsync('UPDATE dietary_rules SET kind = ? WHERE id = ?', [kind, id]);
}

export async function deleteDietaryRule(id: string): Promise<void> {
  await db().runAsync('DELETE FROM dietary_rules WHERE id = ?', [id]);
}

/**
 * Every canonical id derived from any of `canonicalIds`, transitively,
 * including the seeds themselves. A recursive query per seed rather than a
 * stored closure (design: "the graph is tiny and shallow") — plain `UNION`
 * (not `UNION ALL`) drops a row the moment its id has already appeared, so a
 * cyclical edit to the catalogue terminates instead of hanging (task 3.6).
 */
export async function expandDerivatives(
  canonicalIds: readonly string[],
): Promise<Set<string>> {
  const result = new Set<string>();
  for (const seed of canonicalIds) {
    const rows = await db().getAllAsync<{ id: string }>(
      `WITH RECURSIVE closure(id) AS (
         SELECT ?
         UNION
         SELECT cd.child_id FROM canonical_derivatives cd
         JOIN closure ON cd.parent_id = closure.id
       )
       SELECT id FROM closure`,
      [seed],
    );
    for (const row of rows) result.add(row.id);
  }
  return result;
}

/**
 * Every derivative edge, flat. The graph is small enough to load whole
 * (design.md: "tiny and shallow") — `src/logic/dietary.ts`'s `expandRules`
 * is the pure function that actually walks it, so a rule set can be
 * expanded without a database in a test.
 */
export async function listDerivativeEdges(): Promise<
  { parentId: string; childId: string }[]
> {
  const rows = await db().getAllAsync<{ parent_id: string; child_id: string }>(
    'SELECT parent_id, child_id FROM canonical_derivatives',
  );
  return rows.map((row) => ({ parentId: row.parent_id, childId: row.child_id }));
}
