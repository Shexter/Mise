import { beforeEach, describe, expect, test } from 'vitest';

import {
  addLocation,
  discardItem,
  freezeItem,
  getLocations,
  getPantryItem,
  insertPantryItem,
  listPantryItems,
  loadSeedData,
  markItemOpened,
  markItemRunningLow,
  markItemUsedUp,
  removeLocation,
  renameLocation,
  setItemFullness,
  updateItemLocation,
} from '../src/db/queries';
import { localDateString } from '../src/logic/dates';
import { openTestDatabase, resetTestDatabase } from './stubs/db';

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
});

describe('locations', () => {
  test('the four defaults exist on a fresh install', async () => {
    const locations = await getLocations();
    expect(locations.map((l) => l.id)).toEqual([
      'fridge',
      'freezer',
      'pantry',
      'counter',
    ]);
  });

  test('a user-added location behaves as its kind for expiry', async () => {
    const chest = await addLocation('Chest freezer', 'freezer');
    const item = await insertPantryItem({
      canonicalId: 'chicken-breast',
      locationId: chest.id,
    });
    const inFridge = await insertPantryItem({
      canonicalId: 'chicken-breast',
      locationId: 'fridge',
    });
    // Freezer life (270 d) vs fridge life (2 d): same food, different dates.
    expect(item.expiresAt! > inFridge.expiresAt!).toBe(true);
  });

  test('renaming changes the name and nothing else', async () => {
    await renameLocation('pantry', 'Rice cabinet');
    const pantry = (await getLocations()).find((l) => l.id === 'pantry');
    expect(pantry?.name).toBe('Rice cabinet');
    expect(pantry?.kind).toBe('ambient');
  });

  test('removing a location moves its items and never deletes them', async () => {
    const spice = await addLocation('Spice drawer', 'ambient');
    const a = await insertPantryItem({ canonicalId: 'gochugaru', locationId: spice.id });
    const b = await insertPantryItem({ canonicalId: 'five-spice', locationId: spice.id });
    const c = await insertPantryItem({ canonicalId: 'white-pepper', locationId: spice.id });

    await removeLocation(spice.id, 'pantry');

    const remaining = await listPantryItems();
    for (const id of [a.id, b.id, c.id]) {
      const item = remaining.find((entry) => entry.id === id);
      expect(item).toBeDefined();
      expect(item?.locationId).toBe('pantry');
    }
    expect((await getLocations()).find((l) => l.id === spice.id)).toBeUndefined();
  });

  test('removing a location into itself is refused', async () => {
    await expect(removeLocation('pantry', 'pantry')).rejects.toThrow();
  });
});

describe('expiry on write events', () => {
  test('creation predicts a date without user input, and location matters', async () => {
    const fridge = await insertPantryItem({
      canonicalId: 'chicken-breast',
      locationId: 'fridge',
      purchasedAt: '2026-06-01',
    });
    const freezer = await insertPantryItem({
      canonicalId: 'chicken-breast',
      locationId: 'freezer',
      purchasedAt: '2026-06-01',
    });
    expect(fridge.expiresAt).toBe('2026-06-03');
    expect(freezer.expiresAt).toBe('2027-02-26');
    expect(fridge.expirySource).toBe('predicted');
  });

  test('marking opened shortens the prediction', async () => {
    const sauce = await insertPantryItem({
      canonicalId: 'oyster-sauce',
      locationId: 'fridge',
    });
    await markItemOpened(sauce.id);
    const opened = await getPantryItem(sauce.id);
    expect(opened?.openedAt).toBe(localDateString());
    expect(opened!.expiresAt! < sauce.expiresAt!).toBe(true);
  });

  test('freezing moves the item and extends its life', async () => {
    const meat = await insertPantryItem({
      canonicalId: 'pork-belly',
      locationId: 'fridge',
    });
    await freezeItem(meat.id, 'freezer');
    const frozen = await getPantryItem(meat.id);
    expect(frozen?.locationId).toBe('freezer');
    expect(frozen!.expiresAt! > meat.expiresAt!).toBe(true);
  });

  test('moving between locations recomputes the prediction', async () => {
    const ginger = await insertPantryItem({
      canonicalId: 'ginger',
      locationId: 'counter', // 30 days
    });
    await updateItemLocation(ginger.id, 'fridge'); // 60 days
    const moved = await getPantryItem(ginger.id);
    expect(moved!.expiresAt! > ginger.expiresAt!).toBe(true);
  });

  test('a user-entered date survives every recompute', async () => {
    const labelled = await insertPantryItem({
      canonicalId: 'chicken-breast',
      locationId: 'fridge',
      expiresAt: '2026-12-24',
      expirySource: 'user',
    });
    await markItemOpened(labelled.id);
    await updateItemLocation(labelled.id, 'counter');
    await freezeItem(labelled.id, 'freezer');
    const after = await getPantryItem(labelled.id);
    expect(after?.expiresAt).toBe('2026-12-24');
    expect(after?.expirySource).toBe('user');
    // The freeze still moved it — only the date is protected.
    expect(after?.locationId).toBe('freezer');
  });
});

