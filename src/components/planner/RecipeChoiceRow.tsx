import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { PlannerRecipeVisual } from '@/components/planner/PlannerRecipeVisual';
import { Caption, RowTitle } from '@/components/Type';
import { color, layout, opacity, space } from '@/constants/theme';
import type { PlannerRecipeVisualSource } from '@/media/plannerRecipeVisuals';

/** Thumbnail edge. Substantial enough to be looked at, not a decorative dot. */
const THUMBNAIL = 96;

interface Props {
  title: string;
  /** Factual metadata only: time, yield, cuisine. Never a claimed ranking. */
  meta: string;
  /** e.g. `Preview for lunch`. Names the action, not the outcome. */
  actionLabel: string;
  onPress: () => void;
  visual: PlannerRecipeVisualSource;
  /** One quiet line under the metadata, for a saved recipe's review notice. */
  note?: string;
}

/**
 * One recipe as the chooser offers it.
 *
 * The action is labelled `Preview`, never `Add`. The concept's direct add
 * button would schedule a meal before portions, dietary exclusions, required
 * equipment and an occupied slot had been reviewed, and every one of those
 * checks lives on the preview screen.
 *
 * The title has no line cap. A long recipe name wraps and pushes the action
 * down rather than being cropped to fit a fixed row height — the name is the
 * thing being chosen between.
 */
export function RecipeChoiceRow({ title, meta, actionLabel, onPress, visual, note }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={`${meta}. Opens a preview before scheduling.`}
      style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}
    >
      <PlannerRecipeVisual source={visual} size={THUMBNAIL} alt="" style={styles.thumbnail} />
      <View style={styles.text}>
        <RowTitle>{title}</RowTitle>
        <Caption muted>{meta}</Caption>
        {note ? <Caption muted>{note}</Caption> : null}
        <Button label={actionLabel} variant="secondary" onPress={onPress} style={styles.action} />
      </View>
    </Pressable>
  );
}

/** The metadata line, assembled from facts the recipe actually records. */
export function recipeMetaLine(parts: readonly (string | number | null | undefined)[]): string {
  return parts.filter((part) => part !== null && part !== undefined && part !== '').join(' · ');
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.base,
    paddingVertical: space.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.line,
  },
  thumbnail: { flexShrink: 0 },
  // The action sits under the metadata inside the text column, so a narrow
  // screen stacks it rather than squeezing the name to make room beside it.
  text: { flex: 1, gap: space.xs, minHeight: layout.minTouchTarget },
  action: { marginTop: space.sm },
});
