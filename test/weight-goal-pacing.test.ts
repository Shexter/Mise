import { describe, expect, test } from 'vitest';

import { format } from 'date-fns';

import { rateGoalAdjustment, WEIGHT_GOAL_RATE_RANGE } from '../src/constants/activityLevels';
import { energyTargets, goalCalorieAdjustment } from '../src/logic/bmr';
import { resolveTarget } from '../src/logic/bodyComposition';
import { goalSummaryLabel, weightGoalForecast } from '../src/logic/weightGoalPacing';
import type { BodyMeasurement, Profile } from '../src/types';

const baseInput = { sex: 'female' as const, age: 30, heightCm: 170, weightKg: 70 };

const profile: Profile = {
  sex: 'female', age: 30, heightCm: 170, weightKg: 70,
  activityLevel: 'moderate', goal: 'maintain', targetCalories: 2250,
  targetSource: 'estimated', statedCalories: null, statedFigureKind: null,
  proteinPct: 0.3, carbsPct: 0.4, fatPct: 0.3, fibreTargetG: 30, units: 'metric',
  onboardedAt: '2026-01-01T00:00:00.000Z',
  targetWeightKg: null, weightGoalRateKgPerWeek: null,
};

describe('rate-derived calorie adjustment', () => {
  test('neither target nor rate set: existing fixed-adjustment behavior, unchanged', () => {
    expect(energyTargets(baseInput, 'moderate', 'maintain')).toEqual({ maintenance: 2250, target: 2250 });
    expect(energyTargets(baseInput, 'moderate', 'lose')).toEqual({ maintenance: 2250, target: 1750 });
  });

  test('only target weight set, no rate: fixed adjustment still applies', () => {
    expect(
      energyTargets(baseInput, 'moderate', 'lose', { targetWeightKg: 65, weightGoalRateKgPerWeek: null }),
    ).toEqual({ maintenance: 2250, target: 1750 });
  });

  test('only rate set, no target weight: fixed adjustment still applies', () => {
    expect(
      energyTargets(baseInput, 'moderate', 'gain', { targetWeightKg: null, weightGoalRateKgPerWeek: 0.5 }),
    ).toEqual({ maintenance: 2250, target: 2550 });
  });

  test('both set: adjustment derives from the rate, ignoring goal entirely', () => {
    // Losing 5kg at 0.5kg/week -> deficit of 0.5 * 7700 / 7 = 550 kcal/day.
    expect(
      energyTargets(baseInput, 'moderate', 'maintain', { targetWeightKg: 65, weightGoalRateKgPerWeek: 0.5 }),
    ).toEqual({ maintenance: 2250, target: 1700 });
    // Gaining, at the same rate, produces a surplus instead of a deficit.
    expect(
      energyTargets(baseInput, 'moderate', 'maintain', { targetWeightKg: 75, weightGoalRateKgPerWeek: 0.5 }),
    ).toEqual({ maintenance: 2250, target: 2800 });
  });

  test('an extreme rate is floored at MIN_TARGET_CALORIES, same as the fixed-adjustment path', () => {
    // Losing 10kg at the bound maximum (1kg/week) -> 1100 kcal/day deficit, below the floor.
    expect(
      energyTargets(baseInput, 'moderate', 'maintain', { targetWeightKg: 60, weightGoalRateKgPerWeek: WEIGHT_GOAL_RATE_RANGE.max }),
    ).toEqual({ maintenance: 2250, target: 1200 });
  });

  test('already at the target weight yields zero adjustment, not a divide-by-zero', () => {
    expect(rateGoalAdjustment(70, 70, 0.5)).toBe(0);
    expect(
      energyTargets(baseInput, 'moderate', 'maintain', { targetWeightKg: 70, weightGoalRateKgPerWeek: 0.5 }),
    ).toEqual({ maintenance: 2250, target: 2250 });
  });

  test('goalCalorieAdjustment is the single dispatcher both energyTargets and bodyComposition use', () => {
    expect(goalCalorieAdjustment(70, 'lose')).toBe(-500);
    expect(goalCalorieAdjustment(70, 'lose', { targetWeightKg: 65, weightGoalRateKgPerWeek: 0.5 })).toBe(-550);
  });
});

