import type { ActivityLevel } from '@/types';

/**
 * The optional sports refinement on the activity step.
 *
 * The activity level alone answers "how often", which leaves a rugby player
 * and a yoga regular training six days a week at the same estimate. Naming
 * the sport answers "how hard", so the two questions together produce a
 * closer figure than either does on its own.
 *
 * Intensities are MET values from the Compendium of Physical Activities,
 * rounded to one decimal. They are population averages for a general-effort
 * session, not a measurement of any particular person's session.
 */
export type SportId =
  | 'running'
  | 'cycling'
  | 'rowing'
  | 'swimming'
  | 'weightlifting'
  | 'soccer'
  | 'basketball'
  | 'rugby'
  | 'tennis'
  | 'pickleball'
  | 'volleyball'
  | 'climbing'
  | 'boxing'
  | 'hiking'
  | 'yoga'
  | 'golf'
  | 'dance';

export interface SportOption {
  value: SportId;
  label: string;
  /** A MaterialCommunityIcons glyph name. */
  icon: string;
  /** MET — multiples of resting energy expenditure. */
  met: number;
}

export const SPORTS: readonly SportOption[] = [
  { value: 'running', label: 'Running', icon: 'run-fast', met: 9.8 },
  { value: 'cycling', label: 'Cycling', icon: 'bike', met: 7.5 },
  { value: 'rowing', label: 'Rowing', icon: 'rowing', met: 7.0 },
  { value: 'swimming', label: 'Swimming', icon: 'swim', met: 7.0 },
  { value: 'weightlifting', label: 'Weightlifting', icon: 'dumbbell', met: 5.0 },
  { value: 'soccer', label: 'Soccer', icon: 'soccer', met: 7.0 },
  { value: 'basketball', label: 'Basketball', icon: 'basketball', met: 6.5 },
  { value: 'rugby', label: 'Rugby', icon: 'rugby', met: 8.3 },
  { value: 'tennis', label: 'Tennis', icon: 'tennis', met: 7.3 },
  { value: 'pickleball', label: 'Pickleball', icon: 'table-tennis', met: 6.0 },
  { value: 'volleyball', label: 'Volleyball', icon: 'volleyball', met: 4.0 },
  { value: 'climbing', label: 'Climbing', icon: 'terrain', met: 8.0 },
  { value: 'boxing', label: 'Boxing', icon: 'boxing-glove', met: 7.8 },
  { value: 'hiking', label: 'Hiking', icon: 'hiking', met: 6.0 },
  { value: 'yoga', label: 'Yoga', icon: 'meditation', met: 3.0 },
  { value: 'golf', label: 'Golf', icon: 'golf', met: 4.8 },
  { value: 'dance', label: 'Dance', icon: 'music-note', met: 5.0 },
];

export function sportLabel(id: SportId): string {
  return SPORTS.find((s) => s.value === id)?.label ?? id;
}

export function isSportId(value: string): value is SportId {
  return SPORTS.some((s) => s.value === value);
}

/** The assumed hour-long sessions per week behind each activity level. */
const SESSIONS_PER_WEEK: Record<ActivityLevel, number> = {
  sedentary: 0.5,
  light: 2,
  moderate: 4,
  active: 6.5,
  very_active: 9,
};

const SESSION_MINUTES = 60;

/**
 * Daily kilocalories attributable to the selected sports, averaged across the
 * week.
 *
 * The activity level supplies the session count; the sports supply the
 * intensity, averaged across everything selected because a week of mixed
 * training is what is being described. MET is taken net of rest (`met - 1`)
 * so the hour spent training is not also counted as an hour spent resting.
 *
 * Returns 0 with nothing selected — the estimate then rests on the activity
 * level alone, exactly as it did before this control existed.
 */
export function sportsDailyBurn(
  sports: readonly SportId[],
  level: ActivityLevel | null,
  weightKg: number | null,
): number {
  if (sports.length === 0 || level === null || weightKg === null || !Number.isFinite(weightKg) || weightKg <= 0) return 0;

  const mets = sports
    .map((id) => SPORTS.find((s) => s.value === id)?.met)
    .filter((met): met is number => met !== undefined);
  if (mets.length === 0) return 0;

  const averageMet = mets.reduce((sum, met) => sum + met, 0) / mets.length;
  const kcalPerMinute = ((averageMet - 1) * 3.5 * weightKg) / 200;
  const weekly = kcalPerMinute * SESSION_MINUTES * SESSIONS_PER_WEEK[level];
  return weekly / 7;
}
