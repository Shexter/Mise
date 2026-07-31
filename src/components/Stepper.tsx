import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { Body, MealCalories } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { formatQuantity } from '@/logic/scaling';

interface Props {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  /** Rendered beside the value, e.g. "g" or "slice". */
  unit?: string;
  label?: string;
}

/** Quantity control for the review sheet. Fires selection haptics on each tap. */
export function Stepper({
  value,
  onChange,
  step = 0.5,
  min = 0,
  max = 9999,
  unit,
  label = 'Quantity',
}: Props) {
  const apply = (next: number) => {
    const clamped = Math.min(max, Math.max(min, Math.round(next * 100) / 100));
    if (clamped === value) return;
    void Haptics.selectionAsync();
    onChange(clamped);
  };

  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityLabel={label}>
      <Pressable
        onPress={() => apply(value - step)}
        disabled={value <= min}
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        style={({ pressed }) => [
          styles.button,
          pressed && { opacity: opacity.pressed },
          value <= min && { opacity: opacity.disabled },
        ]}
      >
        <Body style={styles.glyph}>−</Body>
      </Pressable>

      <View style={styles.value}>
        <MealCalories numeric>{formatQuantity(value)}</MealCalories>
        {unit ? (
          <Body muted style={styles.unit}>
            {unit}
          </Body>
        ) : null}
      </View>

      <Pressable
        onPress={() => apply(value + step)}
        disabled={value >= max}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        style={({ pressed }) => [
          styles.button,
          pressed && { opacity: opacity.pressed },
          value >= max && { opacity: opacity.disabled },
        ]}
      >
        <Body style={styles.glyph}>+</Body>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.base,
  },
  button: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 20, lineHeight: 24 },
  value: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: space.sm,
  },
  unit: {},
});
