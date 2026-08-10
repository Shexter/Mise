import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Caption, RowTitle } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import {
  addWeeks,
  dayOfMonth,
  friendlyDate,
  isFuture,
  localDateString,
  weekOf,
  weekdayInitial,
} from '@/logic/dates';

interface Props {
  selectedDate: string;
  loggedDates: ReadonlySet<string>;
  earliestLoggedDate: string | null;
  onSelect: (localDate: string) => void;
}

/** A Monday-first week with swipe and button paging. */
export function DateStrip({
  selectedDate,
  loggedDates,
  earliestLoggedDate,
  onSelect,
}: Props) {
  const [weekDate, setWeekDate] = useState(selectedDate);
  const today = localDateString();
  const currentWeekStart = weekOf(today)[0]!;
  const displayedWeekStart = weekOf(weekDate)[0]!;
  const earliestWeekStart = earliestLoggedDate ? weekOf(earliestLoggedDate)[0]! : null;
  const canGoBack = earliestWeekStart !== null && displayedWeekStart > earliestWeekStart;
  const canGoForward = displayedWeekStart < currentWeekStart;

  useEffect(() => setWeekDate(selectedDate), [selectedDate]);

  const page = (amount: -1 | 1) => {
    if ((amount < 0 && !canGoBack) || (amount > 0 && !canGoForward)) return;
    void Haptics.selectionAsync();
    setWeekDate((current) => addWeeks(current, amount));
  };

  const pan = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > space.base && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > layout.minTouchTarget) page(-1);
        else if (gesture.dx < -layout.minTouchTarget) page(1);
      },
    }),
    [canGoBack, canGoForward],
  );

  const dates = weekOf(weekDate);
  const awayFromToday = displayedWeekStart !== currentWeekStart;

  return (
    <View style={styles.root}>
      <View style={styles.paging}>
        <PageButton direction="left" disabled={!canGoBack} onPress={() => page(-1)} />
        {awayFromToday ? (
          <Button
            label="Today"
            variant="ghost"
            block={false}
            onPress={() => onSelect(today)}
          />
        ) : <View />}
        <PageButton direction="right" disabled={!canGoForward} onPress={() => page(1)} />
      </View>
      <View style={styles.strip} {...pan.panHandlers}>
        {dates.map((date) => {
          const selected = date === selectedDate;
          const future = isFuture(date);
          const logged = loggedDates.has(date);

          return (
            <Pressable
              key={date}
              disabled={future}
              onPress={() => {
                void Haptics.selectionAsync();
                onSelect(date);
              }}
              accessibilityRole="button"
              accessibilityLabel={friendlyDate(date)}
              accessibilityState={{ selected, disabled: future }}
              style={({ pressed }) => [
                styles.day,
                selected && styles.daySelected,
                future && { opacity: opacity.disabled },
                pressed && !future && { opacity: opacity.pressed },
              ]}
            >
              <Caption muted={!selected}>{weekdayInitial(date)}</Caption>
              <RowTitle numeric style={selected ? styles.selectedText : undefined}>
                {dayOfMonth(date)}
              </RowTitle>
              <View
                style={[
                  styles.dot,
                  logged && !selected && styles.dotOn,
                  logged && selected && styles.dotOnSelected,
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function PageButton({
  direction,
  disabled,
  onPress,
}: {
  direction: 'left' | 'right';
  disabled: boolean;
  onPress: () => void;
}) {
  const label = direction === 'left' ? 'Previous week' : 'Next week';
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.pageButton,
        disabled && { opacity: opacity.disabled },
        pressed && !disabled && { opacity: opacity.pressed },
      ]}
    >
      <Feather name={`chevron-${direction}`} size={20} color={color.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.xs },
  paging: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.xs,
  },
  day: {
    width: layout.minTouchTarget,
    minHeight: layout.minTouchTarget + space.base,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
  },
  daySelected: { backgroundColor: color.ink },
  selectedText: { color: color.surface },
  dot: { width: 4, height: 4, borderRadius: radius.full },
  dotOn: { backgroundColor: color.olive },
  dotOnSelected: { backgroundColor: color.surface },
});
