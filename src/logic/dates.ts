import { addDays, format, parseISO, startOfWeek } from 'date-fns';

import type { MealType } from '@/types';

/**
 * The day boundary is device-local midnight. All day grouping goes through this
 * function so the rule lives in one place.
 */
export function localDateString(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

export function parseLocalDate(localDate: string): Date {
  return parseISO(`${localDate}T00:00:00`);
}

export function isToday(localDate: string): boolean {
  return localDate === localDateString();
}

export function isFuture(localDate: string): boolean {
  return localDate > localDateString();
}

/** The seven dates of the week containing `localDate`, Monday first. */
export function weekOf(localDate: string): string[] {
  const start = startOfWeek(parseLocalDate(localDate), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => localDateString(addDays(start, i)));
}

export function weekdayInitial(localDate: string): string {
  return format(parseLocalDate(localDate), 'EEEEE');
}

export function dayOfMonth(localDate: string): string {
  return format(parseLocalDate(localDate), 'd');
}

export function friendlyDate(localDate: string): string {
  if (isToday(localDate)) return 'Today';
  if (localDate === localDateString(addDays(new Date(), -1))) return 'Yesterday';
  return format(parseLocalDate(localDate), 'EEEE d MMMM');
}

export function timeOfDay(isoTimestamp: string): string {
  return format(parseISO(isoTimestamp), 'HH:mm');
}

/** Meal type suggested by the clock, used as the review screen default. */
export function mealTypeForTime(date: Date = new Date()): MealType {
  const hour = date.getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

export function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
