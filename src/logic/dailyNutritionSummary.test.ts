import { describe, expect, test } from 'vitest';

import { dailyNutritionSummary, nutritionContributors } from '@/logic/dailyNutritionSummary';
import type { DailyTarget, MealWithItems } from '@/types';

const target: DailyTarget = {
  localDate: '2026-08-11',
  targetCalories: 2050,
  proteinG: 154,
  carbsG: 205,
  fatG: 68,
  fibreG: 30,
};

function meal(
  id: string,
  items: MealWithItems['items'],
): MealWithItems {
  return {
    id,
    loggedAt: '2026-08-11T12:00:00.000Z',
    localDate: '2026-08-11',
    mealType: 'lunch',
    name: id,
    photoUri: null,
    source: 'manual',
    confidence: null,
    venue: 'home',
    servingsMult: 1,
    createdAt: '2026-08-11T12:00:00.000Z',
    items,
  };
}

function item(
  id: string,
  nutrition: Pick<MealWithItems['items'][number], 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'fibreG'>,
): MealWithItems['items'][number] {
  return {
    id,
    mealId: 'meal',
    name: id,
    quantity: 1,
    unit: 'serving',
    ...nutrition,
    isManualAddition: true,
    sortOrder: 0,
    canonicalId: null,
  };
}

describe('dailyNutritionSummary', () => {
  test('uses the target recorded for the selected day', () => {
    const summary = dailyNutritionSummary(target.localDate, [], target);

    expect(summary.metrics.energy.target).toBe(2050);
    expect(summary.metrics.fibre.target).toBe(30);
    expect(summary.metrics.energy).toMatchObject({
      knownValue: 0,
      coverage: 'no-meals',
      loggedItemCount: 0,
    });
  });

  test('keeps a known subtotal while exposing partial coverage separately', () => {
    const summary = dailyNutritionSummary(target.localDate, [meal('lunch', [
      item('known', { calories: 400, proteinG: 24, carbsG: 35, fatG: 12, fibreG: 6 }),
      item('unknown', { calories: 100, proteinG: null, carbsG: null, fatG: null, fibreG: null }),
    ])], target);

    expect(summary.metrics.energy).toMatchObject({
      knownValue: 500,
      coverage: 'complete',
      knownItemCount: 2,
    });
    expect(summary.metrics.protein).toMatchObject({
      knownValue: 24,
      coverage: 'partial',
      knownItemCount: 1,
      loggedItemCount: 2,
    });
    expect(summary.metrics.fibre).toMatchObject({
      knownValue: 6,
      coverage: 'partial',
    });
  });

  test('never turns an entirely unknown logged nutrient into zero', () => {
    const summary = dailyNutritionSummary(target.localDate, [meal('legacy', [
      item('legacy', { calories: 250, proteinG: null, carbsG: null, fatG: null, fibreG: null }),
    ])], target);

    expect(summary.metrics.protein.knownValue).toBeNull();
    expect(summary.metrics.protein.coverage).toBe('unknown');
    expect(summary.metrics.fibre.knownValue).toBeNull();
  });

  test('does not substitute the current profile when the day has no recorded target', () => {
    const summary = dailyNutritionSummary('2025-01-01', [], null);

    for (const metric of Object.values(summary.metrics)) {
      expect(metric.target).toBeNull();
    }
  });

  test('orders known contributors and excludes wholly unknown meals', () => {
    const contributors = nutritionContributors([
      meal('small', [item('small', { calories: 200, proteinG: 10, carbsG: 20, fatG: 5, fibreG: 2 })]),
      meal('unknown', [item('unknown', { calories: 100, proteinG: null, carbsG: 5, fatG: null, fibreG: null })]),
      meal('large-partial', [
        item('large', { calories: 400, proteinG: 30, carbsG: 20, fatG: 12, fibreG: 6 }),
        item('missing', { calories: 50, proteinG: null, carbsG: null, fatG: null, fibreG: null }),
      ]),
    ], 'protein');

    expect(contributors.map((entry) => entry.mealId)).toEqual(['large-partial', 'small']);
    expect(contributors[0]).toMatchObject({ knownValue: 30, coverage: 'partial' });
  });
});
