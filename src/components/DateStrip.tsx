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
  isToday,
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

/** A Monday-first week with integrated side chevrons and swipe paging. */
export function DateStrip({
  selectedDate,
  loggedDates,
  onSelect,
}: Props) {
  const [weekDate, setWeekDate] = useState(selectedDate);
  const today = localDateString();
  const currentWeekStart = weekOf(today)[0]!;
  const displayedWeekStart = weekOf(weekDate)[0]!;
  
  // Users can always navigate back to past weeks; can't go past today's week
  const canGoBack = true;
  const canGoForward = displayedWeekStart < currentWeekStart;

  useEffect(() => setWeekDate(selectedDate), [selectedDate]);

  const page = (amount: -1 | 1) => {
    if (amount > 0 && !canGoForward) return;
    void Haptics.selectionAsync();
    const nextWeekDate = addWeeks(weekDate, amount);
    setWeekDate(nextWeekDate);
    // Move selectedDate to corresponding day in next week (or today if future)
    const nextSelected = addWeeks(selectedDate, amount);
    if (!isFuture(nextSelected)) {
      onSelect(nextSelected);
    } else {
      onSelect(today);
    }
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > space.base && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > layout.minTouchTarget) page(-1);
          else if (gesture.dx < -layout.minTouchTarget) page(1);
        },
      }),
    [weekDate, selectedDate, canGoForward],
  );

  const dates = weekOf(weekDate);
  const awayFromToday = displayedWeekStart !== currentWeekStart || !isToday(selectedDate);

  return (
    <View style={styles.root}>
      {awayFromToday ? (
        <View style={styles.topBar}>
          <Button
            label="Today"
            variant="ghost"
            block={false}
            onPress={() => {
              void Haptics.selectionAsync();
              onSelect(today);
              setWeekDate(today);
            }}
          />
        </View>
      ) : null}

      <View style={styles.rowWrapper}>
        <PageButton direction="left" disabled={!canGoBack} onPress={() => page(-1)} />

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

        <PageButton direction="right" disabled={!canGoForward} onPress={() => page(1)} />
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
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      style={({ pressed }) => [
        styles.pageButton,
        disabled && { opacity: opacity.disabled },
        pressed && !disabled && { opacity: opacity.pressed },
      ]}
    >
      <Feather name={`chevron-${direction}`} size={22} color={color.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.xs },
  topBar: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  rowWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  pageButton: {
    width: 32,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strip: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    flex: 1,
    maxWidth: 44,
    minHeight: layout.minTouchTarget + space.base,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
  },
  daySelected: { backgroundColor: color.action },
  selectedText: { color: color.onAction },
  dot: { width: 4, height: 4, borderRadius: radius.full },
  dotOn: { backgroundColor: color.olive },
  dotOnSelected: { backgroundColor: color.onAction },
});
