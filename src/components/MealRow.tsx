import { Image, Pressable, StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Caption, MealCalories, RowTitle } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { capitalise, timeOfDay } from '@/logic/dates';
import { macrosOfItems, roundCalories } from '@/logic/scaling';
import type { MealWithItems } from '@/types';

interface Props {
  meal: MealWithItems;
  onPress?: (mealId: string) => void;
  onDelete: (mealId: string) => void;
}

export function MealRow({ meal, onPress, onDelete }: Props) {
  const calories = roundCalories(macrosOfItems(meal.items).calories);

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
        accessibilityLabel={`${meal.name}, ${calories} calories, ${capitalise(
          meal.mealType,
        )} at ${timeOfDay(meal.loggedAt)}`}
        accessibilityHint="Swipe left to delete"
        style={({ pressed }) => [
          styles.row,
          pressed && { opacity: opacity.pressed },
        ]}
      >
        {meal.photoUri ? (
          <Image source={{ uri: meal.photoUri }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]} />
        )}

        <View style={styles.text}>
          <RowTitle numberOfLines={1}>{meal.name}</RowTitle>
          <Caption muted>
            {capitalise(meal.mealType)} · {timeOfDay(meal.loggedAt)}
          </Caption>
        </View>

        <MealCalories numeric>{calories}</MealCalories>
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
    width: 44,
    height: 44,
    borderRadius: radius.input,
    backgroundColor: color.ground,
  },
  thumbEmpty: { borderWidth: 1, borderColor: color.line },
  text: { flex: 1, gap: space.xs },
  deleteAction: {
    width: 88,
    backgroundColor: color.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLabel: { color: color.paprika },
});
