import { randomUUID } from 'expo-crypto';

import canonicalSeed from '../../assets/canonical-items.json';
import aliasSeed from '../../assets/item-aliases.json';

import { db } from '@/db';
import { localDateString } from '@/logic/dates';
import {
  canRecomputeExpiry,
  freezeExpiry,
  predictExpiry,
} from '@/logic/expiry';
import { macroTargets } from '@/logic/macros';
import { normalise } from '@/logic/normalise';
import type {
  CanonicalItem,
  Confidence,
  DailyTarget,
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
  MealWithItems,
  PantryItem,
  Product,
  Profile,
  QuantitySource,
  QueuedMatch,
  ReferenceSource,
  StockStatus,
  StorageLocation,
} from '@/types';

/* -------------------------------------------------------------------------- */
/* Row shapes                                                                  */
/* -------------------------------------------------------------------------- */

interface ProfileRow {
  sex: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  activity_level: string;
  goal: string;
  target_calories: number;
  protein_pct: number;
  carbs_pct: number;
  fat_pct: number;
  units: string;
  onboarded_at: string;
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
  created_at: string;
}

interface MealItemRow {
  id: string;
  meal_id: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  is_manual_addition: number;
  sort_order: number;
}

interface DailyTargetRow {
  local_date: string;
  target_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
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
    proteinPct: row.protein_pct,
    carbsPct: row.carbs_pct,
    fatPct: row.fat_pct,
    units: row.units as Profile['units'],
    onboardedAt: row.onboarded_at,
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
    isManualAddition: row.is_manual_addition === 1,
    sortOrder: row.sort_order,
  };
}

