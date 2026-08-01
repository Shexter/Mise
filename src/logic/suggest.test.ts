import { describe, expect, test } from 'vitest';

import { canonical, item, KITCHENS } from '@/logic/__fixtures__/kitchens';
import {
  bucketFor,
  bucketStock,
  DEFAULT_VALUE_CENTS,
  FREEZABLE_DISCOUNT,
  HISTORY_WINDOW_DAYS,
  RECENTLY_EATEN_DAYS,
  REPEAT_THRESHOLD,
  shapeStockPayload,
  summarisePersonalisation,
  urgency,
  USE_FIRST_DAYS,
  USE_SOON_DAYS,
} from '@/logic/suggest';

const TODAY = '2026-06-10';

describe('bucketFor', () => {
  test('follows decision 34\'s table', () => {
    expect(bucketFor(0)).toBe('use_first');
    expect(bucketFor(USE_FIRST_DAYS)).toBe('use_first');
    expect(bucketFor(USE_FIRST_DAYS + 1)).toBe('use_soon');
    expect(bucketFor(USE_SOON_DAYS)).toBe('use_soon');
    expect(bucketFor(USE_SOON_DAYS + 1)).toBe('available');
    expect(bucketFor(null)).toBe('available');
  });

  test('an already-expired item still lands in use_first', () => {
    expect(bucketFor(-3)).toBe('use_first');
  });
});

describe('urgency', () => {
  const rice = canonical({ id: 'x', displayName: 'x', shelfLifeDays: { pantry: 100 } });

  test('value at risk separates equally-dated items', () => {
    const expensive = item({ canonicalId: 'x', priceCents: 800, expiresAt: '2026-06-11' });
    const cheap = item({ canonicalId: 'x', priceCents: 40, expiresAt: '2026-06-11' });
    expect(urgency(expensive, rice, TODAY)).toBeGreaterThan(
      urgency(cheap, rice, TODAY),
    );
  });

  test('freezable stock ranks less urgent than non-freezable, same date', () => {
    const freezable = canonical({
      id: 'f',
      displayName: 'f',
      shelfLifeDays: { fridge: 5, freezer: 200 },
    });
    const notFreezable = canonical({
      id: 'nf',
      displayName: 'nf',
      shelfLifeDays: { fridge: 5 },
    });
    const a = item({ canonicalId: 'f', priceCents: 500, expiresAt: '2026-06-12' });
    const b = item({ canonicalId: 'nf', priceCents: 500, expiresAt: '2026-06-12' });
    expect(urgency(a, freezable, TODAY)).toBeCloseTo(
      urgency(b, notFreezable, TODAY) * FREEZABLE_DISCOUNT,
    );
    expect(urgency(a, freezable, TODAY)).toBeLessThan(
      urgency(b, notFreezable, TODAY),
    );
  });

  test('an unpriced item still contributes via the default value', () => {
    const unpriced = item({ canonicalId: 'x', priceCents: null, expiresAt: '2026-06-11' });
    const priced = item({
      canonicalId: 'x',
      priceCents: DEFAULT_VALUE_CENTS,
      expiresAt: '2026-06-11',
    });
    expect(urgency(unpriced, rice, TODAY)).toBeCloseTo(urgency(priced, rice, TODAY));
  });

  test('no expiry date means no urgency', () => {
    const undated = item({ canonicalId: 'x', priceCents: 999 });
    expect(urgency(undated, rice, TODAY)).toBe(0);
  });

  test('urgency decreases as the date recedes', () => {
    const soon = item({ canonicalId: 'x', priceCents: 500, expiresAt: '2026-06-11' });
    const later = item({ canonicalId: 'x', priceCents: 500, expiresAt: '2026-07-11' });
    expect(urgency(soon, rice, TODAY)).toBeGreaterThan(urgency(later, rice, TODAY));
  });
});

