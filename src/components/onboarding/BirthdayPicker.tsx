// @react-native-community/datetimepicker resolved by Expo to 8.4.4.
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { SnappedScroller, type ScrollerItem } from '@/components/onboarding/SnappedScroller';
import { Caption, SectionLabel } from '@/components/Type';
import { space } from '@/constants/theme';
import {
  computeAge,
  daysInMonth,
  isValidCalendarDate,
  supportedBirthdayRange,
  todayCalendarDate,
  validateAge,
  type CalendarDate,
} from '@/logic/age';
import { AGE_RANGE } from '@/logic/onboardingDomain';

interface Props {
  /** Emitted only on the explicit confirm action, and only ever the age. */
  onConfirm: (age: number) => void;
  /**
   * Live selection, for a caller that owns the confirming action itself —
   * the onboarding step, whose own Continue button should light up the
   * moment a supported date is on the dials rather than waiting for a
   * second tap in here. An unsupported date reports null, not a clamp.
   * Like `onConfirm`, it emits an age and never a date.
   */
  onAgeChange?: (age: number | null) => void;
  /** Hidden when the caller confirms with a button of its own. */
  showConfirm?: boolean;
  onCancel?: () => void;
  /** Overridable for tests; defaults to the device's local calendar date. */
  today?: CalendarDate;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/**
 * Year, month, and day selection that yields an age and nothing else.
 *
 * The birth date lives in this component's state and leaves it only as an
 * integer: both `onConfirm` and `onAgeChange` take an age. Scrolling past an
 * unsupported date never becomes an answer — it is explained and refused
 * rather than silently replaced — and an untouched picker emits nothing at
 * all, so its anchor never passes for a choice.
 *
 * The platform picker dependency is pinned for the eventual native adapter;
 * these accessible columns preserve the explicit age-only confirmation contract.
 */
export function BirthdayPicker({
  onConfirm,
  onAgeChange,
  showConfirm = true,
  onCancel,
  today = todayCalendarDate(),
}: Props) {
  const bounds = useMemo(() => supportedBirthdayRange(today), [today]);
  const [year, setYear] = useState(bounds.latest.year);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [touched, setTouched] = useState(false);

  const years = useMemo<ScrollerItem[]>(() => {
    const out: ScrollerItem[] = [];
    for (let value = bounds.earliest.year; value <= bounds.latest.year; value += 1) {
      out.push({ key: String(value), label: String(value) });
    }
    return out;
  }, [bounds.earliest.year, bounds.latest.year]);

  const months = useMemo<ScrollerItem[]>(
    () => MONTH_NAMES.map((name, index) => ({
      key: String(index + 1),
      label: name.slice(0, 3),
      spoken: name,
    })),
    [],
  );

  /** Shortens with the month, so February never offers a 31st. */
  const days = useMemo<ScrollerItem[]>(() => {
    const out: ScrollerItem[] = [];
    for (let value = 1; value <= daysInMonth(year, month); value += 1) {
      out.push({ key: String(value), label: String(value) });
    }
    return out;
  }, [month, year]);

  const clampedDay = Math.min(day, daysInMonth(year, month));
  const birthday: CalendarDate = { year, month, day: clampedDay };
  const age = computeAge(year, month, clampedDay, today);
  const valid = isValidCalendarDate(birthday) && validateAge(age);

  // Silent until the dials are touched: an untouched picker is showing its
  // anchor, not an answer, and reporting that would overwrite a value the
  // caller already holds.
  useEffect(() => {
    if (!touched) return;
    onAgeChange?.(valid ? age : null);
  }, [age, onAgeChange, touched, valid]);

  return (
    <View style={styles.root}>
      <View style={styles.columns}>
        <Column label="Year">
          <SnappedScroller
            items={years}
            selectedIndex={Math.max(0, years.findIndex((item) => item.key === String(year)))}
            onSelectIndex={(index) => {
              setTouched(true);
              setYear(Number(years[index]!.key));
            }}
            label="Birth year"
            orientation="vertical"
          />
        </Column>
        <Column label="Month">
          <SnappedScroller
            items={months}
            selectedIndex={month - 1}
            onSelectIndex={(index) => {
              setTouched(true);
              setMonth(index + 1);
            }}
            label="Birth month"
            orientation="vertical"
          />
        </Column>
        <Column label="Day">
          <SnappedScroller
            items={days}
            selectedIndex={clampedDay - 1}
            onSelectIndex={(index) => {
              setTouched(true);
              setDay(index + 1);
            }}
            label="Birth day"
            orientation="vertical"
          />
        </Column>
      </View>

      {touched ? (
        <Caption muted accessibilityLiveRegion="polite">
          {valid
            ? `That makes you ${age}. Mise keeps the ${age}, not the date.`
            : `That date is outside the supported range of ${AGE_RANGE.min} to ${AGE_RANGE.max} years.`}
        </Caption>
      ) : null}

      {showConfirm ? (
        <Button
          label="Confirm"
          disabled={!valid}
          onPress={() => {
            if (valid) onConfirm(age);
          }}
        />
      ) : null}
      {onCancel ? <Button label="Cancel" variant="ghost" onPress={onCancel} /> : null}
    </View>
  );
}

function Column({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.column}>
      <SectionLabel muted>{label}</SectionLabel>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.base },
  columns: { flexDirection: 'row', gap: space.sm },
  column: { flex: 1, gap: space.sm },
});
