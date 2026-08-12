import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Caption } from '@/components/Type';
import { color, duration, macroColor, space } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface Props {
  label: string;
  onDark?: boolean;
}

/**
 * The three dots identify active food analysis, not the Mise logo. The text
 * label and busy semantics carry the meaning when colour or motion is absent.
 */
export function ProcessingIndicator({ label, onDark = false }: Props) {
  const reduceMotion = useReducedMotion();
  const values = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  useEffect(() => {
    if (reduceMotion) {
      values.forEach((value) => value.setValue(1));
      return;
    }

    const animation = Animated.loop(
      Animated.stagger(
        duration.quick / values.length,
        values.map((value) =>
          Animated.sequence([
            Animated.timing(value, {
              toValue: 0.45,
              duration: duration.quick,
              useNativeDriver: true,
            }),
            Animated.timing(value, {
              toValue: 1,
              duration: duration.quick,
              useNativeDriver: true,
            }),
          ]),
        ),
      ),
    );
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, values]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      style={styles.root}
    >
      <View importantForAccessibility="no-hide-descendants" style={styles.dots}>
        {values.map((value, index) => (
          <Animated.View
            key={dotColors[index]}
            style={[
              styles.dot,
              {
                backgroundColor: dotColors[index],
                opacity: value,
                transform: [{ scale: value }],
              },
            ]}
          />
        ))}
      </View>
      <Caption style={onDark ? styles.light : undefined}>{label}</Caption>
    </View>
  );
}

const dotColors = [macroColor.protein, macroColor.carbs, macroColor.fat] as const;

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: space.md },
  dots: { flexDirection: 'row', gap: space.sm },
  dot: { width: space.md, height: space.md, borderRadius: space.md },
  light: { color: color.surface },
});
