import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { SnappedScroller, type ScrollerItem } from '@/components/onboarding/SnappedScroller';
import { Caption, SectionLabel } from '@/components/Type';
import { space } from '@/constants/theme';
import { daysInMonth, todayCalendarDate, type CalendarDate } from '@/logic/age';

interface Props {
  /** An existing `YYYY-MM-DD`, or null for a fresh field. */
  value: string | null;
  onConfirm: (isoDate: string) => void;
  today?: CalendarDate;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** How far back a report is worth offering. Older than this, type it in. */
const YEARS_BACK = 10;

/**
 * The date printed on a report — which, unlike a birthday, is a real stored
 * value. It is asked for separately from the reading itself so that a scan
 * from two years ago is never silently filed under today.
 *
 * A future date is not selectable: a report cannot have been printed
 * tomorrow, and accepting one would corrupt the ordering of a person's
 * measurement history.
 */
export function MeasurementDateField({ value, onConfirm, today = todayCalendarDate() }: Props) {
  const parsed = parseIso(value);
  const [year, setYear] = useState(parsed?.year ?? today.year);
  const [month, setMonth] = useState(parsed?.month ?? today.month);
  const [day, setDay] = useState(parsed?.day ?? today.day);
  const [touched, setTouched] = useState(false);

  const years = useMemo<ScrollerItem[]>(() => {
    const out: ScrollerItem[] = [];
    for (let candidate = today.year - YEARS_BACK; candidate <= today.year; candidate += 1) {
      out.push({ key: String(candidate), label: String(candidate) });
    }
    return out;
  }, [today.year]);

  const months = useMemo<ScrollerItem[]>(
    () => MONTH_NAMES.map((name, index) => ({
      key: String(index + 1),
      label: name.slice(0, 3),
      spoken: name,
    })),
    [],
  );

  const clampedDay = Math.min(day, daysInMonth(year, month));
  const days = useMemo<ScrollerItem[]>(() => {
    const out: ScrollerItem[] = [];
    for (let candidate = 1; candidate <= daysInMonth(year, month); candidate += 1) {
      out.push({ key: String(candidate), label: String(candidate) });
    }
    return out;
  }, [month, year]);

  const inFuture =
    year > today.year ||
    (year === today.year && (month > today.month || (month === today.month && clampedDay > today.day)));

  return (
    <View style={styles.root}>
      <View style={styles.columns}>
        <Column label="Year">
          <SnappedScroller
            items={years}
            selectedIndex={Math.max(0, years.findIndex((item) => item.key === String(year)))}
            onSelectIndex={(index) => { setTouched(true); setYear(Number(years[index]!.key)); }}
            label="Measurement year"
            orientation="vertical"
          />
        </Column>
        <Column label="Month">
          <SnappedScroller
            items={months}
            selectedIndex={month - 1}
            onSelectIndex={(index) => { setTouched(true); setMonth(index + 1); }}
            label="Measurement month"
            orientation="vertical"
          />
        </Column>
        <Column label="Day">
          <SnappedScroller
            items={days}
            selectedIndex={clampedDay - 1}
            onSelectIndex={(index) => { setTouched(true); setDay(index + 1); }}
            label="Measurement day"
            orientation="vertical"
          />
        </Column>
      </View>

      {inFuture ? (
        <Caption accessibilityLiveRegion="polite">
          That date has not happened yet. Pick the date printed on the report.
        </Caption>
      ) : null}

      <Button
        label={touched || value === null ? 'Use this date' : 'Keep this date'}
        disabled={inFuture}
        onPress={() => onConfirm(toIso({ year, month, day: clampedDay }))}
      />
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

function parseIso(value: string | null): CalendarDate | null {
  if (value === null) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function toIso({ year, month, day }: CalendarDate): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  root: { gap: space.base },
  columns: { flexDirection: 'row', gap: space.sm },
  column: { flex: 1, gap: space.sm },
});
