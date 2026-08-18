import { addDays, subDays } from 'date-fns';

import {
  ensureDailyTarget,
  insertMeal,
  insertPantryItem,
  insertProduct,
  insertRecipe,
  markItemRunningLow,
  markProductScanned,
  saveProfile,
  setItemFullness,
  type NewMealItem,
} from '@/db/queries';
import { localDateString } from '@/logic/dates';
import type { MealSource, MealType, MealVenue, Profile } from '@/types';

export interface DemoDataSummary {
  meals: number;
  pantryItems: number;
  barcodeScans: number;
  recipes: number;
}

const profile: Profile = {
  sex: 'male',
  age: 34,
  heightCm: 178,
  weightKg: 76,
  activityLevel: 'moderate',
  goal: 'maintain',
  targetCalories: 2_250,
  targetSource: 'estimated',
  statedCalories: null,
  statedFigureKind: null,
  proteinPct: 0.3,
  carbsPct: 0.4,
  fatPct: 0.3,
  fibreTargetG: 30,
  units: 'metric',
  onboardedAt: '2026-01-15T18:00:00.000Z',
  targetWeightKg: null,
  weightGoalRateKgPerWeek: null,
};

interface DemoMeal {
  daysAgo: number;
  hour: string;
  mealType: MealType;
  name: string;
  source: MealSource;
  venue: MealVenue;
  items: NewMealItem[];
}

function item(
  name: string,
  calories: number,
  proteinG: number,
  carbsG: number,
  fatG: number,
  fibreG: number,
  canonicalId: string | null = null,
): NewMealItem {
  return {
    name,
    quantity: 1,
    unit: 'serving',
    calories,
    proteinG,
    carbsG,
    fatG,
    fibreG,
    isManualAddition: false,
    canonicalId,
  };
}

const meals: readonly DemoMeal[] = [
  { daysAgo: 0, hour: '08:10', mealType: 'breakfast', name: 'Yogurt, oats and banana', source: 'manual', venue: 'home', items: [item('Greek yogurt', 180, 18, 14, 5, 0, 'greek-yogurt'), item('Rolled oats and banana', 260, 8, 49, 5, 8)] },
  { daysAgo: 0, hour: '12:35', mealType: 'lunch', name: 'Miso tofu rice bowl', source: 'recipe', venue: 'home', items: [item('Firm tofu', 210, 23, 7, 11, 3, 'tofu-firm'), item('Jasmine rice', 310, 6, 68, 1, 1, 'jasmine-rice'), item('Miso vegetables', 120, 5, 17, 4, 5, 'miso')] },
  { daysAgo: 1, hour: '08:00', mealType: 'breakfast', name: 'Eggs on toast', source: 'photo', venue: 'home', items: [item('Eggs', 210, 18, 1, 14, 0, 'eggs'), item('Sourdough toast', 220, 8, 42, 3, 4)] },
  { daysAgo: 1, hour: '13:05', mealType: 'lunch', name: 'Chicken and tomato salad', source: 'photo', venue: 'out', items: [item('Chicken salad', 540, 42, 31, 25, 8)] },
  { daysAgo: 1, hour: '19:15', mealType: 'dinner', name: 'Salmon, potatoes and greens', source: 'manual', venue: 'home', items: [item('Salmon', 330, 38, 0, 19, 0, 'salmon'), item('Potatoes and greens', 360, 10, 63, 8, 11)] },
  { daysAgo: 2, hour: '08:25', mealType: 'breakfast', name: 'Overnight oats', source: 'recipe', venue: 'home', items: [item('Overnight oats', 470, 20, 65, 14, 11, 'oats')] },
  { daysAgo: 2, hour: '12:20', mealType: 'lunch', name: 'Leftover salmon bowl', source: 'manual', venue: 'leftovers', items: [item('Salmon rice bowl', 610, 39, 68, 19, 7)] },
  { daysAgo: 2, hour: '19:40', mealType: 'dinner', name: 'Tomato chicken pasta', source: 'recipe', venue: 'home', items: [item('Chicken breast', 240, 45, 0, 5, 0, 'chicken-breast'), item('Tomato pasta', 510, 15, 92, 9, 10, 'dried-pasta')] },
  { daysAgo: 4, hour: '08:15', mealType: 'breakfast', name: 'Cheddar omelette', source: 'manual', venue: 'home', items: [item('Cheddar omelette', 430, 30, 4, 32, 1, 'eggs')] },
  { daysAgo: 4, hour: '18:50', mealType: 'dinner', name: 'Tofu stir-fry', source: 'photo', venue: 'home', items: [item('Tofu stir-fry', 690, 34, 76, 28, 13, 'tofu-firm')] },
  { daysAgo: 6, hour: '12:45', mealType: 'lunch', name: 'Sushi lunch', source: 'photo', venue: 'out', items: [item('Salmon sushi set', 720, 35, 102, 19, 6)] },
  { daysAgo: 7, hour: '19:10', mealType: 'dinner', name: 'Miso chicken and rice', source: 'recipe', venue: 'home', items: [item('Miso chicken', 390, 47, 15, 15, 2, 'chicken-thigh'), item('Jasmine rice', 330, 6, 72, 1, 1, 'jasmine-rice')] },
  { daysAgo: 10, hour: '18:35', mealType: 'dinner', name: 'Pasta with tomato and cheddar', source: 'manual', venue: 'home', items: [item('Tomato pasta', 760, 27, 109, 24, 12, 'dried-pasta')] },
  { daysAgo: 14, hour: '12:10', mealType: 'lunch', name: 'Cafe grain bowl', source: 'photo', venue: 'out', items: [item('Grain and vegetable bowl', 640, 24, 82, 24, 15)] },
];

