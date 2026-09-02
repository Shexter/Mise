import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Caption } from '@/components/Type';
import { cardShadowStyle, color, duration, radius, space } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface Props {
  /** Whether there is currently a reason to point at the add button. */
  visible: boolean;
  /** Extra positioning, if a caller needs it. Normally none. */
  style?: ViewStyle;
  children: string;
}

/**
 * A speech bubble above the centre add button.
 *
 * It exists because the `+` is the only navigation position without a text
 * label, and because a day with nothing logged should say what to do about it
 * — rather than the screen carrying a second add button that duplicates the
 * one already in the bar.
 *
 * It is condition-driven, not dismissal-driven: it appears whenever the day is
 * empty and goes as soon as it is not. Nothing is persisted, which is what
 * makes it useful on a Thursday you forgot to log rather than only on the day
 * the app was installed.
 *
 * It flows at the end of the screen's content rather than floating over it.
 * Pinned above the tab bar it covered whatever happened to scroll beneath —
 * on a first run, the "Recent meals" heading. Placed last it points at the
 * button from the closest thing the page has to the button's own space.
 *
 * It is decorative to assistive technology. The button it points at already
 * carries its own label and hint, and a bubble that announced itself would put
 * a second, unfocusable description in the way of reaching that button.
 */
export function NavCoachMark({ visible, style, children }: Props) {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    // Fade only. A bubble that slides draws the eye to the motion rather than
    // to the control, and Reduce Motion has to have somewhere to land anyway.
    shown.value = withTiming(visible ? 1 : 0, {
      duration: reduceMotion ? duration.reduced : duration.quick,
    });
  }, [visible, reduceMotion, shown]);

  const animated = useAnimatedStyle(() => ({ opacity: shown.value }));

  // Kept mounted while hidden so the fade has something to run on, but never
  // intercepting a tap meant for the button underneath it.
  return (
    <Animated.View
      style={[styles.wrap, style, animated]}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <View style={[styles.bubble, cardShadowStyle(2)]}>
        <Caption style={styles.label}>{children}</Caption>
      </View>
      <View style={styles.tail} />
    </Animated.View>
  );
}

const TAIL = 7;

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: space.sm,
  },
  bubble: {
    backgroundColor: color.ink,
    borderRadius: radius.card,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  label: { color: color.ground },
  tail: {
    width: 0,
    height: 0,
    marginTop: -StyleSheet.hairlineWidth,
    borderLeftWidth: TAIL,
    borderRightWidth: TAIL,
    borderTopWidth: TAIL,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: color.ink,
  },
});
