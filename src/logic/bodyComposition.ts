import { MIN_TARGET_CALORIES, activityMultiplier, goalAdjustment } from '@/constants/activityLevels';
import { energyTargets, katchMcArdle } from '@/logic/bmr';
import type { BodyMeasurement, Profile, TargetSource } from '@/types';

export const MEASUREMENT_WEIGHT_DIVERGENCE: Record<BodyMeasurement['provider'], number> = { dexa: 0.05, inbody: 0.05 };

export const PLAUSIBLE_RANGES = {
  bodyFatPct: { min: 2, max: 70 },
  fatFreeMassKg: { min: 20, max: 160 },
  statedCalories: { min: 800, max: 6000 },
} as const;

/** Returns warnings only: input is never changed or rejected. */
export function energyInputWarnings(profile: Profile, measurement?: BodyMeasurement): string[] {
  const warnings: string[] = [];
  if (measurement?.bodyFatPct !== null && measurement?.bodyFatPct !== undefined && (measurement.bodyFatPct < PLAUSIBLE_RANGES.bodyFatPct.min || measurement.bodyFatPct > PLAUSIBLE_RANGES.bodyFatPct.max)) warnings.push('Check the body fat percentage you entered.');
  if (measurement && (measurement.fatFreeMassKg < PLAUSIBLE_RANGES.fatFreeMassKg.min || measurement.fatFreeMassKg > PLAUSIBLE_RANGES.fatFreeMassKg.max)) warnings.push('Check the Fat Free Mass you entered.');
  if (profile.statedCalories !== null && (profile.statedCalories < PLAUSIBLE_RANGES.statedCalories.min || profile.statedCalories > PLAUSIBLE_RANGES.statedCalories.max)) warnings.push('Check the calorie figure and what it represents.');
  const target = resolveTarget(profile, measurement ? [measurement] : []);
  if (target !== null && target < MIN_TARGET_CALORIES) warnings.push('This calculation is below the app’s usual minimum. Check the figure before continuing.');
  return warnings;
}

export function dexaFatFreeMass(measurement: Pick<BodyMeasurement, 'weightKg' | 'bodyFatPct' | 'leanTissueKg' | 'boneMineralContentKg'>): number | null {
  if (measurement.bodyFatPct !== null) return measurement.weightKg * (1 - measurement.bodyFatPct / 100);
  if (measurement.leanTissueKg !== null && measurement.boneMineralContentKg !== null) return measurement.leanTissueKg + measurement.boneMineralContentKg;
  return null;
}

type Resolver = (profile: Profile, measurements: readonly BodyMeasurement[]) => number | null;
function measuredTarget(profile: Profile, measurement: BodyMeasurement | undefined): number | null {
  if (!measurement) return null;
  return Math.max(MIN_TARGET_CALORIES, Math.round(katchMcArdle(measurement.fatFreeMassKg) * activityMultiplier(profile.activityLevel) + goalAdjustment(profile.goal)));
}

export const TARGET_RESOLVERS: Record<TargetSource, Resolver> = {
  estimated: (profile) => profile.sex === null || profile.age === null || profile.heightCm === null ? null : energyTargets({ sex: profile.sex, age: profile.age, heightCm: profile.heightCm, weightKg: profile.weightKg }, profile.activityLevel, profile.goal).target,
  dexa: (profile, measurements) => measuredTarget(profile, measurements.find((item) => item.provider === 'dexa')),
  inbody: (profile, measurements) => measuredTarget(profile, measurements.find((item) => item.provider === 'inbody')),
  stated: (profile) => {
    if (profile.statedCalories === null || profile.statedFigureKind === null) return null;
    if (profile.statedFigureKind === 'adjusted') return profile.statedCalories;
    const total = profile.statedFigureKind === 'resting'
      ? profile.statedCalories * activityMultiplier(profile.activityLevel)
      : profile.statedCalories;
    return Math.round(total + goalAdjustment(profile.goal));
  },
};

export function resolveTarget(profile: Profile, measurements: readonly BodyMeasurement[]): number | null {
  return TARGET_RESOLVERS[profile.targetSource](profile, measurements);
}

export function isMeasurementStale(profile: Profile, measurement: BodyMeasurement): boolean {
  return Math.abs(profile.weightKg - measurement.weightKg) / measurement.weightKg >= MEASUREMENT_WEIGHT_DIVERGENCE[measurement.provider];
}