/** Adds a repeatable, representative dataset after the caller has reset storage. */
export async function populateDemoData(now: Date = new Date()): Promise<DemoDataSummary> {
  await saveProfile(profile);

  // Keep writes serial. The Node test database tolerates concurrent writes,
  // while Expo SQLite may reject them on a device during a reset/reseed pass.
  const products = [];
  products.push(await insertProduct({ gtin: '0000000001014', brand: 'Kitchen Test', name: 'Light Soy Sauce', pkgQty: 500, pkgUnit: 'ml', canonicalId: 'soy-sauce-light', kcalPer100: 53, proteinPer100: 8.1, carbsPer100: 4.9, fatPer100: 0.6, source: 'barcode' }));
  products.push(await insertProduct({ gtin: '0000000001021', brand: 'Kitchen Test', name: 'Greek Yogurt', pkgQty: 750, pkgUnit: 'g', canonicalId: 'greek-yogurt', kcalPer100: 97, proteinPer100: 9, carbsPer100: 3.9, fatPer100: 5, source: 'barcode' }));
  products.push(await insertProduct({ gtin: '0000000001038', brand: 'Kitchen Test', name: 'Firm Tofu', pkgQty: 400, pkgUnit: 'g', canonicalId: 'tofu-firm', kcalPer100: 144, proteinPer100: 17, carbsPer100: 3, fatPer100: 8, source: 'user' }));
  products.push(await insertProduct({ gtin: '0000000001045', brand: 'Kitchen Test', name: 'Rolled Oats', pkgQty: 1_000, pkgUnit: 'g', canonicalId: 'oats', kcalPer100: 379, proteinPer100: 13, carbsPer100: 68, fatPer100: 6.5, source: 'barcode' }));

  for (const [index, product] of products.entries()) {
    await markProductScanned(product.id, subDays(now, index).toISOString());
  }

  const pantryInputs = [
    { canonicalId: 'soy-sauce-light', locationId: 'pantry', productId: products[0]!.id, qtyRemaining: 500, qtyUnit: 'ml' as const, priceCents: 499 },
    { canonicalId: 'greek-yogurt', locationId: 'fridge', productId: products[1]!.id, qtyRemaining: 750, qtyUnit: 'g' as const, priceCents: 749 },
    { canonicalId: 'tofu-firm', locationId: 'fridge', productId: products[2]!.id, qtyRemaining: 400, qtyUnit: 'g' as const, priceCents: 399, expiresAt: localDateString(addDays(now, 4)), expirySource: 'user' as const },
    { canonicalId: 'oats', locationId: 'pantry', productId: products[3]!.id, qtyRemaining: 1_000, qtyUnit: 'g' as const, priceCents: 699 },
    { canonicalId: 'jasmine-rice', locationId: 'pantry', qtyRemaining: 5_000, qtyUnit: 'g' as const, priceCents: 1899 },
    { canonicalId: 'dried-pasta', locationId: 'pantry', qtyRemaining: 500, qtyUnit: 'g' as const, priceCents: 349 },
    { canonicalId: 'olive-oil', locationId: 'pantry', qtyRemaining: 750, qtyUnit: 'ml' as const, priceCents: 1499 },
    { canonicalId: 'miso', locationId: 'fridge', qtyRemaining: 500, qtyUnit: 'g' as const, priceCents: 899 },
    { canonicalId: 'eggs', locationId: 'fridge', qtyRemaining: 12, qtyUnit: 'piece' as const, priceCents: 649 },
    { canonicalId: 'milk', locationId: 'fridge', qtyRemaining: 2_000, qtyUnit: 'ml' as const, priceCents: 599, expiresAt: localDateString(addDays(now, 6)), expirySource: 'user' as const },
    { canonicalId: 'cheddar-cheese', locationId: 'fridge', qtyRemaining: 400, qtyUnit: 'g' as const, priceCents: 899 },
    { canonicalId: 'chicken-breast', locationId: 'freezer', qtyRemaining: 1_200, qtyUnit: 'g' as const, priceCents: 1699 },
    { canonicalId: 'salmon', locationId: 'freezer', qtyRemaining: 800, qtyUnit: 'g' as const, priceCents: 2199 },
    { canonicalId: 'tomato', locationId: 'counter', qtyRemaining: 6, qtyUnit: 'piece' as const, priceCents: 599, expiresAt: localDateString(addDays(now, 3)), expirySource: 'user' as const },
    { canonicalId: 'banana', locationId: 'counter', qtyRemaining: 5, qtyUnit: 'piece' as const, priceCents: 399, expiresAt: localDateString(addDays(now, 2)), expirySource: 'user' as const },
    { canonicalId: 'yellow-onion', locationId: 'counter', qtyRemaining: 4, qtyUnit: 'piece' as const, priceCents: 299 },
    { canonicalId: 'garlic', locationId: 'counter', qtyRemaining: 3, qtyUnit: 'piece' as const, priceCents: 249 },
    { canonicalId: 'coffee-beans', locationId: 'pantry', qtyRemaining: 340, qtyUnit: 'g' as const, priceCents: 1599 },
  ];

  const pantryItems = [];
  for (const input of pantryInputs) pantryItems.push(await insertPantryItem(input));
  await markItemRunningLow(pantryItems[3]!.id);
  await setItemFullness(pantryItems[0]!.id, 'half');

  const dates = new Set(meals.map(({ daysAgo }) => localDateString(subDays(now, daysAgo))));
  for (const localDate of dates) await ensureDailyTarget(localDate, profile);
  for (const meal of meals) {
    const localDate = localDateString(subDays(now, meal.daysAgo));
    await insertMeal({
      loggedAt: `${localDate}T${meal.hour}:00.000Z`,
      localDate,
      mealType: meal.mealType,
      name: meal.name,
      photoUri: null,
      source: meal.source,
      confidence: meal.source === 'photo' ? 'medium' : null,
      venue: meal.venue,
      items: meal.items,
    });
  }

  await insertRecipe({
    title: 'Miso tofu rice bowl',
    sourceLink: null,
    steps: ['Cook the rice.', 'Crisp the tofu.', 'Stir miso with warm water and dress the bowl.'],
    ingredients: [
      { name: 'Firm tofu', quantity: 400, unit: 'g', canonicalId: 'tofu-firm' },
      { name: 'Jasmine rice', quantity: 1, unit: 'cup', canonicalId: 'jasmine-rice' },
      { name: 'Miso', quantity: 2, unit: 'tbsp', canonicalId: 'miso' },
    ],
  });
  await insertRecipe({
    title: 'Tomato chicken pasta',
    sourceLink: null,
    steps: ['Boil the pasta.', 'Cook the chicken.', 'Finish with tomato and cheese.'],
    ingredients: [
      { name: 'Dried pasta', quantity: 300, unit: 'g', canonicalId: 'dried-pasta' },
      { name: 'Chicken breast', quantity: 400, unit: 'g', canonicalId: 'chicken-breast' },
      { name: 'Tomato', quantity: 4, unit: 'piece', canonicalId: 'tomato' },
    ],
  });

  return {
    meals: meals.length,
    pantryItems: pantryInputs.length,
    barcodeScans: products.length,
    recipes: 2,
  };
}
