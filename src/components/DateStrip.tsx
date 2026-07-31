import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Caption, RowTitle } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import {
  dayOfMonth,
  friendlyDate,
  isFuture,
  weekOf,
  weekdayInitial,
} from '@/logic/dates';

interface Props {
  selectedDate: string;
  loggedDates: readonly string[];
  onSelect: (localDate: string) => void;
}

/** A scrollable week. Future dates are visible but not selectable. */
export function DateStrip({ selectedDate, loggedDates, onSelect }: Props) {
  const dates = weekOf(selectedDate);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {dates.map((date) => {
        const selected = date === selectedDate;
        const future = isFuture(date);
        const logged = loggedDates.includes(date);

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { gap: space.sm, paddingVertical: space.xs },
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
