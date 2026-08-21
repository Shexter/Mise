import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Segmented } from '@/components/Choice';
import { Field } from '@/components/Field';
import { SnappedScroller, type ScrollerItem } from '@/components/onboarding/SnappedScroller';
import { Caption, MealCalories, SectionLabel } from '@/components/Type';
import { space } from '@/constants/theme';
import {
  adjustMeasurement,
  anchorMeasurement,
  cmToIn,
  confirmMeasurement,
  inToCm,
  kgToLb,
  lbToKg,
  parseDecimalString,
  seedMeasurement,
  snapToNearest,
  type ConfirmableMeasurement,
} from '@/logic/measurements';
import type { NumericRange } from '@/logic/onboardingDomain';
import type { Units } from '@/types';

export type MeasurementKind = 'height' | 'weight' | 'percentage';

interface Props {
  /** The canonical metric value already answered, or null for a fresh control. */
  value: number | null;
  /** Where a fresh control points. Never itself an answer. */
  anchor: number;
  /** Canonical metric bounds. */
  range: NumericRange;
  kind: MeasurementKind;
  unit: Units;
  /** Announced as the control's name, e.g. "Weight". */
  label: string;
  /** How an existing `value` arrived, which decides whether it counts as answered. */
  origin?: 'saved' | 'extracted';
  /**
   * Body fat only: a typed number outside `range` is reported rather than
   * refused, so the caller can apply the existing warn-and-confirm policy
   * instead of this control inventing a replacement.
   */
  allowOutOfRange?: boolean;
  onConfirm: (canonical: number, outOfRange: boolean) => void;
  onUnitChange?: (unit: Units) => void;
}

const UNIT_LABELS: Record<MeasurementKind, { metric: string; imperial: string }> = {
  height: { metric: 'cm', imperial: 'in' },
  weight: { metric: 'kg', imperial: 'lb' },
  percentage: { metric: '%', imperial: '%' },
};

const SPOKEN_UNITS: Record<MeasurementKind, { metric: string; imperial: string }> = {
  height: { metric: 'centimetres', imperial: 'inches' },
  weight: { metric: 'kilograms', imperial: 'pounds' },
  percentage: { metric: 'percent', imperial: 'percent' },
};

/** Tick spacing per unit — fine enough to be useful, coarse enough to scroll. */
function stepFor(kind: MeasurementKind, unit: Units): number {
  if (kind === 'percentage') return 0.5;
  if (kind === 'height') return 1;
  return unit === 'metric' ? 0.5 : 1;
}

/** One canonical metric value in, one display number out. Never the reverse chain. */
function toDisplay(canonical: number, kind: MeasurementKind, unit: Units): number {
  if (kind === 'percentage' || unit === 'metric') return canonical;
  return kind === 'weight' ? kgToLb(canonical) : cmToIn(canonical);
}

function toCanonical(display: number, kind: MeasurementKind, unit: Units): number {
  if (kind === 'percentage' || unit === 'metric') return display;
  return kind === 'weight' ? lbToKg(display) : inToCm(display);
}

function formatDisplay(display: number, kind: MeasurementKind, unit: Units): string {
  if (kind === 'height' && unit === 'imperial') {
    const feet = Math.floor(display / 12);
    return `${feet}′ ${Math.round(display - feet * 12)}″`;
  }
  const text = display.toFixed(kind === 'height' ? 0 : 1);
  return text.endsWith('.0') ? text.slice(0, -2) : text;
}

/**
 * A unit-aware numeric control with three ways in — scroll, the accessibility
 * increment/decrement actions, or typing — over one canonical metric value.
 *
 * The anchor is the important part. A fresh control points somewhere sensible
 * so nobody scrolls from 30 kg, but that position is not an answer and says so
 * out loud: `onConfirm` does not fire, and the caller's Continue stays
 * disabled, until the person moves the control or taps "Use this".
 */