function toDailyTarget(row: DailyTargetRow): DailyTarget {
  return {
    localDate: row.local_date,
    targetCalories: row.target_calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
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
       target_calories, protein_pct, carbs_pct, fat_pct, units, onboarded_at
     ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
       units = excluded.units`,
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
      profile.units,
      profile.onboardedAt,
    ],
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
  };
  await db().runAsync(
    `INSERT OR IGNORE INTO daily_targets
       (local_date, target_calories, protein_g, carbs_g, fat_g)
     VALUES (?, ?, ?, ?, ?)`,
    [
      target.localDate,
      target.targetCalories,
      target.proteinG,
      target.carbsG,
      target.fatG,
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
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isManualAddition: boolean;
}

export interface NewMeal {
  loggedAt: string;
  localDate: string;
  mealType: MealType;
  name: string;
  photoUri: string | null;
  source: MealSource;
  confidence: Confidence | null;
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
    isManualAddition: item.isManualAddition,
    sortOrder: index,
  }));

  const stored: MealWithItems = {
    id: mealId,
    loggedAt: meal.loggedAt,
    localDate: meal.localDate,
    mealType: meal.mealType,
    name: meal.name,
    photoUri: meal.photoUri,
    source: meal.source,
    confidence: meal.confidence,
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
         (id, logged_at, local_date, meal_type, name, photo_uri, source, confidence, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        meal.id,
        meal.loggedAt,
        meal.localDate,
        meal.mealType,
        meal.name,
        meal.photoUri,
        meal.source,
        meal.confidence,
        meal.createdAt,
      ],
    );
    for (const item of meal.items) {
      await txn.runAsync(
        `INSERT INTO meal_items
           (id, meal_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g,
            is_manual_addition, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          item.isManualAddition ? 1 : 0,
          item.sortOrder,
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

export async function deleteMeal(id: string): Promise<void> {
  await db().runAsync('DELETE FROM meals WHERE id = ?', [id]);
}

/** Every date that has at least one logged meal. */
export async function getLoggedDates(): Promise<string[]> {
  const rows = await db().getAllAsync<{ local_date: string }>(
    'SELECT DISTINCT local_date FROM meals',
  );
  return rows.map((row) => row.local_date);
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
  open_life_days: number | null;
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
  canonical_id: string;
  kcal_per_100: number | null;
  protein_per_100: number | null;
  carbs_per_100: number | null;
  fat_per_100: number | null;
  source: string;
  fetched_at: string | null;
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
    openLifeDays: row.open_life_days,
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
    canonicalId: row.canonical_id,
    kcalPer100: row.kcal_per_100,
    proteinPer100: row.protein_per_100,
    carbsPer100: row.carbs_per_100,
    fatPer100: row.fat_per_100,
    source: row.source as ReferenceSource,
    fetchedAt: row.fetched_at,
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
  openLifeDays?: number | null;
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

/**
 * Loads the shipped canonical ingredients and aliases. Idempotent: canonicals
 * are keyed on their slug and aliases on the unique `(alias_norm,
 * canonical_id)` pair, so re-running after a seed-version bump inserts only
 * what is new and never duplicates what is there. Each canonical's display
 * name is also registered as an alias so the display name itself always
 * resolves.
 */
export async function loadSeedData(): Promise<void> {
  const now = new Date().toISOString();
  const canonicals = canonicalSeed as CanonicalSeedEntry[];
  const aliases = aliasSeed as AliasSeedEntry[];

  await db().withExclusiveTransactionAsync(async (txn) => {
    for (const entry of canonicals) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO canonical_items
           (id, display_name, class, default_location, shelf_life_days,
            open_life_days, typical_use_qty, typical_use_unit,
            typical_pkg_qty, typical_pkg_unit, density_g_per_ml, is_seed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          entry.id,
          entry.displayName,
          entry.class,
          entry.defaultLocation,
          JSON.stringify(entry.shelfLifeDays),
          entry.openLifeDays ?? null,
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
  });
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
 * The candidate prefilter for approximate matching: aliases sharing the
 * reference's first trigram or any whole token. Bounds the set scored in
 * TypeScript so a lookup never scans the whole table.
 */
export async function getCandidateAliases(norm: string): Promise<ItemAlias[]> {
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

/* -------------------------------------------------------------------------- */
/* Ingredient identity: writes                                                 */
/* -------------------------------------------------------------------------- */

export interface NewCanonicalItem {
  id: string;
  displayName: string;
  foodClass: FoodClass;
  defaultLocation: StorageLocation;
  shelfLifeDays: Partial<Record<StorageLocation, number>>;
  openLifeDays?: number | null;
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
        open_life_days, typical_use_qty, typical_use_unit,
        typical_pkg_qty, typical_pkg_unit, density_g_per_ml, is_seed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      item.id,
      item.displayName,
      item.foodClass,
      item.defaultLocation,
      JSON.stringify(item.shelfLifeDays),
      item.openLifeDays ?? null,
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
    openLifeDays: item.openLifeDays ?? null,
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
      normalise(alias.aliasRaw),
      alias.aliasRaw,
      alias.canonicalId,
      alias.source,
      alias.locale ?? null,
      alias.confidence ?? 1,
      new Date().toISOString(),
    ],
  );
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
  canonicalId: string;
  kcalPer100?: number | null;
  proteinPer100?: number | null;
  carbsPer100?: number | null;
  fatPer100?: number | null;
  source: ReferenceSource;
}

export async function insertProduct(product: NewProduct): Promise<Product> {
  const id = randomUUID();
  const fetchedAt = new Date().toISOString();
  await db().runAsync(
    `INSERT INTO products
       (id, gtin, brand, name, pkg_qty, pkg_unit, canonical_id,
        kcal_per_100, protein_per_100, carbs_per_100, fat_per_100, source, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      product.gtin ?? null,
      product.brand ?? null,
      product.name,
      product.pkgQty ?? null,
      product.pkgUnit ?? null,
      product.canonicalId,
      product.kcalPer100 ?? null,
      product.proteinPer100 ?? null,
      product.carbsPer100 ?? null,
      product.fatPer100 ?? null,
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
    canonicalId: product.canonicalId,
    kcalPer100: product.kcalPer100 ?? null,
    proteinPer100: product.proteinPer100 ?? null,
    carbsPer100: product.carbsPer100 ?? null,
    fatPer100: product.fatPer100 ?? null,
    source: product.source,
    fetchedAt,
  };
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
      input.qtyRemaining != null ? 'user' : null,
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

export async function getPantryItem(id: string): Promise<PantryItem | null> {
  const row = await db().getFirstAsync<PantryItemRow>(
    'SELECT * FROM pantry_items WHERE id = ?',
    [id],
  );
  return row ? toPantryItem(row) : null;
}

/**
 * The catalogue, soonest expiry first; undated items follow dated ones and
 * discarded items are excluded.
 */
export async function listPantryItems(): Promise<PantryItem[]> {
  const rows = await db().getAllAsync<PantryItemRow>(
    `SELECT * FROM pantry_items
     WHERE status != 'discarded'
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
  await touchPantryItem(id, 'fullness = ?, status = ?', [
    fullness,
    fullness === 'out' ? 'out' : 'in_stock',
  ]);
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
/* Export and wipe                                                             */
/* -------------------------------------------------------------------------- */

export interface ExportBundle {
  exportedAt: string;
  schemaVersion: number;
  profile: Profile | null;
  dailyTargets: DailyTarget[];
  meals: MealWithItems[];
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
  };
}
