import { beforeEach, describe, expect, test } from 'vitest';

import {
  getCookingPreferences,
  getOwnedApplianceIds,
  getOwnedAppliances,
  saveCookingPreferences,
  saveOwnedAppliances,
  setApplianceOwnership,
} from '@/db/queries';
import type { CookingPreferences } from '@/types';
import { openTestDatabase } from './stubs/db';

describe('Cooking preferences and appliances persistence', () => {
  beforeEach(() => openTestDatabase());

  test('returns null when no cooking preferences are saved', async () => {
    const prefs = await getCookingPreferences();
    expect(prefs).toBeNull();
  });

  test('saves and retrieves cooking preferences', async () => {
    const initial: CookingPreferences = {
      intents: ['meal_prep'],
      mealPrepStatus: 'completed',
      createdAt: '2026-08-30T12:00:00.000Z',
      updatedAt: '2026-08-30T12:05:00.000Z',
      completedAt: '2026-08-30T12:05:00.000Z',
      deferredAt: null,
    };
    await saveCookingPreferences(initial);

    const retrieved = await getCookingPreferences();
    expect(retrieved).toEqual(initial);
  });

  test('updates cooking preferences on conflict', async () => {
    const initial: CookingPreferences = {
      intents: ['meal_prep'],
      mealPrepStatus: 'not_started',
      createdAt: '2026-08-30T12:00:00.000Z',
      updatedAt: '2026-08-30T12:00:00.000Z',
      completedAt: null,
      deferredAt: null,
    };
    await saveCookingPreferences(initial);

    const updated: CookingPreferences = {
      intents: ['calories', 'meal_prep'],
      mealPrepStatus: 'deferred',
      createdAt: '2026-08-30T12:00:00.000Z',
      updatedAt: '2026-08-30T12:10:00.000Z',
      completedAt: null,
      deferredAt: '2026-08-30T12:10:00.000Z',
    };
    await saveCookingPreferences(updated);

    const retrieved = await getCookingPreferences();
    expect(retrieved).toEqual(updated);
  });

  test('filters out invalid intents and throws on invalid meal prep status', async () => {
    const invalidStatus: CookingPreferences = {
      intents: ['meal_prep'],
      mealPrepStatus: 'invalid_status' as any,
      createdAt: '2026-08-30T12:00:00.000Z',
      updatedAt: '2026-08-30T12:00:00.000Z',
      completedAt: null,
      deferredAt: null,
    };
    await expect(saveCookingPreferences(invalidStatus)).rejects.toThrow('Invalid mealPrepStatus');
  });

  describe('Owned appliances repository', () => {
    test('returns empty array and set when no appliances are configured', async () => {
      const list = await getOwnedAppliances();
      expect(list).toEqual([]);
      const ids = await getOwnedApplianceIds();
      expect(ids.size).toBe(0);
    });

    test('sets appliance ownership individually and toggles ownership', async () => {
      await setApplianceOwnership('air_fryer', true, '2026-08-30T12:00:00.000Z');
      await setApplianceOwnership('rice_cooker', true, '2026-08-30T12:00:00.000Z');

      let ids = await getOwnedApplianceIds();
      expect(ids.has('air_fryer')).toBe(true);
      expect(ids.has('rice_cooker')).toBe(true);
      expect(ids.has('oven')).toBe(false);

      // Toggle air_fryer to not owned
      await setApplianceOwnership('air_fryer', false, '2026-08-30T12:05:00.000Z');
      ids = await getOwnedApplianceIds();
      expect(ids.has('air_fryer')).toBe(false);
      expect(ids.has('rice_cooker')).toBe(true);

      const list = await getOwnedAppliances();
      const airFryer = list.find((item) => item.applianceId === 'air_fryer');
      expect(airFryer?.owned).toBe(false);
    });

    test('batch saves owned appliances in a transaction', async () => {
      await saveOwnedAppliances(
        [
          { applianceId: 'cooktop', owned: true },
          { applianceId: 'oven', owned: true },
          { applianceId: 'microwave', owned: false },
        ],
        '2026-08-30T12:00:00.000Z',
      );

      const ids = await getOwnedApplianceIds();
      expect(ids.has('cooktop')).toBe(true);
      expect(ids.has('oven')).toBe(true);
      expect(ids.has('microwave')).toBe(false);
    });

    test('throws on invalid appliance ID', async () => {
      await expect(
        setApplianceOwnership('invalid_tool' as any, true),
      ).rejects.toThrow('Invalid appliance ID');

      await expect(
        saveOwnedAppliances([{ applianceId: 'toaster' as any, owned: true }]),
      ).rejects.toThrow('Invalid appliance ID');
    });
  });
});