describe('the rate-derived adjustment applies across every calorie source, not just estimated', () => {
  const dexa: BodyMeasurement = {
    provider: 'dexa', weightKg: 70, measuredAt: '2026-01-01', bodyFatPct: 20,
    leanTissueKg: null, boneMineralContentKg: null, fatFreeMassKg: 56,
  };

  test('a DEXA-sourced target responds to target weight + rate the same way estimated does', () => {
    // profile.goal is 'maintain' (0 kcal fixed adjustment); losing 5kg at
    // 0.5kg/week is a 550 kcal/day rate-derived deficit instead.
    const fixed = resolveTarget({ ...profile, targetSource: 'dexa' }, [dexa]);
    const paced = resolveTarget(
      { ...profile, targetSource: 'dexa', targetWeightKg: 65, weightGoalRateKgPerWeek: 0.5 },
      [dexa],
    );
    expect(fixed).not.toBeNull();
    expect(paced).not.toBeNull();
    expect(paced).toBe((fixed ?? 0) - 550);
  });

  test('a stated resting-calorie target responds to target weight + rate too', () => {
    const stated: Profile = { ...profile, targetSource: 'stated', statedCalories: 1600, statedFigureKind: 'resting' };
    const fixed = resolveTarget(stated, []);
    const paced = resolveTarget({ ...stated, targetWeightKg: 65, weightGoalRateKgPerWeek: 0.5 }, []);
    expect(paced).toBe((fixed ?? 0) - 550);
  });

  test('a stated already-adjusted figure is untouched — it never called goalAdjustment either', () => {
    const stated: Profile = { ...profile, targetSource: 'stated', statedCalories: 1900, statedFigureKind: 'adjusted' };
    expect(resolveTarget({ ...stated, targetWeightKg: 65, weightGoalRateKgPerWeek: 0.5 }, [])).toBe(1900);
  });
});

describe('weight-goal forecast', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');

  test('a target below current weight with a positive rate resolves to a positive week count', () => {
    const forecast = weightGoalForecast(70, 65, 0.5, now);
    expect(forecast?.weeksToGoal).toBe(10);
    expect(forecast?.forecastDate.getTime()).toBeGreaterThan(now.getTime());
  });

  test('a target above current weight with a positive rate also resolves to a positive week count', () => {
    const forecast = weightGoalForecast(70, 75, 0.5, now);
    expect(forecast?.weeksToGoal).toBe(10);
    expect(forecast?.forecastDate.getTime()).toBeGreaterThan(now.getTime());
  });

  test('a changed current weight changes the next-computed forecast, with nothing stored', () => {
    const before = weightGoalForecast(70, 65, 0.5, now);
    const after = weightGoalForecast(68, 65, 0.5, now);
    expect(before?.weeksToGoal).toBe(10);
    expect(after?.weeksToGoal).toBe(6);
  });

  test('a zero rate returns no forecast rather than dividing by zero', () => {
    expect(weightGoalForecast(70, 65, 0, now)).toBeNull();
  });

  test('already at the target weight returns a zero-week forecast, not a nonsensical date', () => {
    const forecast = weightGoalForecast(65, 65, 0.5, now);
    expect(forecast?.weeksToGoal).toBe(0);
    expect(forecast?.forecastDate.getTime()).toBe(now.getTime());
  });
});

describe('goal row summary — the behavior a UI test would cover, at the layer this repo tests', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');

  test('setting a target and rate shows a forecast estimate alongside the goal label', () => {
    const forecast = weightGoalForecast(70, 65, 0.5, now);
    expect(goalSummaryLabel('maintain', 70, 65, 0.5, now)).toBe(
      `Maintain · est. ${format(forecast!.forecastDate, 'd MMM yyyy')}`,
    );
  });

  test('clearing the rate reverts to the plain goal label, no forecast shown', () => {
    expect(goalSummaryLabel('lose', 70, 65, null, now)).toBe('Lose');
  });

  test('clearing the target weight reverts to the plain goal label, no forecast shown', () => {
    expect(goalSummaryLabel('lose', 70, null, 0.5, now)).toBe('Lose');
  });

  test('neither target nor rate ever set: plain goal label, matching todays exact behavior', () => {
    expect(goalSummaryLabel('gain', 70, null, null, now)).toBe('Gain');
  });

  test('already at the target weight reads as reached, not a stale future date', () => {
    expect(goalSummaryLabel('maintain', 65, 65, 0.5, now)).toBe('Maintain · already there');
  });
});
