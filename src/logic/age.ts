/**
 * Calendar-only age arithmetic, to the contract in `age.test.ts`.
 *
 * No `Date` arithmetic, no UTC conversion, no clock access beyond the one
 * explicit reader at the bottom, and no way back from an age to a birth date:
 * the birthday exists in component state and is discarded on confirmation.
 */

import { AGE_RANGE } from '@/logic/onboardingDomain';

/** A date as a person reads it off a calendar. Months are 1-12. */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (!Number.isInteger(year) || month < 1 || month > 12) return 0;
  if (month === 2 && isLeapYear(year)) return 29;
  return MONTH_LENGTHS[month - 1]!;
}

export function isValidCalendarDate(date: CalendarDate): boolean {
  const { year, month, day } = date;
  if (![year, month, day].every((part) => Number.isInteger(part))) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

/**
 * The one documented leap-day rule: a February 29 birthday reaches its
 * anniversary on March 1 in a non-leap year. Decided by comparing calendar
 * parts only, so the answer never shifts with a time zone.
 */
export function ageOnDate(birthday: CalendarDate, today: CalendarDate): number {
  if (!isValidCalendarDate(birthday) || !isValidCalendarDate(today)) return Number.NaN;

  const anniversary = birthday.month === 2 && birthday.day === 29 && !isLeapYear(today.year)
    ? { month: 3, day: 1 }
    : { month: birthday.month, day: birthday.day };

  const reached =
    today.month > anniversary.month ||
    (today.month === anniversary.month && today.day >= anniversary.day);

  return today.year - birthday.year - (reached ? 0 : 1);
}

/** The tuple-shaped form the picker works in. */
export function computeAge(
  year: number,
  month: number,
  day: number,
  today: CalendarDate = todayCalendarDate(),
): number {
  return ageOnDate({ year, month, day }, today);
}

export function validateAge(age: number): boolean {
  return Number.isInteger(age) && age >= AGE_RANGE.min && age <= AGE_RANGE.max;
}

/**
 * The earliest and latest birthdays that produce a supported age today, so the
 * native picker can refuse an unsupported date rather than accept it and then
 * complain. `latest` belongs to someone turning `AGE_RANGE.min` today;
 * `earliest` to someone whose `AGE_RANGE.max` year has not yet run out.
 */
export function supportedBirthdayRange(today: CalendarDate): {
  earliest: CalendarDate;
  latest: CalendarDate;
} {
  return {
    earliest: shiftYears(today, -(AGE_RANGE.max + 1), 1),
    latest: shiftYears(today, -AGE_RANGE.min, 0),
  };
}

/** Keeps February 29 addressable by falling back to the 28th in a common year. */
function shiftYears(date: CalendarDate, years: number, dayOffset: number): CalendarDate {
  const year = date.year + years;
  const day = Math.min(date.day + dayOffset, daysInMonth(year, date.month));
  return { year, month: date.month, day };
}

/** The device's local calendar date — the only clock reading in this module. */
export function todayCalendarDate(now: Date = new Date()): CalendarDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export function toJsDate(date: CalendarDate): Date {
  return new Date(date.year, date.month - 1, date.day);
}

export function fromJsDate(date: Date): CalendarDate {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}
