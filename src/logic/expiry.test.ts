import { describe, expect, test } from 'vitest';

import {
  canRecomputeExpiry,
  freezeExpiry,
  isFreezable,
  predictExpiry,
  shelfLifeKey,
  type ShelfLife,
} from '@/logic/expiry';

const CHICKEN: ShelfLife = {
  shelfLifeDays: { fridge: 2, freezer: 270 },
  openLifeDays: null,
};

const SOY_SAUCE: ShelfLife = {
  shelfLifeDays: { pantry: 1095 },
  openLifeDays: 365,
};

const RICE: ShelfLife = {
  shelfLifeDays: { pantry: 1460 },
  openLifeDays: null,
};

const TINNED_TOMATOES: ShelfLife = {
  shelfLifeDays: { pantry: 730 },
  openLifeDays: 5,
};

describe('shelfLifeKey', () => {
  test('ambient reads the pantry column; the rest match by name', () => {
    expect(shelfLifeKey('ambient')).toBe('pantry');
    expect(shelfLifeKey('fridge')).toBe('fridge');
    expect(shelfLifeKey('freezer')).toBe('freezer');
    expect(shelfLifeKey('counter')).toBe('counter');
  });
});

describe('predictExpiry', () => {
  test('counts the location shelf life from the acquisition date', () => {
    expect(predictExpiry(CHICKEN, 'fridge', '2026-01-01', null)).toBe(
      '2026-01-03',
    );
    expect(predictExpiry(CHICKEN, 'freezer', '2026-01-01', null)).toBe(
      '2026-09-28',
    );
  });

  test('the same food gets different dates in different locations', () => {
    const fridge = predictExpiry(CHICKEN, 'fridge', '2026-01-01', null);
    const freezer = predictExpiry(CHICKEN, 'freezer', '2026-01-01', null);
    expect(fridge).not.toBe(freezer);
  });

  test('no shelf-life figure for the location means no claim', () => {
    // Chicken has no counter figure — null, not a guess.
    expect(predictExpiry(CHICKEN, 'counter', '2026-01-01', null)).toBeNull();
  });

  test('opening shortens a long unopened life', () => {
    // Two years of tinned life left; opened, it keeps five days.
    const unopened = predictExpiry(TINNED_TOMATOES, 'ambient', '2026-01-01', null);
    const opened = predictExpiry(
      TINNED_TOMATOES,
      'ambient',
      '2026-01-01',
      '2026-03-01',
    );
    expect(unopened).toBe('2028-01-01');
    expect(opened).toBe('2026-03-06');
  });

  test('opening never extends a short remaining life', () => {
    // Soy sauce bought nearly three years ago has ~30 days left unopened.
    // Opening it must not push expiry out to opening + 365.
    const opened = predictExpiry(SOY_SAUCE, 'ambient', '2023-02-01', '2026-01-01');
    expect(opened).toBe('2026-01-31'); // the unopened date, still the earlier
  });

  test('an ingredient whose opening changes nothing keeps the unopened date', () => {
    const opened = predictExpiry(RICE, 'ambient', '2026-01-01', '2026-02-01');
    expect(opened).toBe(predictExpiry(RICE, 'ambient', '2026-01-01', null));
  });

  test('opened life alone can carry the prediction where the location has no figure', () => {
    const openedOnly: ShelfLife = { shelfLifeDays: {}, openLifeDays: 7 };
    expect(predictExpiry(openedOnly, 'fridge', '2026-01-01', '2026-01-02')).toBe(
      '2026-01-09',
    );
    expect(predictExpiry(openedOnly, 'fridge', '2026-01-01', null)).toBeNull();
  });
});

describe('freezeExpiry and isFreezable', () => {
  test('freezing recounts from the freezer shelf life', () => {
    expect(freezeExpiry(CHICKEN, '2026-06-01')).toBe('2027-02-26');
  });

  test('an ingredient with no freezer figure is not freezable', () => {
    expect(isFreezable(SOY_SAUCE)).toBe(false);
    expect(freezeExpiry(SOY_SAUCE, '2026-06-01')).toBeNull();
    expect(isFreezable(CHICKEN)).toBe(true);
  });
});

describe('canRecomputeExpiry', () => {
  test('predictions may be recomputed; user and label dates never are', () => {
    expect(canRecomputeExpiry('predicted')).toBe(true);
    expect(canRecomputeExpiry(null)).toBe(true);
    expect(canRecomputeExpiry('user')).toBe(false);
    expect(canRecomputeExpiry('label')).toBe(false);
  });
});
