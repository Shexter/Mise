import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { Body, Caption, RowTitle } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import type { PlannerView } from '@/logic/todayRoute';

interface Props {
  view: PlannerView;
  onChange: (view: PlannerView) => void;
}

const OPTIONS: readonly { value: PlannerView; label: string; detail: string }[] = [
  { value: 'day', label: 'Day', detail: 'One day at a time, with what is next.' },
  { value: 'week', label: 'Week', detail: 'The whole week, for planning and moving meals.' },
];

/**
 * Day or Week, as one compact control rather than a second segmented switch.
 *
 * Today already carries a segmented control for its two tasks. Stacking another
 * one under it would put two rows of tabs above the plan and leave the reader
 * working out which of them they just changed. This states the current view and
 * opens a short menu, so the page has one obvious tab bar and one quiet setting.
 */
export function PlanViewControl({ view, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const current = OPTIONS.find((option) => option.value === view) ?? OPTIONS[0]!;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Plan view: ${current.label}`}
        accessibilityHint="Switches between the day and the week"
        style={({ pressed }) => [styles.control, pressed && { opacity: opacity.pressed }]}
      >
        <RowTitle>{current.label}</RowTitle>
        <Feather name="chevron-down" size={16} color={color.ink} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Plan view">
        <View style={styles.options}>
          {OPTIONS.map((option) => {
            const selected = option.value === view;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setOpen(false);
                  onChange(option.value);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={option.label}
                accessibilityHint={option.detail}
                style={({ pressed }) => [styles.option, pressed && { opacity: opacity.pressed }]}
              >
                <View style={styles.optionText}>
                  <Body>{option.label}</Body>
                  <Caption muted>{option.detail}</Caption>
                </View>
                {selected ? <Feather name="check" size={20} color={color.action} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    backgroundColor: color.surface,
  },
  options: { paddingBottom: space.base },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: layout.minRowHeight,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.line,
  },
  optionText: { flex: 1, gap: space.xs },
});
