import type { ReactNode } from 'react';
import { useCallback, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { DisplayLarge } from '@/components/Type';
import { color, duration, fillParent, layout, radius, space, swipeTokens } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Rendered pinned below the scroll area. */
  footer?: ReactNode;
  /**
   * Opt in to a sheet that rests at half the window height and drags up to
   * nearly full. Off by default — every other sheet in the app opens at its
   * content height and has no second resting place to go to.
   */
  detents?: boolean;
}

/** The two resting heights, as a fraction of the window. */
const COLLAPSED = 0.5;
const EXPANDED = 0.9;
/** How far a release velocity is allowed to carry the sheet when snapping. */
const VELOCITY_PROJECTION_SECONDS = 0.1;

/** A bottom sheet. Tapping the scrim closes it; the header carries a Close. */
export function Sheet({ visible, onClose, title, children, footer, detents = false }: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const collapsed = windowHeight * COLLAPSED;
  const expanded = windowHeight * EXPANDED;

  const height = useSharedValue(collapsed);
  const start = useSharedValue(collapsed);

  /** Every open starts at the lower detent, however the last one was left. */
  useEffect(() => {
    if (visible) height.value = collapsed;
  }, [collapsed, height, visible]);

  /** Runs on the JS thread; the drag itself never leaves the UI thread. */
  const settle = useCallback(
    (to: number) => {
      height.value = reduceMotion
        ? withTiming(to, { duration: duration.reduced })
        : withSpring(to, {
            stiffness: swipeTokens.motion.springStiffness,
            damping: swipeTokens.motion.springDamping,
            overshootClamping: true,
          });
    },
    [height, reduceMotion],
  );

  const toggle = useCallback(() => {
    settle(height.value > (collapsed + expanded) / 2 ? collapsed : expanded);
  }, [collapsed, expanded, height, settle]);

  const drag = Gesture.Pan()
    .enabled(detents)
    .onBegin(() => {
      start.value = height.value;
    })
    .onUpdate((event) => {
      // Dragging up grows the sheet, so the translation is subtracted.
      height.value = Math.min(expanded, Math.max(collapsed, start.value - event.translationY));
    })
    .onEnd((event) => {
      // A flick carries past the midpoint even when the finger stopped short.
      const projected = height.value - event.velocityY * VELOCITY_PROJECTION_SECONDS;
      runOnJS(settle)(projected > (collapsed + expanded) / 2 ? expanded : collapsed);
    });

  const sheetStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.root}>
        <Pressable
          style={styles.scrim}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <KeyboardAvoidingView
          style={styles.keyboardArea}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={insets.top}
        >
          <Animated.View
            style={[
              styles.sheet,
              detents ? sheetStyle : styles.sheetByContent,
              { paddingBottom: insets.bottom + space.base },
            ]}
          >
            {detents ? (
              <GestureDetector gesture={drag}>
                <Pressable
                  onPress={toggle}
                  accessibilityRole="button"
                  accessibilityLabel="Resize sheet"
                  accessibilityHint="Drag or tap to switch between half and full height"
                  hitSlop={space.sm}
                  style={styles.handleTarget}
                >
                  <View style={styles.handle} />
                </Pressable>
              </GestureDetector>
            ) : (
              // A fixed-height sheet has nowhere to drag to, so its grabber is
              // an affordance for the eye only — it says "this is a sheet", and
              // assistive tech already knows that from the modal itself.
              <View style={styles.handleTarget} importantForAccessibility="no-hide-descendants">
                <View style={styles.handle} />
              </View>
            )}
            <View style={styles.header}>
              <DisplayLarge style={styles.title}>{title}</DisplayLarge>
              <Button
                label="Close"
                variant="ghost"
                block={false}
                onPress={onClose}
              />
            </View>
            <ScrollView
              style={[styles.body, detents && styles.bodyFlexible]}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...fillParent, backgroundColor: color.ink, opacity: 0.35 },
  keyboardArea: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: color.raised,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  /** The long-standing behaviour: as tall as the content, up to 88%. */
  sheetByContent: { maxHeight: '88%' },
  handleTarget: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: swipeTokens.a11y.minTouchTargetDp,
  },
  handle: {
    width: space.xxl,
    height: space.xs,
    borderRadius: radius.full,
    backgroundColor: color.line,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: layout.screenGutter,
    paddingRight: space.sm,
    paddingTop: space.base,
  },
  title: { flex: 1 },
  body: { paddingHorizontal: layout.screenGutter },
  /** With a fixed sheet height the scroll area takes the remaining space. */
  bodyFlexible: { flex: 1 },
  bodyContent: { paddingTop: space.base, paddingBottom: space.base, gap: space.base },
  footer: { paddingHorizontal: layout.screenGutter, paddingTop: space.sm },
});
