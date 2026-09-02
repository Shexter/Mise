import { Feather } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Caption, MealCalories, RowTitle } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { capitalise, dayPart, timeOfDay } from '@/logic/dates';

const DAY_PART_ICON = {
  morning: 'sunrise',
  midday: 'sun',
  evening: 'sunset',
  night: 'moon',
} as const satisfies Record<ReturnType<typeof dayPart>, keyof typeof Feather.glyphMap>;
import { macrosOfItems, roundCalories } from '@/logic/scaling';
import type { MealWithItems } from '@/types';

interface Props {
  meal: MealWithItems;
  onPress?: (mealId: string) => void;
  onDelete: (mealId: string) => void;
}

export function MealRow({ meal, onPress, onDelete }: Props) {
  const calories = roundCalories(macrosOfItems(meal.items).calories);
  const calorieLabel = calories === null ? 'Nutrition unavailable' : `${calories} calories`;

  return (
    <Swipeable
      friction={2}
      rightThreshold={48}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          onPress={() => onDelete(meal.id)}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${meal.name}`}
          style={({ pressed }) => [
            styles.deleteAction,
            pressed && { opacity: opacity.pressed },
          ]}
        >
          <Caption style={styles.deleteLabel}>Delete</Caption>
        </Pressable>
      )}
    >
      <Pressable
        onPress={() => onPress?.(meal.id)}
        accessibilityRole="button"
        accessibilityLabel={`${meal.name}, ${calorieLabel}, ${capitalise(
          meal.mealType,
        )} at ${timeOfDay(meal.loggedAt)}`}
        accessibilityHint="Double tap to edit meal details. Swipe left to delete."
        style={({ pressed }) => [
          styles.row,
          pressed && { opacity: opacity.pressed },
        ]}
      >
        {meal.photoUri ? (
          <Image source={{ uri: meal.photoUri }} style={styles.thumb} />
        ) : (
          // No photo is not a hole in the row: the hour the meal was eaten is
          // the next most useful thing to show in the same space.
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <Feather
              name={DAY_PART_ICON[dayPart(meal.loggedAt)]}
              size={20}
              color={color.paprika}
            />
          </View>
        )}

        <View style={styles.text}>
          <Caption style={styles.time} numeric>
            {timeOfDay(meal.loggedAt)}
          </Caption>
          <RowTitle numberOfLines={1}>{meal.name}</RowTitle>
          <Caption muted numberOfLines={1}>
            {capitalise(meal.mealType)}
          </Caption>
        </View>

        <MealCalories numeric>{calories === null ? '—' : calories}</MealCalories>
        <Feather name="chevron-right" size={16} color={color.muted} />
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.minRowHeight,
    backgroundColor: color.surface,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.input,
    backgroundColor: color.ground,
  },
  thumbEmpty: {
    backgroundColor: color.tintPaprika,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: { color: color.paprika },
  text: { flex: 1, gap: space.xs },
  deleteAction: {
    width: 88,
    backgroundColor: color.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLabel: { color: color.paprika },
});
