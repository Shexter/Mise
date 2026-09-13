import { type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { duration } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { DayTarget } from '@/components/planner/WeekDayRail';

interface Props {
  children: ReactNode;
  /** Absent for an empty slot; only a scheduled meal can be dragged. */
  slotId?: string;
  targets: readonly DayTarget[];
  onHover: (localDate: string | null) => void;
  onDrop: (slotId: string, localDate: string) => void;
  /** Asks the rail to re-measure, because a lift is about to test against it. */
  onLift?: () => void;
  enabled: boolean;
}

const LONG_PRESS_MS = 220;

/**
 * Long-press lift and drag for one scheduled meal.
 *
 * Two rules from the brief are enforced here rather than in the drop handler:
 * hovering a day only marks it — the date never changes just by passing over —
 * and releasing over a day opens the destination sheet so the commit runs
 * through exactly the same validation as tap Move.
 *
 * Under Reduce Motion the row does not lift or travel; the gesture still tracks
 * and the day rail still marks the target, so the feedback survives without the
 * animation. Dragging is never the only way to do any of this: every operation
 * is also on the labelled More menu.
 */
export function DraggableSlot({ children, slotId, targets, onHover, onDrop, onLift, enabled }: Props) {
  const reducedMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const lifted = useSharedValue(0);

  const motionMs = reducedMotion ? duration.reduced : duration.quick;

  const settle = () => {
    translateX.value = withTiming(0, { duration: motionMs });
    translateY.value = withTiming(0, { duration: motionMs });
    lifted.value = withTiming(0, { duration: motionMs });
  };

  // Targets carry window coordinates and a gesture reports window coordinates,
  // so the two are compared directly. Subtracting a parent-relative rail origin
  // from a screen position — which is what this did before — tested the finger
  // against a rectangle that was never where the rail actually was.
  const hitTest = (absoluteX: number, absoluteY: number): string | null => {
    const hit = targets.find((target) =>
      absoluteX >= target.x && absoluteX <= target.x + target.width
      && absoluteY >= target.y && absoluteY <= target.y + target.height);
    return hit?.localDate ?? null;
  };

  const pan = Gesture.Pan()
    .enabled(enabled && slotId !== undefined)
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart(() => {
      lifted.value = reducedMotion ? 1 : withTiming(1, { duration: motionMs });
      if (onLift) runOnJS(onLift)();
    })
    .onUpdate((event) => {
      if (!reducedMotion) {
        translateX.value = event.translationX;
        translateY.value = event.translationY;
      }
      runOnJS(onHover)(hitTest(event.absoluteX, event.absoluteY));
    })
    .onEnd((event) => {
      const target = hitTest(event.absoluteX, event.absoluteY);
      runOnJS(onHover)(null);
      if (target && slotId) runOnJS(onDrop)(slotId, target);
      runOnJS(settle)();
    })
    .onFinalize(() => {
      runOnJS(onHover)(null);
      runOnJS(settle)();
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: reducedMotion ? 1 : 1 + lifted.value * 0.02 },
    ],
    zIndex: lifted.value > 0 ? 2 : 0,
  }));

  if (!enabled || slotId === undefined) return <>{children}</>;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.root, animatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
});
