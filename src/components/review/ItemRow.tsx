import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Caption, MealCalories, RowTitle } from '@/components/Type';
import { color, layout, opacity, space } from '@/constants/theme';
import { formatGrams, formatQuantity, roundCalories } from '@/logic/scaling';
import type { MealItem } from '@/types';

interface Props {
  item: MealItem;
  onPress: (item: MealItem) => void;
  onRemove: (id: string) => void;
}

export function ItemRow({ item, onPress, onRemove }: Props) {
  return (
    <Swipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          onPress={() => onRemove(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.name}`}
          style={({ pressed }) => [
            styles.remove,
            pressed && { opacity: opacity.pressed },
          ]}
        >
          <Feather name="trash-2" size={18} color={color.paprika} />
        </Pressable>
      )}
    >
      <Pressable
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${formatQuantity(item.quantity)} ${
          item.unit
        }, ${roundCalories(item.calories)} calories. Edit quantity.`}
        style={({ pressed }) => [
          styles.row,
          pressed && { opacity: opacity.pressed },
        ]}
      >
        <View style={styles.text}>
          <View style={styles.titleRow}>
            <RowTitle numberOfLines={1} style={styles.title}>
              {item.name}
            </RowTitle>
            {item.isManualAddition ? (
              <View style={styles.badge}>
                <Caption muted>added</Caption>
              </View>
            ) : null}
          </View>
          <Caption muted numeric>
            {formatQuantity(item.quantity)} {item.unit} · P{' '}
            {formatGrams(item.proteinG)} · C {formatGrams(item.carbsG)} · F{' '}
            {formatGrams(item.fatG)}
          </Caption>
        </View>
        <MealCalories numeric>{roundCalories(item.calories)}</MealCalories>
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
  text: { flex: 1, gap: space.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flexShrink: 1 },
  badge: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: color.ground,
  },
  remove: {
    width: 72,
    backgroundColor: color.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
