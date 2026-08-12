import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Sheet } from '@/components/Sheet';
import { Caption, RowTitle } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import {
  addMonths,
  dayOfMonth,
  friendlyDate,
  isFuture,
  localDateString,
  monthLabel,
  monthOf,
  weekdayInitial,
} from '@/logic/dates';
import { roundCalories } from '@/logic/scaling';
import type { DaySummary } from '@/types';

interface Props {
  visible: boolean;
  selectedDate: string;
  earliestLoggedDate: string | null;
  loggedDates: ReadonlySet<string>;
  loadSummaries: (localDate: string) => Promise<DaySummary[]>;
  onSelect: (localDate: string) => void;
  onClose: () => void;
}

export function HistoryCalendarSheet({
  visible,
  selectedDate,
  earliestLoggedDate,
  loggedDates,
  loadSummaries,
  onSelect,
  onClose,
}: Props) {
  const [shownMonth, setShownMonth] = useState(selectedDate);
  const [summaries, setSummaries] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const today = localDateString();

  useEffect(() => {
    if (!visible) return;
    setShownMonth(selectedDate);
  }, [selectedDate, visible]);

  useEffect(() => {
    if (!visible || !earliestLoggedDate) return;
    let active = true;
    setLoading(true);
    void loadSummaries(shownMonth).then((rows) => {
      if (active) {
        setSummaries(rows);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [earliestLoggedDate, loadSummaries, shownMonth, visible]);

  const summariesByDate = useMemo(
    () => new Map(summaries.map((summary) => [summary.localDate, summary])),
    [summaries],
  );
  const shownKey = shownMonth.slice(0, 7);
  const earliestKey = earliestLoggedDate?.slice(0, 7) ?? null;
  const todayKey = today.slice(0, 7);
  const canGoBack = earliestKey !== null && shownKey > earliestKey;
  const canGoForward = shownKey < todayKey;
  const dates = monthOf(shownMonth);

  const choose = (date: string) => {
    if (!earliestLoggedDate || date < earliestLoggedDate || isFuture(date)) return;
    void Haptics.selectionAsync();
    onSelect(date);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Meal history"
      footer={selectedDate !== today ? (
        <Button label="Return to today" onPress={() => choose(today)} />
      ) : undefined}
    >
      {!earliestLoggedDate ? (
        <EmptyState
          title="No meal history yet"
          detail="Logged days will appear here after your first meal."
        />
      ) : (
        <View style={styles.calendar}>
          <View style={styles.monthHeader}>
            <MonthButton direction="left" disabled={!canGoBack} onPress={() => setShownMonth((current) => addMonths(current, -1))} />
            <RowTitle>{monthLabel(shownMonth)}</RowTitle>
            <MonthButton direction="right" disabled={!canGoForward} onPress={() => setShownMonth((current) => addMonths(current, 1))} />
          </View>

          <View style={styles.weekdays}>
            {monthOf('2026-06-01').slice(0, 7).map((date) => (
              <Caption key={date} muted style={styles.weekday}>
                {weekdayInitial(date)}
              </Caption>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color={color.ink} accessibilityLabel="Loading month" />
          ) : (
            <View style={styles.grid}>
              {dates.map((date) => {
                const summary = summariesByDate.get(date);
                const logged = loggedDates.has(date);
                const selected = date === selectedDate;
                const todayDate = date === today;
                const outsideMonth = date.slice(0, 7) !== shownKey;
                const disabled = date < earliestLoggedDate || isFuture(date);
                const over = summary?.calories !== null && summary?.targetCalories !== null && summary !== undefined
                  ? summary.calories > summary.targetCalories!
                  : false;
                const accessibilitySummary = summary
                  ? `, ${summary.calories === null ? 'calories unavailable' : `${roundCalories(summary.calories)} calories`}${
                    summary.calories === null || summary.targetCalories === null
                      ? ''
                      : summary.calories > summary.targetCalories ? ', over target' : ', under target'
                  }`
                  : ', no entries';

                return (
                  <Pressable
                    key={date}
                    disabled={disabled}
                    onPress={() => choose(date)}
                    accessibilityRole="button"
                    accessibilityLabel={`${friendlyDate(date)}${accessibilitySummary}`}
                    accessibilityState={{ selected, disabled }}
                    style={({ pressed }) => [
                      styles.day,
                      todayDate && styles.today,
                      selected && styles.selected,
                      (outsideMonth || disabled) && { opacity: opacity.disabled },
                      pressed && !disabled && { opacity: opacity.pressed },
                    ]}
                  >
                    <RowTitle numeric style={selected ? styles.selectedText : undefined}>
                      {dayOfMonth(date)}
                    </RowTitle>
                    {summary ? (
                      <Caption numeric style={selected ? styles.selectedText : undefined}>
                        {summary.calories === null ? '—' : roundCalories(summary.calories)}
                      </Caption>
                    ) : <View style={styles.totalPlaceholder} />}
                    <View
                      style={[
                        styles.marker,
                        logged && (over ? styles.over : styles.under),
                        logged && summary?.targetCalories === null && styles.uncompared,
                        selected && logged && styles.markerSelected,
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}
    </Sheet>
  );
}

function MonthButton({
  direction,
  disabled,
  onPress,
}: {
  direction: 'left' | 'right';
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={direction === 'left' ? 'Previous month' : 'Next month'}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.monthButton,
        disabled && { opacity: opacity.disabled },
        pressed && !disabled && { opacity: opacity.pressed },
      ]}
    >
      <Feather name={`chevron-${direction}`} size={20} color={color.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  calendar: { gap: space.base },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdays: { flexDirection: 'row' },
  weekday: { width: '14.285714%', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: {
    width: '14.285714%',
    minHeight: layout.minRowHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.input,
    gap: space.xs,
  },
  today: { borderWidth: 1, borderColor: color.action },
  selected: { backgroundColor: color.action },
  selectedText: { color: color.onAction },
  totalPlaceholder: { height: 18 },
  marker: { width: 4, height: 4, borderRadius: radius.full },
  under: { backgroundColor: color.olive },
  over: { backgroundColor: color.paprika },
  uncompared: { backgroundColor: color.muted },
  markerSelected: { backgroundColor: color.onAction },
});
