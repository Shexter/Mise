import { describe, expect, test } from 'vitest';

import {
  COARSE_DECIMALS,
  SHOP_MATCH_RADIUS_METRES,
  SHOP_RECENCY_WINDOW_MS,
  coarsen,
  defaultShopName,
  distanceMetres,
  nearestShop,
  orderNeeded,
  storeForNormalisation,
  withinRecencyWindow,
} from './shops';
import type { Shop } from '@/types';

const shop = (id: string, latitude: number, longitude: number): Shop => ({
  id,
  name: id,
  storeName: id,
  latitude,
  longitude,
});

describe('coarsening', () => {
  test('keeps building-level precision and no more', () => {
    const coarse = coarsen({ latitude: 51.5074123456, longitude: -0.1277654321 });
    expect(coarse).toEqual({ latitude: 51.5074, longitude: -0.1278 });
    for (const value of Object.values(coarse)) {
      const decimals = String(value).split('.')[1]?.length ?? 0;
      expect(decimals).toBeLessThanOrEqual(COARSE_DECIMALS);
    }
  });

  test('two readings inside one supermarket coarsen to the same position', () => {
    const aisle = coarsen({ latitude: 51.50742, longitude: -0.12776 });
    const till = coarsen({ latitude: 51.507424, longitude: -0.127761 });
    expect(aisle).toEqual(till);
  });
});

describe('distance', () => {
  test('is zero at the same point and symmetric', () => {
    const a = { latitude: 51.5074, longitude: -0.1278 };
    const b = { latitude: 51.5104, longitude: -0.1278 };
    expect(distanceMetres(a, a)).toBe(0);
    expect(distanceMetres(a, b)).toBeCloseTo(distanceMetres(b, a), 6);
  });

  test('a degree of latitude is about 111 km', () => {
    const metres = distanceMetres(
      { latitude: 51, longitude: 0 },
      { latitude: 52, longitude: 0 },
    );
    expect(metres).toBeGreaterThan(111_000);
    expect(metres).toBeLessThan(111_500);
  });
});

describe('nearestShop', () => {
  const here = { latitude: 51.5074, longitude: -0.1278 };

  test('returns the closest shop inside the radius', () => {
    const near = shop('near', 51.5075, -0.1279);
    const nearer = shop('nearer', 51.50741, -0.12781);
    expect(nearestShop([near, nearer], here)).toBe(nearer);
  });

  test('returns null when nothing is close enough', () => {
    // Roughly 1.1 km north — far outside the match radius.
    expect(nearestShop([shop('far', 51.5174, -0.1278)], here)).toBeNull();
  });

  test('returns null with no known shops at all — an unknown shop stays unknown', () => {
    expect(nearestShop([], here)).toBeNull();
  });

  test('respects the radius it is given', () => {
    const far = shop('far', 51.5174, -0.1278);
    expect(nearestShop([far], here, SHOP_MATCH_RADIUS_METRES)).toBeNull();
    expect(nearestShop([far], here, 2_000)).toBe(far);
  });
});

describe('the receipt header wins', () => {
  test('a printed store name is used even when a shop was recognised', () => {
    expect(storeForNormalisation('Tesco', 'Sainsburys')).toBe('Tesco');
  });

  test('a recognised shop supplies the store when the header is unreadable', () => {
    expect(storeForNormalisation(null, 'Sainsburys')).toBe('Sainsburys');
    expect(storeForNormalisation('   ', 'Sainsburys')).toBe('Sainsburys');
  });

  test('neither available is null, not a guess', () => {
    expect(storeForNormalisation(null, null)).toBeNull();
    expect(storeForNormalisation(undefined, '  ')).toBeNull();
  });
});

describe('the recency window', () => {
  test('accepts a reading from a few minutes ago and rejects an older one', () => {
    const now = 1_700_000_000_000;
    expect(withinRecencyWindow(now - 5 * 60 * 1000, now)).toBe(true);
    expect(withinRecencyWindow(now - SHOP_RECENCY_WINDOW_MS - 1, now)).toBe(false);
  });

  test('rejects a reading from the future rather than trusting a clock jump', () => {
    const now = 1_700_000_000_000;
    expect(withinRecencyWindow(now + 1_000, now)).toBe(false);
  });
});

describe('ordering what is needed', () => {
  test('puts out before running low, then alphabetical, and carries no quantity', () => {
    const ordered = orderNeeded([
      { canonicalId: 'b', displayName: 'Butter', status: 'running_low' },
      { canonicalId: 's', displayName: 'Soy sauce', status: 'out' },
      { canonicalId: 'a', displayName: 'Anchovies', status: 'running_low' },
    ]);
    expect(ordered.map((item) => item.displayName)).toEqual([
      'Soy sauce',
      'Anchovies',
      'Butter',
    ]);
    for (const item of ordered) {
      expect(Object.keys(item).sort()).toEqual(['canonicalId', 'displayName', 'status']);
    }
  });

  test('does not mutate its input', () => {
    const input = [
      { canonicalId: 'b', displayName: 'Butter', status: 'running_low' as const },
      { canonicalId: 's', displayName: 'Soy sauce', status: 'out' as const },
    ];
    orderNeeded(input);
    expect(input[0]?.displayName).toBe('Butter');
  });
});

test('a shop is named after the store the receipt printed', () => {
  expect(defaultShopName('  Tesco Metro ')).toBe('Tesco Metro');
});
