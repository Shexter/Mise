import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Caption, RowTitle } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  detail?: string;
}

interface ListProps<T extends string> {
  options: readonly ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  style?: ViewStyle;
}

/** A stacked list of options — one per row. Used throughout onboarding. */
export function ChoiceList<T extends string>({
  options,
  value,
  onChange,
  style,
}: ListProps<T>) {
  return (
    <View style={[styles.list, style]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(option.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            accessibilityHint={option.detail}
            style={({ pressed }) => [
              styles.row,
              selected && styles.rowSelected,
              pressed && { opacity: opacity.pressed },
            ]}
          >
            <View style={styles.rowText}>
              <RowTitle>{option.label}</RowTitle>
              {option.detail ? (
                <Caption muted style={styles.detail}>
                  {option.detail}
                </Caption>
              ) : null}
            </View>
            <View style={[styles.mark, selected && styles.markSelected]} />
          </Pressable>
        );
      })}
    </View>
  );
}

interface SegmentedProps<T extends string> {
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
}

/** A horizontal set of short options — meal type, unit toggles. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: SegmentedProps<T>) {
  return (
    <View style={[styles.segmented, style]} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(option.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              pressed && { opacity: opacity.pressed },
            ]}
          >
            <Caption style={selected ? styles.segmentTextOn : undefined} muted={!selected}>
              {option.label}
            </Caption>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  row: {
    minHeight: layout.minRowHeight,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowSelected: { borderColor: color.ink },
  rowText: { flex: 1 },
  detail: { marginTop: space.xs },
  mark: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.line,
    marginLeft: space.base,
  },
  markSelected: {
    backgroundColor: color.ink,
    borderColor: color.ink,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.xs,
    gap: space.xs,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.input - 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  segmentSelected: { backgroundColor: color.ground },
  segmentTextOn: { color: color.ink },
});
