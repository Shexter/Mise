import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, test } from 'vitest';

import {
  endFast,
  getActiveFast,
  listFastHistory,
  startFast,
} from '../src/db/queries';
import { db, openTestDatabase, resetTestDatabase } from './stubs/db';

beforeEach(() => openTestDatabase());

describe('fasting query layer', () => {
  test('starts without a target and ends with the actual interval intact', async () => {
    const startedAt = '2026-08-17T18:00:00.000Z';
    const endedAt = '2026-08-18T10:30:00.000Z';

    const started = await startFast(null, startedAt);
    expect(started).toMatchObject({ startedAt, endedAt: null, targetDurationMinutes: null });
    expect(await getActiveFast()).toEqual(started);

    const ended = await endFast(endedAt);
    expect(Date.parse(ended.endedAt!) - Date.parse(ended.startedAt)).toBe(16.5 * 60 * 60 * 1_000);
    expect(await getActiveFast()).toBeNull();
    expect(await listFastHistory()).toEqual([ended]);
  });

  test('stores an optional target and rejects a second active fast atomically', async () => {
    const original = await startFast(16 * 60, '2026-08-17T20:00:00.000Z');
    await expect(startFast(12 * 60, '2026-08-17T21:00:00.000Z')).rejects.toThrow(
      'A fast is already active.',
    );
    expect(await getActiveFast()).toEqual(original);
    const rows = await db().getAllAsync<{ id: string }>('SELECT id FROM fasts');
    expect(rows).toHaveLength(1);
  });

  test('keeps a cross-midnight fast as one history row', async () => {
    await startFast(14 * 60, '2026-08-17T23:45:00-07:00');
    await endFast('2026-08-18T08:15:00-07:00');
    const history = await listFastHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      startedAt: '2026-08-17T23:45:00-07:00',
      endedAt: '2026-08-18T08:15:00-07:00',
    });
  });

  test('start and end leave pantry, meal, item, and consumption rows byte-for-byte unchanged', async () => {
    await seedFoodHistory();
    const before = await foodHistorySnapshot();

    await startFast(16 * 60, '2026-08-17T20:00:00.000Z');
    await endFast('2026-08-18T12:00:00.000Z');

    expect(await foodHistorySnapshot()).toEqual(before);
  });

  test('delete-all reset removes active and completed fasting data', async () => {
    await startFast(null, '2026-08-15T20:00:00.000Z');
    await endFast('2026-08-16T10:00:00.000Z');
    await startFast(12 * 60, '2026-08-17T20:00:00.000Z');

    resetTestDatabase();

    expect(await getActiveFast()).toBeNull();
    expect(await listFastHistory()).toEqual([]);
  });
});

describe('fasting structural and accessibility boundaries', () => {
  const featureFiles = ['src/store/fastingStore.ts', 'app/fasting.tsx'];
  const featureSource = featureFiles.map((path) => readFileSync(path, 'utf8')).join('\n');
  const screen = readFileSync('app/fasting.tsx', 'utf8');

  test('feature modules cannot reach pantry depletion, consumption, or capture review', () => {
    expect(featureSource).not.toMatch(/from ['"][^'"]*(deplet|consumption|capture-review)/i);
    expect(featureSource).not.toMatch(/from ['"][^'"]*pantry/i);
  });

  test('the timer is live, labelled, large-text friendly, and has no motion to reduce', () => {
    expect(screen).toContain('setInterval(() => setNow(Date.now()), 1_000)');
    expect(screen).toContain('accessibilityRole="timer"');
    expect(screen).toContain('accessibilityLabel={`Active fast. Elapsed time');
    expect(screen).toContain('accessibilityHint="Starts a fasting timer now."');
    expect(screen).toContain('accessibilityHint="Saves this fast to history');
    expect(screen).toContain('<Screen\n      scroll');
    expect(screen).not.toMatch(/Animated|reanimated|useReducedMotion/);
    expect(screen).not.toMatch(/height:\s*\d/);
  });

  test('the fasting screen uses theme tokens for colour, font, and spacing', () => {
    expect(screen).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(screen).not.toMatch(/rgba?\(/i);
    expect(screen).not.toMatch(/fontFamily:\s*['"]/);
    expect(screen).not.toMatch(/(?:fontSize|lineHeight|padding|margin|gap):\s*\d/);
  });
});

async function seedFoodHistory(): Promise<void> {
  await db().runAsync(
    `INSERT INTO canonical_items
       (id, display_name, class, default_location, shelf_life_days, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['rice', 'Rice', 'staple', 'pantry', '{}', '2026-08-01T00:00:00.000Z'],
  );
  await db().runAsync(
    `INSERT INTO pantry_items
       (id, canonical_id, location_id, purchased_at, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['pantry-1', 'rice', 'pantry', '2026-08-01', 'in_stock', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'],
  );
  await db().runAsync(
    `INSERT INTO meals (id, logged_at, local_date, meal_type, name, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['meal-1', '2026-08-17T18:00:00.000Z', '2026-08-17', 'dinner', 'Rice bowl', 'manual', '2026-08-17T18:00:00.000Z'],
  );
  await db().runAsync(
    `INSERT INTO meal_items (id, meal_id, name, quantity, unit, calories)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['item-1', 'meal-1', 'Rice', 1, 'serving', 240],
  );
  await db().runAsync(
    `INSERT INTO consumption_events
       (id, pantry_item_id, canonical_id, meal_id, qty, unit, kind, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['event-1', 'pantry-1', 'rice', 'meal-1', 100, 'g', 'meal_item', '2026-08-17T18:00:00.000Z'],
  );
}

async function foodHistorySnapshot(): Promise<Record<string, unknown[]>> {
  return {
    pantry_items: await db().getAllAsync('SELECT * FROM pantry_items ORDER BY id'),
    meals: await db().getAllAsync('SELECT * FROM meals ORDER BY id'),
    meal_items: await db().getAllAsync('SELECT * FROM meal_items ORDER BY id'),
    consumption_events: await db().getAllAsync('SELECT * FROM consumption_events ORDER BY id'),
  };
}