export function MeasurementPicker({
  value,
  anchor,
  range,
  kind,
  unit,
  label,
  origin = 'saved',
  allowOutOfRange = false,
  onConfirm,
  onUnitChange,
}: Props) {
  const [state, setState] = useState<ConfirmableMeasurement>(() =>
    value === null ? anchorMeasurement(anchor) : seedMeasurement(value, origin),
  );
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState<string | null>(null);

  const step = stepFor(kind, unit);
  const units = UNIT_LABELS[kind][unit];
  const spokenUnit = SPOKEN_UNITS[kind][unit];

  const displayRange = useMemo(() => {
    const low = toDisplay(range.min, kind, unit);
    const high = toDisplay(range.max, kind, unit);
    return { min: snapToNearest(low, step), max: snapToNearest(high, step) };
  }, [kind, range.max, range.min, step, unit]);

  const ticks = useMemo<ScrollerItem[]>(() => {
    const out: ScrollerItem[] = [];
    for (let v = displayRange.min; v <= displayRange.max + step / 2; v += step) {
      const display = snapToNearest(v, step);
      out.push({
        key: String(display),
        label: formatDisplay(display, kind, unit),
        spoken: `${formatDisplay(display, kind, unit)} ${spokenUnit}`,
      });
    }
    return out;
  }, [displayRange.max, displayRange.min, kind, spokenUnit, step, unit]);

  const positionDisplay = snapToNearest(toDisplay(state.position, kind, unit), step);
  const selectedIndex = Math.max(
    0,
    Math.min(ticks.length - 1, Math.round((positionDisplay - displayRange.min) / step)),
  );

  const answered = state.confirmed && state.value !== null;

  const settle = (next: ConfirmableMeasurement, outOfRange = false) => {
    setState(next);
    setTypedError(null);
    if (next.confirmed && next.value !== null) onConfirm(next.value, outOfRange);
  };

  const selectIndex = (index: number) => {
    const display = snapToNearest(displayRange.min + index * step, step);
    settle(adjustMeasurement(state, toCanonical(display, kind, unit)));
  };

  const submitTyped = () => {
    const displayBounds = {
      min: toDisplay(range.min, kind, unit),
      max: toDisplay(range.max, kind, unit),
    };
    const parsed = parseDecimalString(typed, displayBounds);
    if (parsed.ok) {
      settle(adjustMeasurement(state, toCanonical(parsed.value, kind, unit)));
      setTyped('');
      return;
    }
    if (parsed.reason === 'out-of-range' && allowOutOfRange) {
      // Reported, not clamped: the caller decides whether to warn and confirm.
      const raw = Number(typed.trim().replace(',', '.'));
      settle(adjustMeasurement(state, toCanonical(raw, kind, unit)), true);
      setTyped('');
      return;
    }
    setTypedError(
      parsed.reason === 'out-of-range'
        ? `Enter a value between ${formatDisplay(displayBounds.min, kind, unit)} and ${formatDisplay(displayBounds.max, kind, unit)} ${units}.`
        : 'Enter a number.',
    );
  };

  return (
    <View style={styles.root}>
      {kind !== 'percentage' && onUnitChange ? (
        <Segmented
          options={[
            { value: 'metric' as Units, label: UNIT_LABELS[kind].metric },
            { value: 'imperial' as Units, label: UNIT_LABELS[kind].imperial },
          ]}
          value={unit}
          onChange={onUnitChange}
        />
      ) : null}

      <View style={styles.readout}>
        <MealCalories>{formatDisplay(positionDisplay, kind, unit)}</MealCalories>
        <SectionLabel muted>{units}</SectionLabel>
      </View>

      {answered ? (
        <Caption muted>{state.origin === 'saved' ? 'Your saved value.' : 'Confirmed.'}</Caption>
      ) : (
        <Caption muted>Not set yet — scroll, type, or tap to confirm this starting point.</Caption>
      )}

      <SnappedScroller
        items={ticks}
        selectedIndex={selectedIndex}
        onSelectIndex={selectIndex}
        label={label}
        rangeHint={`${formatDisplay(displayRange.min, kind, unit)} to ${formatDisplay(displayRange.max, kind, unit)} ${spokenUnit}`}
      />

      {answered ? null : (
        <Button
          label={`Use ${formatDisplay(positionDisplay, kind, unit)} ${units}`}
          variant="secondary"
          onPress={() => settle(confirmMeasurement(state))}
        />
      )}

      <Field
        label={`Or type it in (${units})`}
        value={typed}
        onChangeText={setTyped}
        keyboardType="decimal-pad"
        placeholder={formatDisplay(positionDisplay, kind, unit)}
        suffix={units}
        numeric
        maxLength={6}
        onSubmitEditing={submitTyped}
        error={typedError ?? undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.base },
  readout: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
});
