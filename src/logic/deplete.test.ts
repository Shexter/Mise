import { describe, expect, test } from 'vitest';

import { pickItem, planDepletion, type ConsumedIngredient } from '@/logic/deplete';
import type { CanonicalItem, PantryItem } from '@/types';

/** Canonicals covering each depletion class. */
function canonical(overrides: Partial<CanonicalItem> & { id: string }): CanonicalItem {
  return {
    displayName: overrides.id,
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
    createdAt: '2026-01-01',
    ...overrides,
    earlyWarningDays: overrides.earlyWarningDays ?? null,
    sources: overrides.sources ?? {},
    kcalPer100: overrides.kcalPer100 ?? null,
    proteinPer100: overrides.proteinPer100 ?? null,
    carbsPer100: overrides.carbsPer100 ?? null,
    fatPer100: overrides.fatPer100 ?? null,
    fibrePer100: overrides.fibrePer100 ?? null,
    vitaminCMgPer100: overrides.vitaminCMgPer100 ?? null,
    ironMgPer100: overrides.ironMgPer100 ?? null,
    vitaminB12McgPer100: overrides.vitaminB12McgPer100 ?? null,
    calciumMgPer100: overrides.calciumMgPer100 ?? null,
    folateMcgPer100: overrides.folateMcgPer100 ?? null,
    vitaminAMcgPer100: overrides.vitaminAMcgPer100 ?? null,
    potassiumMgPer100: overrides.potassiumMgPer100 ?? null,
  };
}

const RICE = canonical({ id: 'jasmine-rice', foodClass: 'staple' });
const GOCHUJANG = canonical({
  id: 'gochujang',
  foodClass: 'condiment',
  densityGPerMl: 1.2,
});
const CHICKEN = canonical({ id: 'chicken-breast', foodClass: 'protein' });
const OIL = canonical({
  id: 'olive-oil',
  foodClass: 'staple',
  densityGPerMl: 0.91,
});
/** No density and no weight per piece — nothing can be converted from it. */
const OPAQUE = canonical({ id: 'mystery-veg', foodClass: 'produce' });

const CANONICALS = new Map(
  [RICE, GOCHUJANG, CHICKEN, OIL, OPAQUE].map((c) => [c.id, c]),
);

