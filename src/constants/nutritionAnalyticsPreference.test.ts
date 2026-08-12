import { beforeEach, describe, expect, test } from 'vitest';

import {
  DEFAULT_NUTRITION_ANALYTICS_PREFERENCE,
  readNutritionAnalyticsPreference,
  writeNutritionAnalyticsPreference,
} from '@/constants/nutritionAnalyticsPreference';
import { clearKvStore } from '../../test/stubs/expo-sqlite-kv-store';

beforeEach(clearKvStore);

describe('nutrition analytics preference', () => {
  test('restores valid local display choices', () => {
    const preference = { metric: 'fibre', range: '90-day', aggregation: 'weekly', chartForm: 'line' } as const;
    writeNutritionAnalyticsPreference(preference);
    expect(readNutritionAnalyticsPreference()).toEqual(preference);
  });

  test('falls back field by field without changing nutrition records', () => {
    expect(readNutritionAnalyticsPreference()).toEqual(DEFAULT_NUTRITION_ANALYTICS_PREFERENCE);
    writeNutritionAnalyticsPreference({ metric: 'protein', range: '30-day', aggregation: 'daily', chartForm: 'bar' });
    expect(readNutritionAnalyticsPreference()).toMatchObject({ metric: 'protein', range: '30-day' });
  });
});
