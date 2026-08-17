import type {
  CanonicalItem,
  MealWithItems,
  PantryItem,
} from '@/types';

/**
 * Whole kitchen states for the dinner decision's fixture corpus.
 *
 * The failure mode this change is built against is boredom, not a crash —
 * four days of stir fry will not throw. Nothing that only checks for
 * exceptions catches that, so this corpus exists before the feature does,
 * and shape assertions run against it in `test/suggest.test.ts`.
 *
 * Each kitchen pairs stock, meal history, and a recorded model response
 * (matching the output contract in `docs/dinner-decision.md`) so the shape
 * assertions in group 10 run with no provider in the loop.
 */

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function canonical(
  overrides: Partial<CanonicalItem> & { id: string; displayName: string },
): CanonicalItem {
  return {
    foodClass: 'staple',
    defaultLocation: 'pantry',
    shelfLifeDays: { pantry: 365 },
    openLifeDays: null,
    typicalUseQty: null,
    typicalUseUnit: null,
    typicalPkgQty: null,
    typicalPkgUnit: null,
    densityGPerMl: null,
    isSeed: true,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
    earlyWarningDays: overrides.earlyWarningDays ?? null,
    sources: overrides.sources ?? {},
    kcalPer100: overrides.kcalPer100 ?? null,
    proteinPer100: overrides.proteinPer100 ?? null,
    carbsPer100: overrides.carbsPer100 ?? null,
    fatPer100: overrides.fatPer100 ?? null,
    fibrePer100: overrides.fibrePer100 ?? null,
  };
}

