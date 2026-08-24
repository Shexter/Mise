import { addDays, subDays } from 'date-fns';

import {
  ensureDailyTarget,
  insertCapturedReceipt,
  insertMeal,
  insertPantryItem,
  insertProduct,
  insertRecipe,
  insertShoppingListItem,
  addShoppingListSource,
  markItemRunningLow,
  markProductScanned,
  saveBodyMeasurement,
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
  shoppingItems: number;
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
  fibreTargetG: 32,
  units: 'metric',
  onboardedAt: '2026-01-15T18:00:00.000Z',
  targetWeightKg: 74,
  weightGoalRateKgPerWeek: 0.25,
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
  // Today (Day 0)
  { daysAgo: 0, hour: '08:10', mealType: 'breakfast', name: 'Greek yogurt parfait with blueberries & oats', source: 'manual', venue: 'home', items: [item('Greek yogurt', 180, 20, 10, 5, 0, 'greek-yogurt'), item('Rolled oats', 190, 6, 34, 3, 5, 'oats'), item('Blueberries & honey', 90, 1, 22, 0, 4, 'honey')] },
  { daysAgo: 0, hour: '12:35', mealType: 'lunch', name: 'Miso tofu rice bowl with edamame', source: 'recipe', venue: 'home', items: [item('Firm tofu', 220, 24, 6, 12, 3, 'tofu-firm'), item('Jasmine rice', 310, 6, 68, 1, 1, 'jasmine-rice'), item('Miso dressed greens', 120, 5, 17, 4, 5, 'miso')] },
  { daysAgo: 0, hour: '19:30', mealType: 'dinner', name: 'Grilled salmon & roasted asparagus', source: 'manual', venue: 'home', items: [item('Atlantic salmon fillet', 380, 42, 0, 23, 0, 'salmon'), item('Roasted potatoes & asparagus', 290, 8, 48, 6, 8)] },

  // Day 1
  { daysAgo: 1, hour: '08:00', mealType: 'breakfast', name: 'Poached eggs on sourdough with avocado', source: 'photo', venue: 'home', items: [item('Eggs (2 large)', 140, 12, 1, 10, 0, 'eggs'), item('Sourdough toast (2 slices)', 240, 9, 46, 2, 4), item('Avocado', 160, 2, 9, 15, 7)] },
  { daysAgo: 1, hour: '13:05', mealType: 'lunch', name: 'Grilled chicken caesar bowl', source: 'photo', venue: 'out', items: [item('Grilled chicken salad', 540, 44, 28, 26, 7, 'chicken-breast')] },
  { daysAgo: 1, hour: '19:15', mealType: 'dinner', name: 'Seared steak with sweet potato & broccoli', source: 'manual', venue: 'home', items: [item('Sirloin steak', 420, 48, 0, 24, 0), item('Baked sweet potato', 180, 4, 41, 0, 6), item('Steamed broccoli', 60, 5, 11, 1, 5)] },

  // Day 2
  { daysAgo: 2, hour: '08:25', mealType: 'breakfast', name: 'Warm berry porridge', source: 'recipe', venue: 'home', items: [item('Overnight oats & chia', 450, 18, 66, 12, 12, 'oats')] },
  { daysAgo: 2, hour: '12:20', mealType: 'lunch', name: 'Leftover steak & quinoa bowl', source: 'manual', venue: 'leftovers', items: [item('Steak quinoa bowl', 580, 42, 54, 18, 9)] },
  { daysAgo: 2, hour: '19:40', mealType: 'dinner', name: 'Tomato basil chicken pasta', source: 'recipe', venue: 'home', items: [item('Chicken breast', 250, 46, 0, 5, 0, 'chicken-breast'), item('Pasta with rich marinara', 490, 16, 88, 8, 9, 'dried-pasta')] },

  // Day 3
  { daysAgo: 3, hour: '08:15', mealType: 'breakfast', name: 'Spinach & feta omelette with rye toast', source: 'manual', venue: 'home', items: [item('Three egg omelette with spinach & feta', 360, 26, 4, 26, 3, 'eggs'), item('Rye toast with butter', 180, 5, 28, 6, 4)] },
  { daysAgo: 3, hour: '13:00', mealType: 'lunch', name: 'Chipotle chicken burrito bowl', source: 'photo', venue: 'out', items: [item('Chicken rice & black bean bowl', 680, 48, 72, 22, 14)] },
  { daysAgo: 3, hour: '19:00', mealType: 'dinner', name: 'Baked cod with Mediterranean roasted vegetables', source: 'manual', venue: 'home', items: [item('Cod fillet', 210, 40, 0, 4, 0, 'fish'), item('Roasted zucchini, peppers & olive oil', 240, 6, 26, 13, 8)] },

  // Day 4
  { daysAgo: 4, hour: '08:30', mealType: 'breakfast', name: 'Peanut butter banana smoothie', source: 'manual', venue: 'home', items: [item('Protein smoothie with banana & oats', 440, 32, 52, 12, 8, 'banana')] },
  { daysAgo: 4, hour: '12:45', mealType: 'lunch', name: 'Turkey, avocado & provolone sandwich', source: 'photo', venue: 'home', items: [item('Turkey sourdough melt', 520, 36, 44, 21, 6)] },
  { daysAgo: 4, hour: '18:50', mealType: 'dinner', name: 'Crispy tofu and vegetable stir-fry with jasmine rice', source: 'photo', venue: 'home', items: [item('Tofu & seasonal veg stir-fry', 420, 24, 48, 16, 9, 'tofu-firm'), item('Steamed jasmine rice', 270, 5, 59, 1, 1, 'jasmine-rice')] },

  // Day 5
  { daysAgo: 5, hour: '08:10', mealType: 'breakfast', name: 'Cottage cheese bowl with walnuts and berries', source: 'manual', venue: 'home', items: [item('Cottage cheese & walnuts', 330, 28, 14, 18, 4), item('Mixed berries', 70, 1, 17, 0, 5)] },
  { daysAgo: 5, hour: '12:30', mealType: 'lunch', name: 'Mediterranean tuna pasta salad', source: 'recipe', venue: 'home', items: [item('Tuna pasta salad', 560, 42, 62, 16, 7, 'dried-pasta')] },
  { daysAgo: 5, hour: '19:15', mealType: 'dinner', name: 'Chicken tikka masala with brown rice', source: 'photo', venue: 'out', items: [item('Chicken tikka curry with rice', 760, 44, 82, 28, 8, 'chicken-thigh')] },

  // Day 6
  { daysAgo: 6, hour: '09:00', mealType: 'breakfast', name: 'Weekend sourdough French toast', source: 'manual', venue: 'home', items: [item('French toast with maple syrup', 490, 16, 78, 14, 4, 'eggs')] },
  { daysAgo: 6, hour: '13:15', mealType: 'lunch', name: 'Salmon sashimi & nigiri combo', source: 'photo', venue: 'out', items: [item('Salmon sushi set with edamame', 680, 38, 92, 16, 6, 'salmon')] },
  { daysAgo: 6, hour: '19:45', mealType: 'dinner', name: 'Homemade sourdough pizza with prosciutto & arugula', source: 'manual', venue: 'home', items: [item('Artisan sourdough pizza', 740, 36, 88, 27, 7)] },

  // Day 7
  { daysAgo: 7, hour: '08:15', mealType: 'breakfast', name: 'Avocado toast with soft-boiled eggs', source: 'manual', venue: 'home', items: [item('Avocado toast & eggs', 430, 20, 38, 22, 8, 'eggs')] },
  { daysAgo: 7, hour: '12:45', mealType: 'lunch', name: 'Hearty lentil soup with crusty bread', source: 'recipe', venue: 'home', items: [item('Green lentil & vegetable soup', 390, 22, 62, 5, 16), item('Sourdough roll', 160, 5, 32, 1, 2)] },
  { daysAgo: 7, hour: '19:10', mealType: 'dinner', name: 'Miso glazed chicken thighs with jasmine rice and bok choy', source: 'recipe', venue: 'home', items: [item('Miso chicken', 390, 44, 14, 16, 2, 'chicken-thigh'), item('Jasmine rice', 310, 6, 68, 1, 1, 'jasmine-rice')] },

  // Days 8 - 14
  { daysAgo: 8, hour: '08:00', mealType: 'breakfast', name: 'Greek yogurt with honey and chia seeds', source: 'manual', venue: 'home', items: [item('Greek yogurt & chia', 280, 22, 24, 8, 6, 'greek-yogurt')] },
  { daysAgo: 8, hour: '12:30', mealType: 'lunch', name: 'Grilled chicken quinoa power bowl', source: 'photo', venue: 'home', items: [item('Chicken power bowl', 580, 46, 56, 18, 11, 'chicken-breast')] },
  { daysAgo: 8, hour: '19:00', mealType: 'dinner', name: 'Pan-seared cod with mashed sweet potato', source: 'manual', venue: 'home', items: [item('Cod fillet & sweet potato', 460, 38, 52, 8, 7, 'fish')] },

  { daysAgo: 9, hour: '08:15', mealType: 'breakfast', name: 'Scrambled eggs with smoked salmon on toast', source: 'photo', venue: 'home', items: [item('Eggs & smoked salmon toast', 410, 32, 30, 18, 3, 'eggs')] },
  { daysAgo: 9, hour: '12:40', mealType: 'lunch', name: 'Leftover miso chicken bowl', source: 'manual', venue: 'leftovers', items: [item('Miso chicken and rice', 620, 45, 72, 16, 3)] },
  { daysAgo: 9, hour: '19:20', mealType: 'dinner', name: 'Lean beef bolognese with penne', source: 'recipe', venue: 'home', items: [item('Bolognese pasta', 690, 42, 86, 19, 10, 'dried-pasta')] },

  { daysAgo: 10, hour: '08:10', mealType: 'breakfast', name: 'Overnight oats with apple and cinnamon', source: 'manual', venue: 'home', items: [item('Apple cinnamon oats', 420, 16, 72, 8, 10, 'oats')] },
  { daysAgo: 10, hour: '13:00', mealType: 'lunch', name: 'Vietnamese chicken pho', source: 'photo', venue: 'out', items: [item('Chicken pho bowl', 580, 38, 76, 12, 5)] },
  { daysAgo: 10, hour: '18:35', mealType: 'dinner', name: 'Tofu and edamame noodle bowl', source: 'recipe', venue: 'home', items: [item('Tofu noodle bowl', 590, 32, 74, 18, 11, 'tofu-firm')] },

  { daysAgo: 11, hour: '08:20', mealType: 'breakfast', name: 'Mushroom and cheddar omelette', source: 'manual', venue: 'home', items: [item('Cheddar omelette', 380, 24, 4, 30, 2, 'eggs')] },
  { daysAgo: 11, hour: '12:30', mealType: 'lunch', name: 'Roast beef and grain salad', source: 'photo', venue: 'out', items: [item('Beef grain salad', 610, 40, 58, 22, 9)] },
  { daysAgo: 11, hour: '19:15', mealType: 'dinner', name: 'Sheet pan chicken breast, carrots and green beans', source: 'manual', venue: 'home', items: [item('Roast chicken & vegetables', 520, 52, 34, 16, 12, 'chicken-breast')] },

  { daysAgo: 12, hour: '08:00', mealType: 'breakfast', name: 'Protein oatmeal with peanut butter', source: 'manual', venue: 'home', items: [item('Peanut butter protein oats', 460, 26, 56, 16, 9, 'oats')] },
  { daysAgo: 12, hour: '12:45', mealType: 'lunch', name: 'Turkey breast wrap with hummus', source: 'photo', venue: 'home', items: [item('Turkey hummus wrap', 480, 34, 46, 16, 7)] },
  { daysAgo: 12, hour: '19:30', mealType: 'dinner', name: 'Crispy salmon fillet with wild rice and kale', source: 'recipe', venue: 'home', items: [item('Salmon & wild rice', 620, 44, 48, 26, 8, 'salmon')] },

  { daysAgo: 13, hour: '08:30', mealType: 'breakfast', name: 'Berry smoothie bowl with granola', source: 'manual', venue: 'home', items: [item('Berry smoothie bowl', 390, 18, 64, 8, 9)] },
  { daysAgo: 13, hour: '12:20', mealType: 'lunch', name: 'Thai green tofu curry with rice', source: 'photo', venue: 'out', items: [item('Green curry tofu', 640, 22, 68, 30, 7, 'tofu-firm')] },
  { daysAgo: 13, hour: '19:00', mealType: 'dinner', name: 'Grilled steak with roasted baby potatoes', source: 'manual', venue: 'home', items: [item('Steak & potatoes', 610, 46, 44, 26, 6)] },

  { daysAgo: 14, hour: '08:15', mealType: 'breakfast', name: 'Greek yogurt with banana and almond butter', source: 'manual', venue: 'home', items: [item('Greek yogurt bowl', 340, 24, 36, 12, 5, 'greek-yogurt')] },
  { daysAgo: 14, hour: '12:10', mealType: 'lunch', name: 'Cafe grain bowl with chickpeas & tahini', source: 'photo', venue: 'out', items: [item('Chickpea grain bowl', 640, 24, 82, 24, 15)] },
  { daysAgo: 14, hour: '19:30', mealType: 'dinner', name: 'Lemon herb chicken with orzo', source: 'recipe', venue: 'home', items: [item('Lemon herb chicken orzo', 590, 45, 62, 18, 6, 'chicken-breast')] },

  // Days 15 - 28 (Dense history for analytics trends & calorie consistency)
  { daysAgo: 16, hour: '12:30', mealType: 'lunch', name: 'Grilled salmon & quinoa salad', source: 'photo', venue: 'out', items: [item('Salmon quinoa bowl', 640, 42, 52, 26, 8, 'salmon')] },
  { daysAgo: 16, hour: '19:00', mealType: 'dinner', name: 'Beef stir-fry with bell peppers and jasmine rice', source: 'recipe', venue: 'home', items: [item('Beef stir fry', 620, 40, 68, 20, 6, 'ground-pork')] },
  { daysAgo: 18, hour: '12:30', mealType: 'lunch', name: 'Turkey and swiss sourdough sandwich', source: 'manual', venue: 'home', items: [item('Turkey sandwich', 510, 36, 48, 18, 5)] },
  { daysAgo: 18, hour: '19:15', mealType: 'dinner', name: 'Baked chicken thighs with roasted sweet potatoes', source: 'recipe', venue: 'home', items: [item('Chicken & sweet potato', 630, 46, 54, 24, 8, 'chicken-thigh')] },
  { daysAgo: 20, hour: '12:15', mealType: 'lunch', name: 'Mediterranean chickpea salad', source: 'photo', venue: 'out', items: [item('Chickpea salad', 520, 20, 66, 18, 14)] },
  { daysAgo: 20, hour: '19:30', mealType: 'dinner', name: 'Grilled pork tenderloin with apple chutney & greens', source: 'manual', venue: 'home', items: [item('Pork tenderloin', 580, 48, 38, 22, 6, 'pork-belly')] },
  { daysAgo: 22, hour: '12:45', mealType: 'lunch', name: 'Salmon poke bowl with avocado', source: 'photo', venue: 'out', items: [item('Salmon poke bowl', 690, 36, 78, 24, 9, 'salmon')] },
  { daysAgo: 22, hour: '19:00', mealType: 'dinner', name: 'Lentil and vegetable stew with sourdough', source: 'recipe', venue: 'home', items: [item('Lentil stew & bread', 540, 26, 84, 8, 18)] },
  { daysAgo: 25, hour: '12:30', mealType: 'lunch', name: 'Chicken burrito bowl', source: 'photo', venue: 'out', items: [item('Chicken burrito bowl', 710, 46, 80, 22, 12, 'chicken-breast')] },
  { daysAgo: 25, hour: '19:15', mealType: 'dinner', name: 'Seared tofu with sesame noodles and bok choy', source: 'recipe', venue: 'home', items: [item('Sesame tofu noodles', 580, 28, 72, 20, 8, 'tofu-firm')] },
  { daysAgo: 28, hour: '12:30', mealType: 'lunch', name: 'Greek chicken gyro plate', source: 'photo', venue: 'out', items: [item('Chicken gyro plate', 660, 44, 62, 26, 6, 'chicken-thigh')] },
  { daysAgo: 28, hour: '19:30', mealType: 'dinner', name: 'Baked cod with herb roasted baby potatoes', source: 'manual', venue: 'home', items: [item('Herb cod & potatoes', 490, 40, 52, 12, 7, 'fish')] },
];

