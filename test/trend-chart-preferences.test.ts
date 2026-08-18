import { beforeEach, describe, expect, test } from 'vitest';

import {
  getChartPreference,
  saveChartPreference,
} from '@/db/queries';
import { db, openTestDatabase, resetTestDatabase } from './stubs/db';

beforeEach(() => openTestDatabase());

describe('trend chart preferences', () => {
  test('documents energy as the first-run default', async () => {
    expect(await getChartPreference()).toEqual(['energy']);
  });

  test('persists enabling, disabling, and ordered reordering as one row', async () => {
    await saveChartPreference(['energy', 'protein', 'fibre']);
    expect(await getChartPreference()).toEqual(['energy', 'protein', 'fibre']);

    await saveChartPreference(['fibre', 'energy']);
    expect(await getChartPreference()).toEqual(['fibre', 'energy']);

    await saveChartPreference([]);
    expect(await getChartPreference()).toEqual([]);
    expect(await db().getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM chart_preferences',
    )).toEqual({ count: 1 });
  });

  test('rejects repeated or unavailable metrics', async () => {
    await expect(saveChartPreference(['energy', 'energy'])).rejects.toThrow(/repeated/i);
    await expect(saveChartPreference(['weight' as never])).rejects.toThrow(/unavailable/i);
  });

  test('delete-all removes the stored configuration and restores the default', async () => {
    await saveChartPreference(['fibre', 'fat']);
    resetTestDatabase();
    expect(await getChartPreference()).toEqual(['energy']);
  });
});