export function item(
  overrides: Partial<PantryItem> & { canonicalId: string },
): PantryItem {
  return {
    id: nextId('item'),
    productId: null,
    locationId: 'pantry',
    qtyRemaining: null,
    qtyUnit: null,
    qtySource: null,
    fullness: null,
    usesCount: 0,
    purchasedAt: '2026-06-01',
    openedAt: null,
    expiresAt: null,
    expirySource: null,
    priceCents: null,
    photoUri: null,
    status: 'in_stock',
    estimatedDecrementsSinceAnchor: 0,
    lastAnchorAt: null,
    replacementAsked: false,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

export function homeMeal(
  overrides: Partial<MealWithItems> & { name: string; localDate: string },
): MealWithItems {
  return {
    id: nextId('meal'),
    loggedAt: `${overrides.localDate}T19:00:00Z`,
    mealType: 'dinner',
    photoUri: null,
    source: 'manual',
    confidence: null,
    venue: 'home',
    servingsMult: 1,
    createdAt: `${overrides.localDate}T19:00:00Z`,
    items: [],
    ...overrides,
  };
}

export interface Kitchen {
  name: string;
  today: string;
  canonicals: CanonicalItem[];
  items: PantryItem[];
  history: MealWithItems[];
  /** Raw JSON matching the suggest API's output contract, no provider needed. */
  recordedResponse: string;
}

const TODAY = '2026-06-10';

/* -------------------------------------------------------------------------- */
/* Shared canonicals                                                          */
/* -------------------------------------------------------------------------- */

const gochujang = canonical({
  id: 'gochujang',
  displayName: 'Gochujang',
  foodClass: 'condiment',
  shelfLifeDays: { fridge: 730 },
});
const soySauce = canonical({
  id: 'soy-sauce-light',
  displayName: 'Light soy sauce',
  foodClass: 'condiment',
  shelfLifeDays: { pantry: 1095 },
});
const sesameOil = canonical({
  id: 'sesame-oil',
  displayName: 'Sesame oil',
  foodClass: 'condiment',
  shelfLifeDays: { pantry: 730 },
});
const rice = canonical({
  id: 'jasmine-rice',
  displayName: 'Jasmine rice',
  foodClass: 'staple',
  shelfLifeDays: { pantry: 1460 },
});
const oil = canonical({
  id: 'vegetable-oil',
  displayName: 'Vegetable oil',
  foodClass: 'staple',
  shelfLifeDays: { pantry: 730 },
});
const porkBelly = canonical({
  id: 'pork-belly',
  displayName: 'Pork belly',
  foodClass: 'protein',
  shelfLifeDays: { fridge: 3, freezer: 120 },
});
const chickenBreast = canonical({
  id: 'chicken-breast',
  displayName: 'Chicken breast',
  foodClass: 'protein',
  shelfLifeDays: { fridge: 2, freezer: 270 },
});
const cucumber = canonical({
  id: 'cucumber',
  displayName: 'Cucumber',
  foodClass: 'produce',
  shelfLifeDays: { fridge: 10 },
});
const greenOnion = canonical({
  id: 'green-onion',
  displayName: 'Green onion',
  foodClass: 'produce',
  shelfLifeDays: { fridge: 10 },
});
const spinach = canonical({
  id: 'spinach',
  displayName: 'Spinach',
  foodClass: 'produce',
  shelfLifeDays: { fridge: 5 },
});
const milk = canonical({
  id: 'milk',
  displayName: 'Milk',
  foodClass: 'dairy',
  shelfLifeDays: { fridge: 10 },
});

/* -------------------------------------------------------------------------- */
/* 1. A well-stocked Asian pantry, nothing urgent                             */
/* -------------------------------------------------------------------------- */

const wellStockedAsianPantry: Kitchen = {
  name: 'well-stocked Asian pantry',
  today: TODAY,
  canonicals: [gochujang, soySauce, sesameOil, rice, porkBelly, greenOnion],
  items: [
    item({ canonicalId: gochujang.id, expiresAt: '2027-01-01' }),
    item({ canonicalId: soySauce.id, expiresAt: '2028-01-01' }),
    item({ canonicalId: sesameOil.id, expiresAt: '2027-06-01' }),
    item({ canonicalId: rice.id, qtyRemaining: 4000, qtyUnit: 'g', expiresAt: '2029-01-01' }),
    item({
      canonicalId: porkBelly.id,
      priceCents: 800,
      expiresAt: '2026-06-25',
    }),
    item({ canonicalId: greenOnion.id, expiresAt: '2026-06-16' }),
  ],
  history: [
    // A repeat dish — cooked twice in the window, a good sign not a lazy one.
    homeMeal({ name: 'Gochujang pork stir-fry', localDate: '2026-06-03' }),
    homeMeal({ name: 'Gochujang pork stir-fry', localDate: '2026-05-20' }),
    homeMeal({ name: 'Soy sauce fried rice', localDate: '2026-06-01' }),
    // Eaten yesterday — none of this kitchen's recorded suggestions repeat it.
    homeMeal({ name: 'Kimchi fried rice', localDate: '2026-06-09' }),
  ],
  recordedResponse: JSON.stringify({
    suggestions: [
      {
        dish: 'Pork belly and green onion stir-fry',
        reason_tags: ['clears pork belly (15 days)', 'you make this a lot'],
        kcal_per_serving: 610,
        servings: 2,
        effort_minutes: 25,
        uses: [
          { canonical_id: 'pork-belly', qty: 300, unit: 'g' },
          { canonical_id: 'green-onion', qty: 2, unit: 'piece' },
          { canonical_id: 'gochujang', qty: 1, unit: 'tbsp' },
        ],
        missing: [],
        method: ['Slice the pork belly thin.', 'Stir-fry with gochujang.'],
      },
      {
        dish: 'Sesame soy rice bowl',
        reason_tags: ['fits your remaining calories'],
        kcal_per_serving: 480,
        servings: 2,
        effort_minutes: 15,
        uses: [
          { canonical_id: 'jasmine-rice', qty: 150, unit: 'g' },
          { canonical_id: 'soy-sauce-light', qty: 1, unit: 'tbsp' },
          { canonical_id: 'sesame-oil', qty: 1, unit: 'tsp' },
        ],
        missing: [],
        method: ['Cook rice.', 'Dress with soy and sesame oil.'],
      },
      {
        dish: 'Korean-style rice porridge',
        reason_tags: ['a lighter stretch from what you usually cook'],
        kcal_per_serving: 320,
        servings: 2,
        effort_minutes: 30,
        uses: [{ canonical_id: 'jasmine-rice', qty: 100, unit: 'g' }],
        missing: [{ canonical_id: null, name: 'egg', note: 'optional topping' }],
        method: ['Simmer rice in broth until soft.'],
      },
    ],
  }),
};

/* -------------------------------------------------------------------------- */
/* 2. A nearly-empty fridge                                                   */
/* -------------------------------------------------------------------------- */

const nearlyEmptyFridge: Kitchen = {
  name: 'nearly-empty fridge',
  today: TODAY,
  canonicals: [rice, oil, milk],
  items: [
    item({ canonicalId: rice.id, qtyRemaining: 400, qtyUnit: 'g', expiresAt: '2029-01-01' }),
    item({ canonicalId: oil.id, expiresAt: '2027-01-01' }),
    item({ canonicalId: milk.id, priceCents: 350, expiresAt: '2026-06-12' }),
  ],
  history: [homeMeal({ name: 'Toast and eggs', localDate: '2026-06-08' })],
  recordedResponse: JSON.stringify({
    suggestions: [
      {
        dish: 'Plain rice with fried egg',
        reason_tags: ['clears milk (2 days)', 'simple with what you have'],
        kcal_per_serving: 380,
        servings: 1,
        effort_minutes: 10,
        uses: [
          { canonical_id: 'jasmine-rice', qty: 100, unit: 'g' },
          { canonical_id: 'milk', qty: 30, unit: 'ml' },
        ],
        missing: [{ canonical_id: null, name: 'eggs', note: 'not catalogued' }],
        method: ['Cook rice.', 'Fry an egg.'],
      },
      {
        dish: 'Buttered rice bowl with a milk splash',
        reason_tags: ['clears milk (2 days)', 'uses what is on hand'],
        kcal_per_serving: 300,
        servings: 1,
        effort_minutes: 8,
        uses: [
          { canonical_id: 'jasmine-rice', qty: 100, unit: 'g' },
          { canonical_id: 'milk', qty: 20, unit: 'ml' },
        ],
        missing: [],
        method: ['Cook rice.', 'Season with oil and a splash of milk.'],
      },
      {
        dish: 'Simple milk porridge',
        reason_tags: ['clears milk (2 days)'],
        kcal_per_serving: 250,
        servings: 1,
        effort_minutes: 12,
        uses: [
          { canonical_id: 'jasmine-rice', qty: 60, unit: 'g' },
          { canonical_id: 'milk', qty: 200, unit: 'ml' },
        ],
        missing: [],
        method: ['Simmer rice in milk.'],
      },
    ],
  }),
};

/* -------------------------------------------------------------------------- */
/* 3. A costly protein expiring tomorrow, beside a cheap vegetable            */
/* -------------------------------------------------------------------------- */

const costlyProteinExpiringTomorrow: Kitchen = {
  name: 'costly protein expiring tomorrow',
  today: TODAY,
  canonicals: [porkBelly, cucumber, rice, soySauce],
  items: [
    // Both expire tomorrow; the protein is twenty times the value.
    item({ canonicalId: porkBelly.id, priceCents: 800, expiresAt: '2026-06-11' }),
    item({ canonicalId: cucumber.id, priceCents: 40, expiresAt: '2026-06-11' }),
    item({ canonicalId: rice.id, qtyRemaining: 3000, qtyUnit: 'g', expiresAt: '2029-01-01' }),
    item({ canonicalId: soySauce.id, expiresAt: '2028-01-01' }),
  ],
  history: [],
  recordedResponse: JSON.stringify({
    suggestions: [
      {
        dish: 'Pork belly and cucumber stir-fry',
        reason_tags: ['saves $8 of stock', 'clears pork belly (1 day)'],
        kcal_per_serving: 590,
        servings: 2,
        effort_minutes: 20,
        uses: [
          { canonical_id: 'pork-belly', qty: 300, unit: 'g' },
          { canonical_id: 'cucumber', qty: 1, unit: 'piece' },
          { canonical_id: 'soy-sauce-light', qty: 1, unit: 'tbsp' },
        ],
        missing: [],
        method: ['Slice pork and cucumber.', 'Stir-fry together.'],
      },
      {
        dish: 'Braised pork belly with rice',
        reason_tags: ['saves $8 of stock', 'clears pork belly (1 day)'],
        kcal_per_serving: 650,
        servings: 2,
        effort_minutes: 45,
        uses: [
          { canonical_id: 'pork-belly', qty: 300, unit: 'g' },
          { canonical_id: 'jasmine-rice', qty: 150, unit: 'g' },
        ],
        missing: [],
        method: ['Braise pork in soy sauce.', 'Serve over rice.'],
      },
      {
        dish: 'Cucumber pork salad',
        reason_tags: ['clears pork belly (1 day)', 'clears cucumber (1 day)'],
        kcal_per_serving: 420,
        servings: 2,
        effort_minutes: 20,
        uses: [
          { canonical_id: 'pork-belly', qty: 200, unit: 'g' },
          { canonical_id: 'cucumber', qty: 1, unit: 'piece' },
        ],
        missing: [],
        method: ['Boil and slice pork.', 'Toss with cucumber.'],
      },
    ],
  }),
};

/* -------------------------------------------------------------------------- */
/* 4. Nothing urgent                                                          */
/* -------------------------------------------------------------------------- */

const nothingUrgent: Kitchen = {
  name: 'nothing urgent',
  today: TODAY,
  canonicals: [rice, oil, chickenBreast, spinach],
  items: [
    item({ canonicalId: rice.id, qtyRemaining: 3000, qtyUnit: 'g', expiresAt: '2029-01-01' }),
    item({ canonicalId: oil.id, expiresAt: '2027-06-01' }),
    item({ canonicalId: chickenBreast.id, priceCents: 500, expiresAt: '2026-08-01' }),
    item({ canonicalId: spinach.id, priceCents: 200, expiresAt: '2026-06-20' }),
  ],
  history: [homeMeal({ name: 'Roast chicken', localDate: '2026-06-02' })],
  recordedResponse: JSON.stringify({
    suggestions: [
      {
        dish: 'Chicken and spinach stir-fry',
        reason_tags: ['fits your remaining calories'],
        kcal_per_serving: 520,
        servings: 2,
        effort_minutes: 20,
        uses: [
          { canonical_id: 'chicken-breast', qty: 300, unit: 'g' },
          { canonical_id: 'spinach', qty: 100, unit: 'g' },
        ],
        missing: [],
        method: ['Sear chicken.', 'Wilt in spinach.'],
      },
      {
        dish: 'Simple chicken rice',
        reason_tags: ['you make this a lot'],
        kcal_per_serving: 560,
        servings: 2,
        effort_minutes: 25,
        uses: [
          { canonical_id: 'chicken-breast', qty: 250, unit: 'g' },
          { canonical_id: 'jasmine-rice', qty: 150, unit: 'g' },
        ],
        missing: [],
        method: ['Poach chicken.', 'Serve over rice.'],
      },
      {
        dish: 'Spinach and rice soup',
        reason_tags: ['a lighter stretch from your usual'],
        kcal_per_serving: 300,
        servings: 2,
        effort_minutes: 20,
        uses: [
          { canonical_id: 'spinach', qty: 100, unit: 'g' },
          { canonical_id: 'jasmine-rice', qty: 80, unit: 'g' },
        ],
        missing: [],
        method: ['Simmer rice and spinach in broth.'],
      },
    ],
  }),
};

/* -------------------------------------------------------------------------- */
/* 5. Only staples and seasonings                                             */
/* -------------------------------------------------------------------------- */

const onlyStaplesAndSeasonings: Kitchen = {
  name: 'only staples and seasonings',
  today: TODAY,
  canonicals: [rice, oil, soySauce, sesameOil, gochujang],
  items: [
    item({ canonicalId: rice.id, qtyRemaining: 5000, qtyUnit: 'g', expiresAt: '2029-01-01' }),
    item({ canonicalId: oil.id, expiresAt: '2027-01-01' }),
    item({ canonicalId: soySauce.id, expiresAt: '2028-01-01' }),
    item({ canonicalId: sesameOil.id, expiresAt: '2027-06-01' }),
    item({ canonicalId: gochujang.id, expiresAt: '2027-01-01' }),
  ],
  history: [],
  recordedResponse: JSON.stringify({
    suggestions: [
      {
        dish: 'Gochujang fried rice',
        reason_tags: ['uses what is well stocked'],
        kcal_per_serving: 450,
        servings: 2,
        effort_minutes: 20,
        uses: [
          { canonical_id: 'jasmine-rice', qty: 150, unit: 'g' },
          { canonical_id: 'gochujang', qty: 1, unit: 'tbsp' },
          { canonical_id: 'vegetable-oil', qty: 1, unit: 'tbsp' },
        ],
        missing: [{ canonical_id: null, name: 'egg', note: 'optional' }],
        method: ['Fry rice.', 'Stir through gochujang.'],
      },
      {
        dish: 'Sesame soy rice',
        reason_tags: ['uses what is well stocked'],
        kcal_per_serving: 400,
        servings: 2,
        effort_minutes: 15,
        uses: [
          { canonical_id: 'jasmine-rice', qty: 150, unit: 'g' },
          { canonical_id: 'soy-sauce-light', qty: 1, unit: 'tbsp' },
          { canonical_id: 'sesame-oil', qty: 1, unit: 'tsp' },
        ],
        missing: [],
        method: ['Cook rice.', 'Dress with soy and sesame oil.'],
      },
      {
        dish: 'Plain steamed rice with chili oil',
        reason_tags: ['pantry-only, no shopping needed'],
        kcal_per_serving: 320,
        servings: 2,
        effort_minutes: 10,
        uses: [
          { canonical_id: 'jasmine-rice', qty: 150, unit: 'g' },
          { canonical_id: 'vegetable-oil', qty: 1, unit: 'tsp' },
        ],
        missing: [],
        method: ['Steam rice.', 'Drizzle with oil.'],
      },
    ],
  }),
};

/* -------------------------------------------------------------------------- */
/* 6. A freezable item expiring beside a non-freezable one                    */
/* -------------------------------------------------------------------------- */

/** Explicitly not freezable — no freezer entry in its shelf life. */
const freshSpinach = canonical({
  id: 'spinach-fresh',
  displayName: 'Fresh spinach',
  foodClass: 'produce',
  shelfLifeDays: { fridge: 5 },
});

const freezableVsNot: Kitchen = {
  name: 'freezable beside non-freezable, same expiry',
  today: TODAY,
  canonicals: [chickenBreast, freshSpinach, rice],
  items: [
    // Same expiry date and the same price, so freezability is the only
    // variable this kitchen is isolating (decision 20's discount).
    item({ canonicalId: chickenBreast.id, priceCents: 500, expiresAt: '2026-06-12' }),
    item({ canonicalId: freshSpinach.id, priceCents: 500, expiresAt: '2026-06-12' }),
    item({ canonicalId: rice.id, qtyRemaining: 3000, qtyUnit: 'g', expiresAt: '2029-01-01' }),
  ],
  history: [],
  recordedResponse: JSON.stringify({
    suggestions: [
      {
        dish: 'Spinach and rice stir-fry',
        reason_tags: ['clears spinach (2 days)', 'saves $5 of stock'],
        kcal_per_serving: 380,
        servings: 2,
        effort_minutes: 15,
        uses: [
          { canonical_id: 'spinach-fresh', qty: 150, unit: 'g' },
          { canonical_id: 'jasmine-rice', qty: 150, unit: 'g' },
        ],
        missing: [],
        method: ['Wilt spinach.', 'Toss through rice.'],
      },
      {
        dish: 'Pan-seared chicken with spinach',
        reason_tags: ['clears spinach (2 days)', 'clears chicken (2 days)'],
        kcal_per_serving: 520,
        servings: 2,
        effort_minutes: 25,
        uses: [
          { canonical_id: 'chicken-breast', qty: 250, unit: 'g' },
          { canonical_id: 'spinach-fresh', qty: 100, unit: 'g' },
        ],
        missing: [],
        method: ['Sear chicken.', 'Wilt spinach alongside.'],
      },
      {
        dish: 'Spinach rice soup',
        reason_tags: ['clears spinach (2 days)'],
        kcal_per_serving: 300,
        servings: 2,
        effort_minutes: 20,
        uses: [
          { canonical_id: 'spinach-fresh', qty: 100, unit: 'g' },
          { canonical_id: 'jasmine-rice', qty: 100, unit: 'g' },
        ],
        missing: [],
        method: ['Simmer rice and spinach in broth.'],
      },
    ],
  }),
};

export const KITCHENS: readonly Kitchen[] = [
  wellStockedAsianPantry,
  nearlyEmptyFridge,
  costlyProteinExpiringTomorrow,
  nothingUrgent,
  onlyStaplesAndSeasonings,
  freezableVsNot,
];