/** Adds a repeatable, rich dataset covering every feature: meals, pantry, receipts, shopping list, and body composition. */
export async function populateDemoData(now: Date = new Date()): Promise<DemoDataSummary> {
  await saveProfile(profile);

  // Body Measurements for Dexa / Weight Trends
  await saveBodyMeasurement({
    provider: 'dexa',
    weightKg: 76.2,
    bodyFatPct: 15.8,
    leanTissueKg: 61.2,
    boneMineralContentKg: 2.9,
    fatFreeMassKg: 64.1,
    measuredAt: subDays(now, 14).toISOString(),
  });
  await saveBodyMeasurement({
    provider: 'inbody',
    weightKg: 75.8,
    bodyFatPct: 15.4,
    leanTissueKg: 61.3,
    boneMineralContentKg: 2.8,
    fatFreeMassKg: 64.1,
    measuredAt: subDays(now, 2).toISOString(),
  });

  // Products with GTIN barcodes
  const products = [];
  products.push(await insertProduct({ gtin: '0000000001014', brand: 'Kikkoman', name: 'Organic Light Soy Sauce', pkgQty: 500, pkgUnit: 'ml', canonicalId: 'soy-sauce-light', kcalPer100: 53, proteinPer100: 8.1, carbsPer100: 4.9, fatPer100: 0.6, source: 'barcode' }));
  products.push(await insertProduct({ gtin: '0000000001021', brand: 'Fage', name: 'Total 0% Greek Yogurt', pkgQty: 750, pkgUnit: 'g', canonicalId: 'greek-yogurt', kcalPer100: 54, proteinPer100: 10.3, carbsPer100: 3, fatPer100: 0, source: 'barcode' }));
  products.push(await insertProduct({ gtin: '0000000001038', brand: 'House Foods', name: 'Organic Firm Tofu', pkgQty: 400, pkgUnit: 'g', canonicalId: 'tofu-firm', kcalPer100: 144, proteinPer100: 17, carbsPer100: 3, fatPer100: 8, source: 'user' }));
  products.push(await insertProduct({ gtin: '0000000001045', brand: "Bob's Red Mill", name: 'Organic Rolled Oats', pkgQty: 1_000, pkgUnit: 'g', canonicalId: 'oats', kcalPer100: 379, proteinPer100: 13, carbsPer100: 68, fatPer100: 6.5, source: 'barcode' }));
  products.push(await insertProduct({ gtin: '0000000001052', brand: 'Barilla', name: 'Whole Grain Penne', pkgQty: 500, pkgUnit: 'g', canonicalId: 'dried-pasta', kcalPer100: 350, proteinPer100: 13, carbsPer100: 65, fatPer100: 2.5, source: 'barcode' }));

  for (const [index, product] of products.entries()) {
    await markProductScanned(product.id, subDays(now, index * 2).toISOString());
  }

  // Rich pantry stock across Fridge, Freezer, Pantry, Counter with expiry dates & price cents
  const pantryInputs = [
    { canonicalId: 'soy-sauce-light', locationId: 'pantry', productId: products[0]!.id, qtyRemaining: 450, qtyUnit: 'ml' as const, priceCents: 499 },
    { canonicalId: 'greek-yogurt', locationId: 'fridge', productId: products[1]!.id, qtyRemaining: 500, qtyUnit: 'g' as const, priceCents: 649, expiresAt: localDateString(addDays(now, 5)), expirySource: 'user' as const },
    { canonicalId: 'tofu-firm', locationId: 'fridge', productId: products[2]!.id, qtyRemaining: 400, qtyUnit: 'g' as const, priceCents: 399, expiresAt: localDateString(addDays(now, 3)), expirySource: 'user' as const },
    { canonicalId: 'oats', locationId: 'pantry', productId: products[3]!.id, qtyRemaining: 800, qtyUnit: 'g' as const, priceCents: 799 },
    { canonicalId: 'dried-pasta', locationId: 'pantry', productId: products[4]!.id, qtyRemaining: 500, qtyUnit: 'g' as const, priceCents: 329 },
    { canonicalId: 'jasmine-rice', locationId: 'pantry', qtyRemaining: 4_500, qtyUnit: 'g' as const, priceCents: 1899 },
    { canonicalId: 'olive-oil', locationId: 'pantry', qtyRemaining: 700, qtyUnit: 'ml' as const, priceCents: 1699 },
    { canonicalId: 'miso', locationId: 'fridge', qtyRemaining: 400, qtyUnit: 'g' as const, priceCents: 849, expiresAt: localDateString(addDays(now, 45)), expirySource: 'user' as const },
    { canonicalId: 'eggs', locationId: 'fridge', qtyRemaining: 10, qtyUnit: 'piece' as const, priceCents: 649, expiresAt: localDateString(addDays(now, 12)), expirySource: 'user' as const },
    { canonicalId: 'milk', locationId: 'fridge', qtyRemaining: 1_200, qtyUnit: 'ml' as const, priceCents: 499, expiresAt: localDateString(addDays(now, 4)), expirySource: 'user' as const },
    { canonicalId: 'cheddar-cheese', locationId: 'fridge', qtyRemaining: 350, qtyUnit: 'g' as const, priceCents: 799, expiresAt: localDateString(addDays(now, 18)), expirySource: 'user' as const },
    { canonicalId: 'chicken-breast', locationId: 'freezer', qtyRemaining: 1_000, qtyUnit: 'g' as const, priceCents: 1499 },
    { canonicalId: 'salmon', locationId: 'freezer', qtyRemaining: 600, qtyUnit: 'g' as const, priceCents: 1899 },
    { canonicalId: 'fish', locationId: 'freezer', qtyRemaining: 500, qtyUnit: 'g' as const, priceCents: 1299 },
    { canonicalId: 'pork-belly', locationId: 'fridge', qtyRemaining: 400, qtyUnit: 'g' as const, priceCents: 1199, expiresAt: localDateString(addDays(now, 2)), expirySource: 'user' as const },
    { canonicalId: 'bacon', locationId: 'fridge', qtyRemaining: 250, qtyUnit: 'g' as const, priceCents: 599, expiresAt: localDateString(addDays(now, 7)), expirySource: 'user' as const },
    { canonicalId: 'peanut-butter', locationId: 'pantry', qtyRemaining: 500, qtyUnit: 'g' as const, priceCents: 499 },
    { canonicalId: 'banana', locationId: 'counter', qtyRemaining: 4, qtyUnit: 'piece' as const, priceCents: 299, expiresAt: localDateString(addDays(now, 3)), expirySource: 'user' as const },
    { canonicalId: 'honey', locationId: 'pantry', qtyRemaining: 350, qtyUnit: 'g' as const, priceCents: 799 },
    { canonicalId: 'bok-choy', locationId: 'fridge', qtyRemaining: 300, qtyUnit: 'g' as const, priceCents: 249, expiresAt: localDateString(addDays(now, 4)), expirySource: 'user' as const },
    { canonicalId: 'yellow-onion', locationId: 'counter', qtyRemaining: 5, qtyUnit: 'piece' as const, priceCents: 299 },
    { canonicalId: 'garlic', locationId: 'counter', qtyRemaining: 3, qtyUnit: 'piece' as const, priceCents: 199 },
    { canonicalId: 'coffee-beans', locationId: 'pantry', qtyRemaining: 340, qtyUnit: 'g' as const, priceCents: 1699 },
    { canonicalId: 'frozen-peas', locationId: 'freezer', qtyRemaining: 500, qtyUnit: 'g' as const, priceCents: 299 },
  ];

  const pantryItems = [];
  for (const input of pantryInputs) pantryItems.push(await insertPantryItem(input));
  
  // Highlight some statuses: one running low, one half full
  await markItemRunningLow(pantryItems[3]!.id);
  await setItemFullness(pantryItems[0]!.id, 'half');

  // Insert Meals & Targets
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

  // Saved Recipes
  await insertRecipe({
    title: 'Miso tofu rice bowl',
    sourceLink: null,
    steps: ['Cook the jasmine rice until fluffy.', 'Press and cube tofu, then sear in pan with a touch of oil until golden.', 'Whisk miso paste with warm water and dress the bowl with steamed greens.'],
    ingredients: [
      { name: 'Firm tofu', quantity: 400, unit: 'g', canonicalId: 'tofu-firm' },
      { name: 'Jasmine rice', quantity: 1, unit: 'cup', canonicalId: 'jasmine-rice' },
      { name: 'Miso', quantity: 2, unit: 'tbsp', canonicalId: 'miso' },
    ],
  });
  await insertRecipe({
    title: 'Tomato basil chicken pasta',
    sourceLink: null,
    steps: ['Boil whole grain penne in salted water until al dente.', 'Pan sear chicken breast cubes with garlic and olive oil.', 'Toss pasta and chicken in rich marinara and top with parmesan.'],
    ingredients: [
      { name: 'Whole grain penne', quantity: 300, unit: 'g', canonicalId: 'dried-pasta' },
      { name: 'Chicken breast', quantity: 400, unit: 'g', canonicalId: 'chicken-breast' },
      { name: 'Garlic', quantity: 2, unit: 'piece', canonicalId: 'garlic' },
    ],
  });
  await insertRecipe({
    title: 'Pan-seared salmon with wild rice & greens',
    sourceLink: null,
    steps: ['Season salmon fillets with sea salt and cracked black pepper.', 'Sear skin-side down in hot skillet for 4 mins, flip and finish.', 'Serve alongside warm wild rice and sautéed spinach.'],
    ingredients: [
      { name: 'Salmon fillet', quantity: 400, unit: 'g', canonicalId: 'salmon' },
      { name: 'Olive oil', quantity: 1, unit: 'tbsp', canonicalId: 'olive-oil' },
    ],
  });
  await insertRecipe({
    title: 'Warm berry protein oats',
    sourceLink: null,
    steps: ['Simmer rolled oats with milk or water for 5 minutes.', 'Stir in Greek yogurt and top with fresh blueberries and chia seeds.'],
    ingredients: [
      { name: 'Rolled oats', quantity: 80, unit: 'g', canonicalId: 'oats' },
      { name: 'Greek yogurt', quantity: 150, unit: 'g', canonicalId: 'greek-yogurt' },
      { name: 'Honey', quantity: 1, unit: 'tbsp', canonicalId: 'honey' },
    ],
  });

  // Shopping List Items with categories & sources
  const shoppingItems = [
    { displayName: 'Sourdough Bread', normalizedName: 'sourdough bread', requestedQty: 1, requestedUnit: 'piece' as const, category: 'staple' as const, note: 'From local artisan bakery' },
    { displayName: 'Almond Butter', normalizedName: 'almond butter', requestedQty: 1, requestedUnit: 'piece' as const, category: 'condiment' as const, note: 'Smooth, unsalted' },
    { displayName: 'Baby Spinach', normalizedName: 'baby spinach', requestedQty: 300, requestedUnit: 'g' as const, category: 'produce' as const, note: 'For morning omelettes' },
    { displayName: 'Chia Seeds', normalizedName: 'chia seeds', requestedQty: 250, requestedUnit: 'g' as const, category: 'staple' as const, canonicalId: 'oats' },
    { displayName: 'Olive Oil', normalizedName: 'olive oil', requestedQty: 750, requestedUnit: 'ml' as const, category: 'staple' as const, canonicalId: 'olive-oil', status: 'purchased' as const },
  ];

  for (const shopItem of shoppingItems) {
    const created = await insertShoppingListItem(shopItem);
    await addShoppingListSource({
      shoppingItemId: created.id,
      kind: 'manual',
    });
  }

  // Sample Captured Grocery Receipt (recent purchase)
  try {
    await insertCapturedReceipt('file:///demo-receipt-whole-foods.jpg', localDateString(subDays(now, 2)));
  } catch {
    // Non-critical demo shell
  }

  return {
    meals: meals.length,
    pantryItems: pantryInputs.length,
    barcodeScans: products.length,
    recipes: 4,
    shoppingItems: shoppingItems.length,
  };
}
