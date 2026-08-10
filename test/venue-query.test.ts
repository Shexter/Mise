import { beforeEach, describe, expect, test } from 'vitest';

import {
  getDishVenueDefault,
  getMatchQueue,
  insertMeal,
  insertPantryItem,
  loadSeedData,
  outstandingPortionsForDish,
  saveDishVenueDefault,
} from '../src/db/queries';
import { inferVenueForDraft, stockMatchForDraft } from '../src/logic/venueService';
import { openTestDatabase } from './stubs/db';

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
});

function meal(name: string, venue: 'home' | 'out' | 'leftovers', servingsMult: number, loggedAt: string) {
  return insertMeal({
    loggedAt, localDate: loggedAt.slice(0, 10), mealType: 'dinner', name,
    photoUri: null, source: 'manual', confidence: null, venue, servingsMult,
    items: [{ name, quantity: 1, unit: 'serving', calories: 0,
      proteinG: 0, carbsG: 0, fatG: 0, isManualAddition: false }],
  });
}

describe('local venue signals', () => {
  test('stock match is a ratio, and unresolved items produce no signal', async () => {
    await insertPantryItem({ canonicalId: 'jasmine-rice', locationId: 'pantry' });
    expect(await stockMatchForDraft([
      { name: 'Rice', canonicalId: 'jasmine-rice' },
      { name: 'Chicken', canonicalId: 'chicken-breast' },
    ])).toBe(0.5);
    expect(await stockMatchForDraft([{ name: 'not a real fixture food' }])).toBeNull();
    expect(await getMatchQueue()).toEqual([]);
  });

  test('a batch offers each unconsumed portion, then stops', async () => {
    await meal('Sunday Curry', 'home', 4, '2026-08-01T18:00:00.000Z');
    expect(await outstandingPortionsForDish(' sunday curry ')).toBe(3);
    await meal('Sunday curry', 'leftovers', 1, '2026-08-02T12:00:00.000Z');
    await meal('Sunday curry', 'leftovers', 1, '2026-08-03T12:00:00.000Z');
    expect(await outstandingPortionsForDish('Sunday Curry')).toBe(1);
    await meal('Sunday curry', 'leftovers', 1, '2026-08-04T12:00:00.000Z');
    expect(await outstandingPortionsForDish('Sunday Curry')).toBe(0);
  });

  test('a later correction replaces the learned dish default', async () => {
    await saveDishVenueDefault('Friday Take-away!', 'out');
    expect(await getDishVenueDefault('friday take away')).toBe('out');
    expect(await inferVenueForDraft('Friday take away', [{ name: 'unknown dish' }], null))
      .toBe('out');
    await saveDishVenueDefault('Friday take-away', 'home');
    expect(await getDishVenueDefault('FRIDAY TAKE AWAY')).toBe('home');
  });
});
