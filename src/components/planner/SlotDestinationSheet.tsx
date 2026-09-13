import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { Body, Caption, SectionLabel } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { friendlyDate, weekdayInitial, dayOfMonth } from '@/logic/dates';
import { MEAL_TYPE_LABEL, MEAL_TYPES } from '@/components/planner/model';
import type { PlannedMealType, PlannerDraft } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  days: readonly string[];
  draft: PlannerDraft;
  /** The slot being moved, so its own square is not shown as a collision. */
  excludeSlotId?: string;
  /** Day the sheet opens on. Defaults to the moving slot's own day. */
  defaultDate?: string;
  onSelect: (localDate: string, mealType: PlannedMealType) => void;
}

/**
 * One focused sheet for "which day, which meal". Used by Move, both Copy modes,
 * and as the second half of a cross-day drag — the drag drops onto a day, then
 * this asks which meal, and both paths commit through the same validation.
 *
 * Occupied destinations are shown as occupied rather than hidden. Choosing one
 * is allowed; it raises the replace confirmation instead of failing silently.
 */
export function SlotDestinationSheet({ visible, onClose, title, days, draft, excludeSlotId, defaultDate, onSelect }: Props) {
  const openOn = () => {
    const own = draft.slots.find((slot) => slot.id === excludeSlotId)?.localDate;
    for (const candidate of [defaultDate, own]) {
      if (candidate && days.includes(candidate)) return candidate;
    }
    return days[0] ?? '';
  };
  const [selectedDate, setSelectedDate] = useState(openOn);

  useEffect(() => {
    if (visible && days.length > 0) setSelectedDate(openOn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, days, defaultDate, excludeSlotId]);

  const occupantFor = (localDate: string, mealType: PlannedMealType) =>
    draft.slots.find((slot) =>
      slot.id !== excludeSlotId && slot.localDate === localDate && slot.mealType === mealType);

  const titleFor = (slotId: string | undefined) => {
    if (!slotId) return null;
    const slot = draft.slots.find((candidate) => candidate.id === slotId);
    const batch = draft.batches.find((candidate) => candidate.id === slot?.batchId);
    return draft.snapshots.find((candidate) => candidate.id === batch?.snapshotId)?.title ?? null;
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <SectionLabel>Day</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
        {days.map((day) => {
          const selected = day === selectedDate;
          return (
            <Pressable
              key={day}
              onPress={() => setSelectedDate(day)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={friendlyDate(day)}
              style={({ pressed }) => [
                styles.day,
                selected && styles.daySelected,
                pressed && { opacity: opacity.pressed },
              ]}
            >
              <Caption muted={!selected} style={selected ? styles.daySelectedText : undefined}>
                {weekdayInitial(day)}
              </Caption>
              <Body numeric style={selected ? styles.daySelectedText : undefined}>
                {dayOfMonth(day)}
              </Body>
            </Pressable>
          );
        })}
      </ScrollView>

      <SectionLabel style={styles.mealsLabel}>{friendlyDate(selectedDate)}</SectionLabel>
      <View>
        {MEAL_TYPES.map((mealType) => {
          const occupant = occupantFor(selectedDate, mealType);
          const occupantTitle = titleFor(occupant?.id);
          return (
            <Pressable
              key={mealType}
              onPress={() => onSelect(selectedDate, mealType)}
              accessibilityRole="button"
              accessibilityLabel={`${MEAL_TYPE_LABEL[mealType]} on ${friendlyDate(selectedDate)}`}
              accessibilityHint={occupantTitle ? `Occupied by ${occupantTitle}. You will be asked to confirm.` : 'Empty'}
              style={({ pressed }) => [styles.meal, pressed && { opacity: opacity.pressed }]}
            >
              <View style={styles.mealText}>
                <Body>{MEAL_TYPE_LABEL[mealType]}</Body>
                <Caption muted>{occupantTitle ? `Occupied — ${occupantTitle}` : 'Empty'}</Caption>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  dayRow: { gap: space.sm, paddingVertical: space.sm, paddingRight: space.base },
  day: {
    minWidth: layout.minTouchTarget,
    minHeight: layout.minTouchTarget + space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  daySelected: { backgroundColor: color.action, borderColor: color.action },
  daySelectedText: { color: color.onAction },
  mealsLabel: { marginTop: space.base },
  meal: {
    minHeight: layout.minRowHeight,
    justifyContent: 'center',
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  mealText: { gap: space.xs },
});
