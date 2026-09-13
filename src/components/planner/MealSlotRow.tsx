import { Feather } from '@expo/vector-icons';
import { PixelRatio, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { PlannerRecipeVisual } from '@/components/planner/PlannerRecipeVisual';
import { Body, Caption, RowTitle } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { MEAL_TYPE_LABEL, type ResolvedSlot } from '@/components/planner/model';
import type { PlannedMealType } from '@/types';

interface Props {
  mealType: PlannedMealType;
  resolved: ResolvedSlot | null;
  /** Opens the picker for an empty slot, or the cooking guide for a filled one. */
  onPress: () => void;
  /** Absent on read-only surfaces such as a finished day. */
  onMore?: () => void;
  onLongPress?: () => void;
  lifted?: boolean;
}

/**
 * One meal on one date. A ruled row rather than a card, so a day reads as a
 * short list instead of a stack of tiles, and the meal-type column stays in the
 * same place whether or not anything is scheduled.
 *
 * Status is always written out. "Logged", "Skipped" and "Planned" never rely on
 * colour, which is what keeps the row legible under Grayscale and to a screen
 * reader.
 */
/**
 * The row holds a fixed meal-type column so the dishes line up down a day. Two
 * things break that column, and both end the same way — it goes, and the meal
 * type takes its own line above the dish:
 *
 * - Above this reading size the column stops fitting its own label, and
 *   `Breakfast` breaks across two lines mid-word.
 * - Below this width the column, the thumbnail and the more-actions button
 *   leave the recipe name about eighty points to live in, and a 320 dp phone
 *   showed `Pan-seare / d salmon …`.
 *
 * A recipe name is the thing being read here. It does not get truncated to
 * protect an alignment.
 */
const STACK_ABOVE_FONT_SCALE = 1.3;
const STACK_BELOW_WIDTH = 360;

export function MealSlotRow({ mealType, resolved, onPress, onMore, onLongPress, lifted }: Props) {
  const label = MEAL_TYPE_LABEL[mealType];
  const { width } = useWindowDimensions();
  const stacked = PixelRatio.getFontScale() > STACK_ABOVE_FONT_SCALE || width < STACK_BELOW_WIDTH;

  if (!resolved) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Choose ${label.toLowerCase()}`}
        style={({ pressed }) => [
          styles.row,
          styles.empty,
          stacked && styles.rowStacked,
          pressed && { opacity: opacity.pressed },
        ]}
      >
        <View style={stacked ? undefined : styles.slotColumn}>
          <Caption muted>{label}</Caption>
        </View>
        <View style={styles.body}>
          <Body style={styles.chooseText}>Choose {label.toLowerCase()}</Body>
        </View>
        <Feather name="plus" size={20} color={color.action} />
      </Pressable>
    );
  }

  const { slot, snapshot, batch, shared } = resolved;
  const statusText = slot.status === 'logged' ? 'Logged'
    : slot.status === 'skipped' ? 'Skipped'
      : 'Planned';
  const portionText = `${formatPortions(slot.eatenPortions)} portion${slot.eatenPortions === 1 ? '' : 's'}`;
  const batchText = shared
    ? `From a batch of ${formatPortions(batch.producedPortions)}`
    : batch.producedPortions > slot.eatenPortions
      ? `Batch makes ${formatPortions(batch.producedPortions)}`
      : null;

  return (
    <View style={[styles.row, stacked && styles.rowStacked, lifted && styles.lifted]}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${snapshot.title}. ${statusText}. ${portionText}.`}
        accessibilityHint="Opens the cooking guide"
        style={({ pressed }) => [
          styles.main,
          stacked && styles.mainStacked,
          pressed && { opacity: opacity.pressed },
        ]}
      >
        <View style={stacked ? undefined : styles.slotColumn}>
          <Caption muted>{label}</Caption>
        </View>
        <PlannerRecipeVisual snapshot={snapshot} size="md" alt="" />
        <View style={styles.body}>
          <RowTitle numberOfLines={stacked ? undefined : 2}>{snapshot.title}</RowTitle>
          <Caption muted>
            {statusText} · {portionText}
            {batchText ? ` · ${batchText}` : ''}
          </Caption>
        </View>
      </Pressable>
      {onMore ? (
        <Pressable
          onPress={onMore}
          accessibilityRole="button"
          accessibilityLabel={`More actions for ${label.toLowerCase()}, ${snapshot.title}`}
          hitSlop={space.sm}
          style={({ pressed }) => [styles.more, pressed && { opacity: opacity.pressed }]}
        >
          <Feather name="more-horizontal" size={20} color={color.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function formatPortions(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.minRowHeight,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
    gap: space.md,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  empty: { paddingVertical: space.md, paddingRight: space.xs },
  lifted: {
    backgroundColor: color.raised,
    borderRadius: radius.card,
    borderBottomColor: 'transparent',
  },
  slotColumn: { width: 74 },
  // Large text: nothing is width-constrained, and the meal type takes its own
  // line above the dish rather than a column too narrow to hold its own name.
  rowStacked: { alignItems: 'flex-start' },
  mainStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: space.sm },
  body: { flex: 1, gap: space.xs },
  chooseText: { color: color.action },
  more: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