describe('items and status actions', () => {
  test('two bottles of the same sauce are two items on one canonical', async () => {
    const a = await insertPantryItem({ canonicalId: 'soy-sauce-light', locationId: 'pantry' });
    const b = await insertPantryItem({ canonicalId: 'soy-sauce-light', locationId: 'pantry' });
    await markItemOpened(a.id);

    const items = (await listPantryItems()).filter(
      (item) => item.canonicalId === 'soy-sauce-light',
    );
    expect(items.length).toBe(2);
    expect(items.filter((item) => item.openedAt !== null).length).toBe(1);
    expect(a.id).not.toBe(b.id);
  });

  test('a user-typed quantity is recorded as theirs', async () => {
    const rice = await insertPantryItem({
      canonicalId: 'jasmine-rice',
      locationId: 'pantry',
      qtyRemaining: 5000,
      qtyUnit: 'g',
    });
    expect(rice.qtySource).toBe('user');
    const loose = await insertPantryItem({
      canonicalId: 'ginger',
      locationId: 'counter',
    });
    expect(loose.qtySource).toBeNull();
  });

  test('one-tap actions set the advisory status', async () => {
    const item = await insertPantryItem({ canonicalId: 'milk', locationId: 'fridge' });
    await markItemRunningLow(item.id);
    expect((await getPantryItem(item.id))?.status).toBe('running_low');
    await markItemUsedUp(item.id);
    expect((await getPantryItem(item.id))?.status).toBe('out');
  });

  test('a fullness tap overrides a prior status tap', async () => {
    const jar = await insertPantryItem({ canonicalId: 'gochujang', locationId: 'fridge' });
    await markItemRunningLow(jar.id);
    await setItemFullness(jar.id, 'half');
    const after = await getPantryItem(jar.id);
    expect(after?.fullness).toBe('half');
    expect(after?.status).toBe('in_stock');
  });

  test('discarding removes the item from the catalogue but keeps the row', async () => {
    const item = await insertPantryItem({ canonicalId: 'cilantro', locationId: 'fridge' });
    await discardItem(item.id);
    expect((await listPantryItems()).find((i) => i.id === item.id)).toBeUndefined();
    expect((await getPantryItem(item.id))?.status).toBe('discarded');
  });

  test('the catalogue lists soonest expiry first', async () => {
    await insertPantryItem({ canonicalId: 'jasmine-rice', locationId: 'pantry' });
    const urgent = await insertPantryItem({ canonicalId: 'salmon', locationId: 'fridge' });
    const items = await listPantryItems();
    expect(items[0]?.id).toBe(urgent.id);
  });
});

describe('delete all data', () => {
  test('clears pantry items and returns locations to the defaults', async () => {
    await addLocation('Garage freezer', 'freezer');
    await insertPantryItem({ canonicalId: 'milk', locationId: 'fridge' });

    resetTestDatabase();
    await loadSeedData();

    expect(await listPantryItems()).toEqual([]);
    expect((await getLocations()).map((l) => l.id)).toEqual([
      'fridge',
      'freezer',
      'pantry',
      'counter',
    ]);
  });
});
