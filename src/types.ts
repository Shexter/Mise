/** Shared domain types. Mirrors the SQLite schema in `src/db/schema.ts`. */

export type Sex = 'male' | 'female';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

export type Goal = 'lose' | 'maintain' | 'gain';

export type Units = 'metric' | 'imperial';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type MealSource = 'photo' | 'manual';

export type Confidence = 'high' | 'medium' | 'low';

export type MeasureUnit =
  | 'g'
  | 'ml'
  | 'piece'
  | 'cup'
  | 'tbsp'
  | 'tsp'
  | 'slice'
  | 'serving';

export const MEASURE_UNITS: readonly MeasureUnit[] = [
  'g',
  'ml',
  'piece',
  'cup',
  'tbsp',
  'tsp',
  'slice',
  'serving',
];

export const MEAL_TYPES: readonly MealType[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
];

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  targetCalories: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  units: Units;
  onboardedAt: string;
}

export interface MealItem {
  id: string;
  mealId: string;
  name: string;
  quantity: number;
  unit: MeasureUnit;
  /** Calories for the whole row, i.e. already multiplied by `quantity`. */
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isManualAddition: boolean;
  sortOrder: number;
}

export interface Meal {
  id: string;
  loggedAt: string;
  localDate: string;
  mealType: MealType;
  name: string;
  photoUri: string | null;
  source: MealSource;
  confidence: Confidence | null;
  createdAt: string;
}

export interface MealWithItems extends Meal {
  items: MealItem[];
}

export interface Macros {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface DailyTarget {
  localDate: string;
  targetCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** A hidden-ingredient quick-pick, loaded from `assets/hidden-ingredients.json`. */
export interface HiddenIngredient {
  name: string;
  defaultQuantity: number;
  unit: MeasureUnit;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Links the quick-pick to its canonical ingredient, where one exists. */
  canonicalId?: string;
}

/* -------------------------------------------------------------------------- */
/* Ingredient identity                                                         */
/* -------------------------------------------------------------------------- */

/** How an ingredient depletes. Orthogonal to where it is stored. */
export type FoodClass =
  | 'staple'
  | 'produce'
  | 'protein'
  | 'dairy'
  | 'seasoning'
  | 'condiment'
  | 'frozen'
  | 'beverage';

export const FOOD_CLASSES: readonly FoodClass[] = [
  'staple',
  'produce',
  'protein',
  'dairy',
  'seasoning',
  'condiment',
  'frozen',
  'beverage',
];

/** Where an ingredient lives by default. Drives expiry, never depletion. */
export type StorageLocation = 'pantry' | 'fridge' | 'freezer' | 'counter';

export const STORAGE_LOCATIONS: readonly StorageLocation[] = [
  'pantry',
  'fridge',
  'freezer',
  'counter',
];

/** The channel a food reference or alias came from. */
export type ReferenceSource =
  | 'seed'
  | 'barcode'
  | 'receipt'
  | 'vision'
  | 'meal_log'
  | 'user';

export const REFERENCE_SOURCES: readonly ReferenceSource[] = [
  'seed',
  'barcode',
  'receipt',
  'vision',
  'meal_log',
  'user',
];

/** The food concept — one row per real-world ingredient. `id` is the slug. */
export interface CanonicalItem {
  id: string;
  displayName: string;
  foodClass: FoodClass;
  defaultLocation: StorageLocation;
  /** Unopened shelf life in days, keyed by location. */
  shelfLifeDays: Partial<Record<StorageLocation, number>>;
  /** Days once opened; null where opening changes nothing. */
  openLifeDays: number | null;
  typicalUseQty: number | null;
  typicalUseUnit: MeasureUnit | null;
  typicalPkgQty: number | null;
  typicalPkgUnit: MeasureUnit | null;
  densityGPerMl: number | null;
  isSeed: boolean;
  createdAt: string;
}

/** One observed name for a canonical ingredient. */
export interface ItemAlias {
  id: string;
  aliasNorm: string;
  aliasRaw: string;
  canonicalId: string;
  source: ReferenceSource;
  locale: string | null;
  confidence: number;
  timesConfirmed: number;
  createdAt: string;
}

/** A specific purchasable SKU, always tied to one canonical ingredient. */
export interface Product {
  id: string;
  gtin: string | null;
  brand: string | null;
  name: string;
  pkgQty: number | null;
  pkgUnit: MeasureUnit | null;
  canonicalId: string;
  kcalPer100: number | null;
  proteinPer100: number | null;
  carbsPer100: number | null;
  fatPer100: number | null;
  source: ReferenceSource;
  fetchedAt: string | null;
}

/* -------------------------------------------------------------------------- */
/* Pantry stock                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The closed set the shelf-life lookup keys off. Location *names* are free
 * text the user owns; a "Chest freezer" and a "Garage freezer" are both kind
 * `freezer` and get freezer shelf life without the lookup knowing either name.
 */
export type LocationKind = 'fridge' | 'freezer' | 'ambient' | 'counter';

export const LOCATION_KINDS: readonly LocationKind[] = [
  'fridge',
  'freezer',
  'ambient',
  'counter',
];

/** A storage location. User-editable; four defaults ship with the schema. */
export interface Location {
  id: string;
  name: string;
  kind: LocationKind;
  sortOrder: number;
}

/** The four-bucket fullness for uses-tracked items (decision 14). */
export type Fullness = 'full' | 'half' | 'low' | 'out';

export const FULLNESS_LEVELS: readonly Fullness[] = [
  'full',
  'half',
  'low',
  'out',
];

/** Advisory only (decision 15) — never rendered as a number. */
export type StockStatus = 'in_stock' | 'running_low' | 'out' | 'discarded';

export const STOCK_STATUSES: readonly StockStatus[] = [
  'in_stock',
  'running_low',
  'out',
  'discarded',
];

/** Where an item's expiry date came from. A user or label date is never
 * overwritten by a recompute. */
export type ExpirySource = 'predicted' | 'label' | 'user';

/** Who last set `qtyRemaining`: the user's own entry may be echoed back to
 * them; an estimate must never be displayed. */
export type QuantitySource = 'user' | 'estimate';

/** One physical thing in the kitchen. Three tins are three rows. */
export interface PantryItem {
  id: string;
  canonicalId: string;
  productId: string | null;
  locationId: string;
  qtyRemaining: number | null;
  qtyUnit: MeasureUnit | null;
  qtySource: QuantitySource | null;
  fullness: Fullness | null;
  usesCount: number;
  /** Local date (yyyy-MM-dd) the item was acquired. */
  purchasedAt: string;
  openedAt: string | null;
  expiresAt: string | null;
  expirySource: ExpirySource | null;
  priceCents: number | null;
  photoUri: string | null;
  status: StockStatus;
  createdAt: string;
  updatedAt: string;
}

/** A reference the cascade could not resolve, waiting for review. */
export interface QueuedMatch {
  id: string;
  rawText: string;
  source: ReferenceSource;
  /** JSON captured at scan time: receipt id, price, quantity. */
  context: string | null;
  suggestedId: string | null;
  confidence: number | null;
  createdAt: string;
}

/** A single detected food, as returned by the vision model. */
export interface EstimatedItem {
  name: string;
  quantity: number;
  unit: MeasureUnit;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** A parsed, validated vision response. */
export interface MealEstimate {
  mealName: string;
  confidence: Confidence;
  items: EstimatedItem[];
  likelyHiddenIngredients: string[];
}
