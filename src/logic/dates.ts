import {
  addDays,
  addMonths as addCalendarMonths,
  addWeeks as addCalendarWeeks,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

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

/** Monday-first grid for the month, including adjacent-month spill days. */
export function monthOf(localDate: string): string[] {
  const month = parseLocalDate(localDate);
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const count = differenceInCalendarDays(end, start) + 1;
  return Array.from({ length: count }, (_, index) =>
    localDateString(addDays(start, index)),
  );
}

export function addMonths(localDate: string, amount: number): string {
  return localDateString(addCalendarMonths(parseLocalDate(localDate), amount));
}

export function addWeeks(localDate: string, amount: number): string {
  return localDateString(addCalendarWeeks(parseLocalDate(localDate), amount));
}

export function monthLabel(localDate: string): string {
  return format(parseLocalDate(localDate), 'MMMM yyyy');
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

/**
 * The full weekday and date, for the line beneath a screen title that already
 * says "Today". `friendlyDate` collapses to a relative word and so cannot say
 * which day that actually is; both are shown together.
 */
export function fullDate(localDate: string): string {
  return format(parseLocalDate(localDate), 'EEEE, d MMMM');
}

/**
 * The week a planning date sits in, written for a heading: `7 – 13 September`,
 * or `28 September – 4 October` when it straddles two months. The month is
 * printed once when both ends share it, because repeating it reads as two
 * separate dates rather than one range.
 */
export function weekRangeLabel(localDate: string): string {
  const days = weekOf(localDate);
  const start = parseLocalDate(days[0]!);
  const end = parseLocalDate(days[6]!);
  const sameMonth = format(start, 'MM yyyy') === format(end, 'MM yyyy');
  return `${format(start, sameMonth ? 'd' : 'd MMMM')} – ${format(end, 'd MMMM')}`;
}

export function timeOfDay(isoTimestamp: string): string {
  return format(parseISO(isoTimestamp), 'HH:mm');
}

/**
 * Which quarter of the day a timestamp falls in, for the icon beside a logged
 * meal. Deliberately the same boundaries as `mealTypeForTime`, so the sun a
 * row shows agrees with the meal type the review screen defaulted to.
 */
export function dayPart(isoTimestamp: string): 'morning' | 'midday' | 'evening' | 'night' {
  const hour = parseISO(isoTimestamp).getHours();
  if (hour < 11) return 'morning';
  if (hour < 15) return 'midday';
  if (hour < 21) return 'evening';
  return 'night';
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