function pantryItem(overrides: Partial<PantryItem> & { id: string; canonicalId: string }): PantryItem {
  return {
    productId: null,
    locationId: 'pantry',
    qtyRemaining: 1000,
    qtyUnit: 'g',
    qtySource: 'user',
    fullness: null,
    usesCount: 0,
    purchasedAt: '2026-01-01',
    openedAt: null,
    expiresAt: null,
    expirySource: null,
    priceCents: null,
    photoUri: null,
    status: 'in_stock',
    estimatedDecrementsSinceAnchor: 0,
    lastAnchorAt: null,
    replacementAsked: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function ingredient(
  canonicalId: string,
  quantity: number,
  unit: ConsumedIngredient['unit'] = 'g',
): ConsumedIngredient {
  return { canonicalId, quantity, unit, kind: 'meal_item' };
}

describe('venue gates the whole plan', () => {
  const catalogue = [pantryItem({ id: 'rice-1', canonicalId: 'jasmine-rice' })];

  test('a home-cooked meal produces decrements', () => {
    const plan = planDepletion({
      venue: 'home',
      servingsMult: 1,
      ingredients: [ingredient('jasmine-rice', 200)],
      catalogue,
      canonicals: CANONICALS,
    });
    expect(plan.length).toBe(1);
    expect(plan[0]?.qty).toBe(200);
  });

  test.each(['out', 'leftovers'] as const)(
    'a %s meal produces no decrements at all',
    (venue) => {
      const plan = planDepletion({
        venue,
        servingsMult: 1,
        ingredients: [ingredient('jasmine-rice', 200)],
        catalogue,
        canonicals: CANONICALS,
      });
      expect(plan).toEqual([]);
    },
  );
});

describe('class dispatch', () => {
  const catalogue = [
    pantryItem({ id: 'rice-1', canonicalId: 'jasmine-rice' }),
    pantryItem({ id: 'goch-1', canonicalId: 'gochujang' }),
    pantryItem({ id: 'chx-1', canonicalId: 'chicken-breast' }),
  ];

  test('a staple loses mass', () => {
    const [decrement] = planDepletion({
      venue: 'home',
      servingsMult: 1,
      ingredients: [ingredient('jasmine-rice', 200)],
      catalogue,
      canonicals: CANONICALS,
    });
    expect(decrement?.qty).toBe(200);
    expect(decrement?.unit).toBe('g');
    expect(decrement?.pantryItemId).toBe('rice-1');
  });

  test('a condiment gains a use and never an estimated mass', () => {
    const [decrement] = planDepletion({
      venue: 'home',
      servingsMult: 1,
      ingredients: [ingredient('gochujang', 1, 'tbsp')],
      catalogue,
      canonicals: CANONICALS,
    });
    expect(decrement?.qty).toBeNull();
    expect(decrement?.uses).toBe(1);
    expect(decrement?.reason).toBe('uses_tracked');
  });

  test('a perishable loses mass like a staple', () => {
    const [decrement] = planDepletion({
      venue: 'home',
      servingsMult: 1,
      ingredients: [ingredient('chicken-breast', 300)],
      catalogue,
      canonicals: CANONICALS,
    });
    expect(decrement?.qty).toBe(300);
  });
});

describe('the servings multiplier', () => {
  const catalogue = [
    pantryItem({ id: 'rice-1', canonicalId: 'jasmine-rice' }),
    pantryItem({ id: 'goch-1', canonicalId: 'gochujang' }),
  ];

  test('scales a mass decrement', () => {
    const [decrement] = planDepletion({
      venue: 'home',
      servingsMult: 4,
      ingredients: [ingredient('jasmine-rice', 200)],
      catalogue,
      canonicals: CANONICALS,
    });
    expect(decrement?.qty).toBe(800);
  });

  test('scales a use count too', () => {
    const [decrement] = planDepletion({
      venue: 'home',
      servingsMult: 4,
      ingredients: [ingredient('gochujang', 1, 'tbsp')],
      catalogue,
      canonicals: CANONICALS,
    });
    expect(decrement?.uses).toBe(4);
  });

  test('a multiplier below one is treated as one', () => {
    const [decrement] = planDepletion({
      venue: 'home',
      servingsMult: 0,
      ingredients: [ingredient('jasmine-rice', 200)],
      catalogue,
      canonicals: CANONICALS,
    });
    expect(decrement?.qty).toBe(200);
  });
});

describe('unit reconciliation', () => {
  test('converts a logged volume into the stocked mass', () => {
    const catalogue = [
      pantryItem({ id: 'oil-1', canonicalId: 'olive-oil', qtyUnit: 'g' }),
    ];
    const [decrement] = planDepletion({
      venue: 'home',
      servingsMult: 1,
      ingredients: [ingredient('olive-oil', 1, 'tbsp')],
      catalogue,
      canonicals: CANONICALS,
    });
    // 1 tbsp = 15 ml; at 0.91 g/ml that is 13.65 g.
    expect(decrement?.qty).toBeCloseTo(13.65);
    expect(decrement?.unit).toBe('g');
  });

  test('an unconvertible pair counts a use and leaves the amount alone', () => {
    const catalogue = [
      pantryItem({ id: 'veg-1', canonicalId: 'mystery-veg', qtyUnit: 'g' }),
    ];
    const [decrement] = planDepletion({
      venue: 'home',
      servingsMult: 1,
      ingredients: [ingredient('mystery-veg', 2, 'piece')],
      catalogue,
      canonicals: CANONICALS,
    });
    expect(decrement?.qty).toBeNull();
    expect(decrement?.reason).toBe('unconvertible');
    expect(decrement?.uses).toBe(1);
    expect(decrement?.pantryItemId).toBe('veg-1');
  });

  test('an item with no unit yet takes the logged unit', () => {
    const catalogue = [
      pantryItem({
        id: 'rice-1',
        canonicalId: 'jasmine-rice',
        qtyRemaining: null,
        qtyUnit: null,
      }),
    ];
    const [decrement] = planDepletion({
      venue: 'home',
      servingsMult: 1,
      ingredients: [ingredient('jasmine-rice', 200)],
      catalogue,
      canonicals: CANONICALS,
    });
    expect(decrement?.unit).toBe('g');
    expect(decrement?.qty).toBe(200);
  });
});

describe('uncatalogued ingredients', () => {
  test('are recorded against the canonical with no item', () => {
    const [decrement] = planDepletion({
      venue: 'home',
      servingsMult: 1,
      ingredients: [ingredient('jasmine-rice', 200)],
      catalogue: [],
      canonicals: CANONICALS,
    });
    expect(decrement?.pantryItemId).toBeNull();
    expect(decrement?.canonicalId).toBe('jasmine-rice');
    expect(decrement?.reason).toBe('uncatalogued');
  });

  test('an unknown canonical is still recorded rather than dropped', () => {
    const plan = planDepletion({
      venue: 'home',
      servingsMult: 1,
      ingredients: [ingredient('never-heard-of-it', 1)],
      catalogue: [],
      canonicals: CANONICALS,
    });
    expect(plan.length).toBe(1);
    expect(plan[0]?.pantryItemId).toBeNull();
  });

  test('the known ingredients in a mixed meal still resolve', () => {
    const catalogue = [pantryItem({ id: 'rice-1', canonicalId: 'jasmine-rice' })];
    const plan = planDepletion({
      venue: 'home',
      servingsMult: 1,
      ingredients: [
        ingredient('jasmine-rice', 200),
        ingredient('never-heard-of-it', 1),
      ],
      catalogue,
      canonicals: CANONICALS,
    });
    expect(plan[0]?.pantryItemId).toBe('rice-1');
    expect(plan[1]?.pantryItemId).toBeNull();
  });
});

describe('pickItem ranking', () => {
  test('prefers in stock over running low', () => {
    const picked = pickItem(
      [
        pantryItem({ id: 'low', canonicalId: 'x', status: 'running_low' }),
        pantryItem({ id: 'full', canonicalId: 'x', status: 'in_stock' }),
      ],
      'x',
    );
    expect(picked?.id).toBe('full');
  });

  test('prefers opened over unopened', () => {
    const picked = pickItem(
      [
        pantryItem({ id: 'sealed', canonicalId: 'x' }),
        pantryItem({ id: 'opened', canonicalId: 'x', openedAt: '2026-05-01' }),
      ],
      'x',
    );
    expect(picked?.id).toBe('opened');
  });

  test('breaks ties on nearest expiry, then oldest', () => {
    const picked = pickItem(
      [
        pantryItem({ id: 'later', canonicalId: 'x', expiresAt: '2026-12-01' }),
        pantryItem({ id: 'sooner', canonicalId: 'x', expiresAt: '2026-06-05' }),
        pantryItem({ id: 'undated', canonicalId: 'x' }),
      ],
      'x',
    );
    expect(picked?.id).toBe('sooner');

    const oldest = pickItem(
      [
        pantryItem({ id: 'new', canonicalId: 'x', createdAt: '2026-05-01T00:00:00Z' }),
        pantryItem({ id: 'old', canonicalId: 'x', createdAt: '2026-01-01T00:00:00Z' }),
      ],
      'x',
    );
    expect(oldest?.id).toBe('old');
  });

  test('skips items that are out or discarded', () => {
    const picked = pickItem(
      [
        pantryItem({ id: 'gone', canonicalId: 'x', status: 'out' }),
        pantryItem({ id: 'binned', canonicalId: 'x', status: 'discarded' }),
      ],
      'x',
    );
    expect(picked).toBeNull();
  });

  test('two mentions of one ingredient debit the same item', () => {
    const catalogue = [
      pantryItem({ id: 'rice-1', canonicalId: 'jasmine-rice' }),
      pantryItem({ id: 'rice-2', canonicalId: 'jasmine-rice' }),
    ];
    const plan = planDepletion({
      venue: 'home',
      servingsMult: 1,
      ingredients: [
        ingredient('jasmine-rice', 100),
        ingredient('jasmine-rice', 50),
      ],
      catalogue,
      canonicals: CANONICALS,
    });
    expect(plan[0]?.pantryItemId).toBe(plan[1]?.pantryItemId);
  });
});