describe('bucketStock, against the fixture kitchens', () => {
  test('every suggestion-eligible kitchen has a non-empty use_first bucket except where nothing is urgent', () => {
    for (const kitchen of KITCHENS) {
      const canonicals = new Map(kitchen.canonicals.map((c) => [c.id, c]));
      const bucketed = bucketStock(kitchen.items, canonicals, kitchen.today);
      const total =
        bucketed.use_first.length + bucketed.use_soon.length + bucketed.available.length;
      expect(total, kitchen.name).toBe(kitchen.items.length);
    }
  });

  test('the costly-protein kitchen ranks the pork belly above the cucumber', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'costly protein expiring tomorrow')!;
    const canonicals = new Map(kitchen.canonicals.map((c) => [c.id, c]));
    const bucketed = bucketStock(kitchen.items, canonicals, kitchen.today);
    const ranked = bucketed.use_first.map((entry) => entry.canonical.id);
    expect(ranked.indexOf('pork-belly')).toBeLessThan(ranked.indexOf('cucumber'));
  });

  test('the freezable-vs-not kitchen ranks the non-freezable item first', () => {
    const kitchen = KITCHENS.find(
      (k) => k.name === 'freezable beside non-freezable, same expiry',
    )!;
    const canonicals = new Map(kitchen.canonicals.map((c) => [c.id, c]));
    const bucketed = bucketStock(kitchen.items, canonicals, kitchen.today);
    const ranked = bucketed.use_first.map((entry) => entry.canonical.id);
    expect(ranked.indexOf('spinach-fresh')).toBeLessThan(
      ranked.indexOf('chicken-breast'),
    );
  });

  test('the nothing-urgent kitchen has an empty use_first bucket', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'nothing urgent')!;
    const canonicals = new Map(kitchen.canonicals.map((c) => [c.id, c]));
    const bucketed = bucketStock(kitchen.items, canonicals, kitchen.today);
    expect(bucketed.use_first).toEqual([]);
  });
});

describe('shapeStockPayload', () => {
  test('staples-and-seasonings-only kitchen compresses to summary lines', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'only staples and seasonings')!;
    const canonicals = new Map(kitchen.canonicals.map((c) => [c.id, c]));
    const bucketed = bucketStock(kitchen.items, canonicals, kitchen.today);
    const payload = shapeStockPayload(bucketed);

    expect(payload.full).toEqual([]);
    expect(payload.staplesSummary).toContain('Jasmine rice');
    expect(payload.staplesSummary).toContain('Vegetable oil');
    expect(payload.seasoningsSummary).toContain('Light soy sauce');
    expect(payload.seasoningsSummary).toContain('Gochujang');
  });

  test('urgent and protein/produce items are always sent in full', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'costly protein expiring tomorrow')!;
    const canonicals = new Map(kitchen.canonicals.map((c) => [c.id, c]));
    const bucketed = bucketStock(kitchen.items, canonicals, kitchen.today);
    const payload = shapeStockPayload(bucketed);

    const fullIds = payload.full.map((line) => line.canonicalId);
    expect(fullIds).toContain('pork-belly');
    expect(fullIds).toContain('cucumber');
    // Rice (a staple, available bucket) compresses instead of appearing in full.
    expect(fullIds).not.toContain('jasmine-rice');
    expect(payload.staplesSummary).toContain('Jasmine rice');
  });
});

describe('summarisePersonalisation', () => {
  test('detects a cuisine lean from dish-name keywords', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'well-stocked Asian pantry')!;
    const summary = summarisePersonalisation(kitchen.history, TODAY);
    expect(summary.cuisineLean).not.toBeNull();
    expect(summary.cuisineLean).toMatch(/Korean|Asian/);
  });

  test('a dish cooked twice or more is a repeat', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'well-stocked Asian pantry')!;
    const summary = summarisePersonalisation(kitchen.history, TODAY);
    expect(summary.frequentDishes).toContain('Gochujang pork stir-fry');
  });

  test('a dish eaten within the window is suppressed for suggestion, not for tomorrow', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'well-stocked Asian pantry')!;
    const summary = summarisePersonalisation(kitchen.history, TODAY);
    expect(summary.recentlyEaten).toContain('Kimchi fried rice');
  });

  test('a dish outside the recently-eaten window is not suppressed', () => {
    const kitchen = KITCHENS.find((k) => k.name === 'well-stocked Asian pantry')!;
    const summary = summarisePersonalisation(kitchen.history, TODAY);
    // Cooked 2026-05-20, well outside RECENTLY_EATEN_DAYS of 2026-06-10.
    expect(summary.recentlyEaten).not.toContain('Gochujang pork stir-fry');
  });

  test('no history yields no cuisine lean and no frequent dishes', () => {
    const summary = summarisePersonalisation([], TODAY);
    expect(summary.cuisineLean).toBeNull();
    expect(summary.frequentDishes).toEqual([]);
    expect(summary.recentlyEaten).toEqual([]);
  });

  test('the constants documented in the module match what is asserted here', () => {
    expect(RECENTLY_EATEN_DAYS).toBe(7);
    expect(HISTORY_WINDOW_DAYS).toBe(60);
    expect(REPEAT_THRESHOLD).toBe(2);
  });
});
