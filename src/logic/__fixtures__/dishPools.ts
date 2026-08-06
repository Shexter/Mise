import type { Suggestion, SuggestionUse } from '@/types';

/**
 * Candidate pools for `add-dish-scorer` (task 1), one per kitchen in
 * `kitchens.ts`. In the shape `parseSuggestResponse` returns — parsed
 * `Suggestion[]`, not raw JSON — since the scorer consumes exactly that,
 * and `test/suggest.test.ts` already exercises parsing separately.
 *
 * Every pool is authored, not generated: each dish's `uses`, `effortMinutes`,
 * and `kcalPerServing` are chosen to test something specific, named in the
 * comment above it. `test/dish-score.test.ts` records the believed order
 * for each pool and scores the pool for real, per task 1.5 and 8.1 — this
 * file only holds the input.
 */

function use(canonicalId: string, qty = 1): SuggestionUse {
  return { canonicalId, qty, unit: 'g' };
}

function dish(overrides: Partial<Suggestion> & { dish: string; uses: SuggestionUse[] }): Suggestion {
  return {
    reasons: [{ kind: 'clears_stock', label: 'uses what is on hand' }],
    kcalPerServing: 400,
    servings: 2,
    effortMinutes: 20,
    missing: [],
    method: [],
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* 1. well-stocked Asian pantry — no use_first; familiarity, recency,         */
/*    high-value/high-effort vs. cheap/quick, calorie overshoot,             */
/*    near-duplicates (tasks 1.2's cases, all in one pool)                   */
/* -------------------------------------------------------------------------- */

export const wellStockedAsianPantryPool: Suggestion[] = [
  // Exact repeat of the frequent dish (frequentDishes: "Gochujang pork
  // stir-fry") — the strongest familiarity signal available.
  dish({
    dish: 'Gochujang pork stir-fry',
    uses: [use('pork-belly', 300), use('gochujang', 1)],
    kcalPerServing: 610,
    effortMinutes: 25,
  }),
  // Near-duplicate of the above: same two ingredients, same Korean cuisine
  // keyword, different name and a third trivial ingredient.
  dish({
    dish: 'Pork gochujang rice bowl',
    uses: [use('pork-belly', 250), use('gochujang', 1), use('jasmine-rice', 100)],
    kcalPerServing: 600,
    effortMinutes: 20,
  }),
  // Clears the two most urgent/valuable items in the kitchen (pork belly,
  // 15 days; green onion, 6 days) — the highest value-at-risk in the pool,
  // at the cost of 90 minutes.
  dish({
    dish: 'Slow-braised pork belly with green onion',
    uses: [use('pork-belly', 300), use('green-onion', 2)],
    kcalPerServing: 650,
    effortMinutes: 90,
  }),
  // Quick, and clears almost nothing (rice's urgency is negligible).
  dish({
    dish: 'Quick garlic rice',
    uses: [use('jasmine-rice', 100)],
    kcalPerServing: 350,
    effortMinutes: 8,
  }),
  // Massively overshoots the day's remaining calories (700).
  dish({
    dish: 'Deep-fried pork belly feast',
    uses: [use('pork-belly', 400)],
    kcalPerServing: 1400,
    effortMinutes: 35,
  }),
  // Exact repeat of something eaten yesterday (recentlyEaten).
  dish({
    dish: 'Kimchi fried rice',
    uses: [use('jasmine-rice', 150), use('gochujang', 1)],
    kcalPerServing: 480,
    effortMinutes: 15,
  }),
  dish({
    dish: 'Sesame soy noodles',
    uses: [use('sesame-oil', 1), use('soy-sauce-light', 1), use('jasmine-rice', 100)],
    kcalPerServing: 420,
    effortMinutes: 15,
  }),
  // Clears the second-most-urgent item alone (green onion, use_soon).
  dish({
    dish: 'Green onion pancake',
    uses: [use('green-onion', 3), use('jasmine-rice', 50)],
    kcalPerServing: 380,
    effortMinutes: 20,
  }),
  dish({
    dish: 'Soy-glazed rice porridge',
    uses: [use('soy-sauce-light', 1), use('jasmine-rice', 80)],
    kcalPerServing: 300,
    effortMinutes: 25,
  }),
  dish({
    dish: 'Cold sesame noodles',
    uses: [use('sesame-oil', 2), use('jasmine-rice', 120)],
    kcalPerServing: 340,
    effortMinutes: 12,
  }),
];
export const wellStockedAsianPantryRemainingCalories = 700;

/* -------------------------------------------------------------------------- */
/* 2. costly protein expiring tomorrow — constraint headroom (task 1.3):     */
/*    7 of 10 ignore both use_first items and are dropped before scoring     */
/* -------------------------------------------------------------------------- */

export const costlyProteinExpiringTomorrowPool: Suggestion[] = [
  dish({
    dish: 'Pork belly and cucumber stir-fry',
    uses: [use('pork-belly', 300), use('cucumber', 1)],
    kcalPerServing: 590,
    effortMinutes: 20,
  }),
  dish({
    dish: 'Braised pork belly with rice',
    uses: [use('pork-belly', 300), use('jasmine-rice', 150)],
    kcalPerServing: 650,
    effortMinutes: 45,
  }),
  dish({
    dish: 'Cucumber pork salad',
    uses: [use('pork-belly', 200), use('cucumber', 1)],
    kcalPerServing: 420,
    effortMinutes: 20,
  }),
  // The remaining seven all ignore pork belly and cucumber — decision 136's
  // use-first check drops every one of them before the scorer ever runs.
  dish({ dish: 'Plain soy rice', uses: [use('jasmine-rice', 150), use('soy-sauce-light', 1)], kcalPerServing: 350, effortMinutes: 10 }),
  dish({ dish: 'Soy rice bowl', uses: [use('jasmine-rice', 150), use('soy-sauce-light', 1)], kcalPerServing: 320, effortMinutes: 12 }),
  dish({ dish: 'Steamed rice with soy drizzle', uses: [use('jasmine-rice', 120), use('soy-sauce-light', 1)], kcalPerServing: 300, effortMinutes: 8 }),
  dish({ dish: 'Simple soy noodles', uses: [use('jasmine-rice', 130), use('soy-sauce-light', 1)], kcalPerServing: 340, effortMinutes: 15 }),
  dish({ dish: 'Soy rice porridge', uses: [use('jasmine-rice', 100), use('soy-sauce-light', 1)], kcalPerServing: 280, effortMinutes: 20 }),
  dish({ dish: 'Garlic soy rice', uses: [use('jasmine-rice', 140), use('soy-sauce-light', 1)], kcalPerServing: 310, effortMinutes: 10 }),
  dish({ dish: 'Herbed rice with soy', uses: [use('jasmine-rice', 150), use('soy-sauce-light', 1)], kcalPerServing: 330, effortMinutes: 12 }),
];
export const costlyProteinExpiringTomorrowRemainingCalories = 700;

/* -------------------------------------------------------------------------- */
/* 3. only staples and seasonings — variety floor (task 1.4): ten dishes,    */
/*    eight sharing one ingredient pair, two sharing another                 */
/* -------------------------------------------------------------------------- */

export const onlyStaplesAndSeasoningsPool: Suggestion[] = [
  dish({ dish: 'Gochujang fried rice', uses: [use('jasmine-rice', 150), use('gochujang', 1)], kcalPerServing: 400, effortMinutes: 10 }),
  dish({ dish: 'Spicy gochujang rice bowl', uses: [use('jasmine-rice', 150), use('gochujang', 1)], kcalPerServing: 420, effortMinutes: 15 }),
  dish({ dish: 'Korean-style gochujang rice', uses: [use('jasmine-rice', 150), use('gochujang', 1)], kcalPerServing: 440, effortMinutes: 20 }),
  dish({ dish: 'Simple gochujang rice', uses: [use('jasmine-rice', 150), use('gochujang', 1)], kcalPerServing: 460, effortMinutes: 25 }),
  dish({ dish: 'Gochujang rice, lightly spiced', uses: [use('jasmine-rice', 150), use('gochujang', 1)], kcalPerServing: 410, effortMinutes: 12 }),
  dish({ dish: 'Weeknight gochujang rice', uses: [use('jasmine-rice', 150), use('gochujang', 1)], kcalPerServing: 430, effortMinutes: 18 }),
  dish({ dish: 'Gochujang rice supper', uses: [use('jasmine-rice', 150), use('gochujang', 1)], kcalPerServing: 450, effortMinutes: 22 }),
  dish({ dish: 'Late gochujang rice', uses: [use('jasmine-rice', 150), use('gochujang', 1)], kcalPerServing: 470, effortMinutes: 30 }),
  // A genuinely different pair — different enough to survive the variety
  // check against the gochujang dishes above, not against each other.
  dish({ dish: 'Soy sauce fried rice', uses: [use('jasmine-rice', 150), use('soy-sauce-light', 1)], kcalPerServing: 400, effortMinutes: 15 }),
  dish({ dish: 'Simple soy rice', uses: [use('jasmine-rice', 150), use('soy-sauce-light', 1)], kcalPerServing: 420, effortMinutes: 20 }),
];
export const onlyStaplesAndSeasoningsRemainingCalories = 700;

/* -------------------------------------------------------------------------- */
/* 4. nearly-empty fridge — baseline pool, milk is the only use_first item   */
/* -------------------------------------------------------------------------- */

export const nearlyEmptyFridgePool: Suggestion[] = [
  dish({ dish: 'Plain rice with fried egg', uses: [use('jasmine-rice', 100), use('milk', 30)], kcalPerServing: 380, effortMinutes: 10 }),
  dish({ dish: 'Buttered rice bowl with a milk splash', uses: [use('jasmine-rice', 100), use('milk', 20)], kcalPerServing: 300, effortMinutes: 8 }),
  dish({ dish: 'Simple milk porridge', uses: [use('jasmine-rice', 60), use('milk', 200)], kcalPerServing: 250, effortMinutes: 12 }),
  // Exact repeat of yesterday's meal (recentlyEaten).
  dish({ dish: 'Toast and eggs', uses: [use('jasmine-rice', 50), use('milk', 50)], kcalPerServing: 320, effortMinutes: 10 }),
  dish({ dish: 'Milk rice pudding', uses: [use('jasmine-rice', 80), use('milk', 150)], kcalPerServing: 340, effortMinutes: 25 }),
  // Ignores the only use_first item.
  dish({ dish: 'Plain steamed rice', uses: [use('jasmine-rice', 100)], kcalPerServing: 280, effortMinutes: 10 }),
  dish({ dish: 'Oiled rice', uses: [use('jasmine-rice', 100), use('vegetable-oil', 1)], kcalPerServing: 320, effortMinutes: 8 }),
  dish({ dish: 'Creamy rice porridge', uses: [use('jasmine-rice', 70), use('milk', 180)], kcalPerServing: 360, effortMinutes: 20 }),
  dish({ dish: 'Warm milk rice', uses: [use('jasmine-rice', 90), use('milk', 100)], kcalPerServing: 330, effortMinutes: 15 }),
  dish({ dish: 'Rice with a splash of oil', uses: [use('jasmine-rice', 120), use('vegetable-oil', 1)], kcalPerServing: 350, effortMinutes: 12 }),
];
export const nearlyEmptyFridgeRemainingCalories = 500;

/* -------------------------------------------------------------------------- */
/* 5. nothing urgent — baseline pool, no use_first or use_soon pressure      */
/* -------------------------------------------------------------------------- */

export const nothingUrgentPool: Suggestion[] = [
  dish({ dish: 'Chicken and spinach stir-fry', uses: [use('chicken-breast', 300), use('spinach', 100)], kcalPerServing: 520, effortMinutes: 20 }),
  dish({ dish: 'Simple chicken rice', uses: [use('chicken-breast', 250), use('jasmine-rice', 150)], kcalPerServing: 560, effortMinutes: 25 }),
  dish({ dish: 'Spinach and rice soup', uses: [use('spinach', 100), use('jasmine-rice', 80)], kcalPerServing: 300, effortMinutes: 20 }),
  dish({ dish: 'Quick oiled rice', uses: [use('jasmine-rice', 100), use('vegetable-oil', 1)], kcalPerServing: 320, effortMinutes: 8 }),
  dish({ dish: 'Pan-seared chicken', uses: [use('chicken-breast', 300)], kcalPerServing: 480, effortMinutes: 15 }),
  dish({ dish: 'Wilted spinach salad', uses: [use('spinach', 150)], kcalPerServing: 180, effortMinutes: 10 }),
  dish({ dish: 'Chicken fried rice', uses: [use('chicken-breast', 200), use('jasmine-rice', 100), use('vegetable-oil', 1)], kcalPerServing: 540, effortMinutes: 22 }),
  dish({ dish: 'Braised chicken with rice', uses: [use('chicken-breast', 350), use('jasmine-rice', 150)], kcalPerServing: 620, effortMinutes: 50 }),
  dish({ dish: 'Spinach and chicken soup', uses: [use('spinach', 100), use('chicken-breast', 150)], kcalPerServing: 380, effortMinutes: 25 }),
  dish({ dish: 'Herbed rice', uses: [use('jasmine-rice', 120), use('vegetable-oil', 1)], kcalPerServing: 340, effortMinutes: 10 }),
];
export const nothingUrgentRemainingCalories = 600;

/* -------------------------------------------------------------------------- */
/* 6. freezable beside non-freezable — confirms the scorer reads the         */
/*    freezable discount `bucketStock` already applied, rather than          */
/*    re-deriving it (spinach outranks chicken at equal price and expiry)    */
/* -------------------------------------------------------------------------- */

export const freezableVsNotPool: Suggestion[] = [
  dish({ dish: 'Spinach and rice stir-fry', uses: [use('spinach-fresh', 150), use('jasmine-rice', 150)], kcalPerServing: 380, effortMinutes: 15 }),
  dish({ dish: 'Pan-seared chicken with spinach', uses: [use('chicken-breast', 250), use('spinach-fresh', 100)], kcalPerServing: 520, effortMinutes: 25 }),
  dish({ dish: 'Spinach rice soup', uses: [use('spinach-fresh', 100), use('jasmine-rice', 100)], kcalPerServing: 300, effortMinutes: 20 }),
  dish({ dish: 'Simple seared chicken', uses: [use('chicken-breast', 300)], kcalPerServing: 450, effortMinutes: 18 }),
  dish({ dish: 'Chicken rice bowl', uses: [use('chicken-breast', 250), use('jasmine-rice', 150)], kcalPerServing: 560, effortMinutes: 25 }),
  dish({ dish: 'Wilted spinach with rice', uses: [use('spinach-fresh', 120), use('jasmine-rice', 100)], kcalPerServing: 340, effortMinutes: 12 }),
  dish({ dish: 'Spinach chicken soup', uses: [use('spinach-fresh', 80), use('chicken-breast', 200)], kcalPerServing: 400, effortMinutes: 30 }),
  dish({ dish: 'Quick spinach saute', uses: [use('spinach-fresh', 150)], kcalPerServing: 200, effortMinutes: 8 }),
  dish({ dish: 'Chicken and rice pilaf', uses: [use('chicken-breast', 300), use('jasmine-rice', 150)], kcalPerServing: 600, effortMinutes: 40 }),
  dish({ dish: 'Spinach with a little chicken', uses: [use('spinach-fresh', 130), use('chicken-breast', 100)], kcalPerServing: 350, effortMinutes: 20 }),
];
export const freezableVsNotRemainingCalories = 650;
