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
