/**
 * Unit conversion and confirmable-value state, to the contract in
 * `measurements.test.ts`.
 *
 * Conversions here are exact and unrounded on purpose. `src/logic/units.ts`
 * rounds for display, which is right for a label and wrong for a value that
 * will be converted again: rounding on every unit switch is exactly how a
 * weight drifts a gram at a time. One canonical metric value, converted only
 * at the edges.
 */

import {
  BODY_FAT_RANGE,
  HEIGHT_RANGE_CM,
  WEIGHT_RANGE_KG,
  isWithinRange,
  type NumericRange,
} from '@/logic/onboardingDomain';
import { KG_PER_LB } from '@/logic/units';

const CM_PER_INCH = 2.54;

export function cmToIn(cm: number): number {
  return cm / CM_PER_INCH;
}

export function inToCm(inches: number): number {
  return inches * CM_PER_INCH;
}

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function validateMeasurement(value: number, range: NumericRange): boolean {
  return isWithinRange(value, range);
}

export const validateHeightCm = (value: number): boolean => validateMeasurement(value, HEIGHT_RANGE_CM);
export const validateWeightKg = (value: number): boolean => validateMeasurement(value, WEIGHT_RANGE_KG);
export const validateBodyFatPct = (value: number): boolean => validateMeasurement(value, BODY_FAT_RANGE);

/**
 * Snaps to a step without inheriting binary floating-point noise: 72.34 at a
 * 0.1 step must be 72.3, not 72.30000000000001.
 */
export function snapToNearest(value: number, step: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return value;
  const decimals = decimalPlaces(step);
  return Number((Math.round(value / step) * step).toFixed(decimals));
}

function decimalPlaces(step: number): number {
  const text = String(step);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

export type ParseFailure = 'invalid' | 'out-of-range';
export type ParsedDecimal =
  | { ok: true; value: number }
  | { ok: false; reason: ParseFailure };

/**
 * Direct entry. A comma decimal separator is accepted because much of the
 * world types one. An out-of-range number is reported as out of range and
 * handed back untouched — never quietly clamped into a different measurement.
 */
export function parseDecimalString(text: string, range: NumericRange): ParsedDecimal {
  const normalised = text.trim().replace(',', '.');
  if (normalised.length === 0 || !/^-?\d*\.?\d+$/.test(normalised)) {
    return { ok: false, reason: 'invalid' };
  }
  const value = Number(normalised);
  if (!Number.isFinite(value)) return { ok: false, reason: 'invalid' };
  return isWithinRange(value, range) ? { ok: true, value } : { ok: false, reason: 'out-of-range' };
}

export type MeasurementOrigin = 'anchor' | 'saved' | 'typed' | 'extracted';

/**
 * Where the control points, what the person has actually answered, and
 * whether those are the same thing. Keeping them apart is the whole point:
 * `position` may sit on an anchor while `value` is still null.
 */
export interface ConfirmableMeasurement {
  position: number;
  value: number | null;
  origin: MeasurementOrigin;
  confirmed: boolean;
}

/** Public domain name used by progressive measurement controls. */
export type MeasurementValue = ConfirmableMeasurement;

/** A fresh control: pointing somewhere sensible, answering nothing. */
export function anchorMeasurement(position: number): ConfirmableMeasurement {
  return { position, value: null, origin: 'anchor', confirmed: false };
}

/**
 * A saved value is already an answer. An extracted one is a candidate the
 * person has not looked at yet, so it seeds the control but stays unconfirmed.
 */
export function seedMeasurement(
  value: number,
  origin: 'saved' | 'extracted',
): ConfirmableMeasurement {
  return { position: value, value, origin, confirmed: origin === 'saved' };
}

/** Moving or typing into the control is itself the answer. */
export function adjustMeasurement(
  state: ConfirmableMeasurement,
  position: number,
): ConfirmableMeasurement {
  return { position, value: position, origin: 'typed', confirmed: true };
}

/** The explicit "use this" action, for someone content with where it opened. */
export function confirmMeasurement(state: ConfirmableMeasurement): ConfirmableMeasurement {
  return { ...state, value: state.position, confirmed: true };
}

/** Backing out returns the control to an unanswered state, not to a value. */
export function cancelMeasurement(state: ConfirmableMeasurement): ConfirmableMeasurement {
  return { position: state.position, value: null, origin: 'anchor', confirmed: false };
}

/** Continue and Save stay disabled until this is true. */
export function isAnswered(state: ConfirmableMeasurement): boolean {
  return state.confirmed && state.value !== null;
}
