import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';

import { Body, Caption } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export interface ScrollerItem {
  /** Stable identity for the row. */
  key: string;
  /** What the person reads on the tick. */
  label: string;
  /** What a screen reader announces when this tick is selected. */
  spoken?: string;
}

interface Props {
  items: readonly ScrollerItem[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  /** Announced as the control's name, e.g. "Weight in kilograms". */
  label: string;
  /** Announced after the value, e.g. "30 to 300 kilograms". */
  rangeHint?: string;
  orientation?: 'horizontal' | 'vertical';
  /** Visible ticks either side of the selection. Sets the control's size. */
  visibleTicks?: number;
  style?: ViewStyle;
}

/** One tick's extent along the scroll axis. */
const TICK_HORIZONTAL = 64;
const TICK_VERTICAL = layout.minTouchTarget;

/**
 * The snapped list of values behind both numeric and date entry.
 *
 * Snapping is an enhancement, never the only way in: the same list is
 * operable as an `adjustable` with increment and decrement actions, every
 * tick is individually tappable, and the controls that use this always pair it
 * with typed entry. Reduced motion turns the settle into an immediate jump —
 * the sequence and the announced state are unchanged.
 */
export function SnappedScroller({
  items,
  selectedIndex,
  onSelectIndex,
  label,
  rangeHint,
  orientation = 'horizontal',
  visibleTicks = 2,
  style,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  /** Where the list actually is, so a settled gesture is never "corrected" back. */
  const offsetRef = useRef(0);
  const reduceMotion = useReducedMotion();
  const horizontal = orientation === 'horizontal';
  const tick = horizontal ? TICK_HORIZONTAL : TICK_VERTICAL;
  const extent = tick * (visibleTicks * 2 + 1);
  const selected = items[selectedIndex];
  // Vertical frames are exactly `extent` tall; horizontal ones span their
  // container, so centre the first/last tick under the caret from the width.
  const [width, setWidth] = useState(0);
  const contentPadding = horizontal && width > 0 ? Math.max(0, (width - tick) / 2) : tick * visibleTicks;

  /**
   * With the padding on both sides, item n is centred under the caret at
   * scroll offset n*tick.
   *
   * A plain ScrollView, not a FlatList: this sits inside the step's own
   * ScrollView, and a virtualized list nested in one fights it for the
   * gesture (and React Native warns about exactly that).
   */
  const scrollTo = useCallback(
    (index: number, animated: boolean) => {
      const offset = index * tick;
      offsetRef.current = offset;
      scrollRef.current?.scrollTo(horizontal ? { x: offset, animated } : { y: offset, animated });
    },
    [horizontal, tick],
  );

  /** Keeps the list under the caret when the value changes from elsewhere. */
  useEffect(() => {
    if (selectedIndex < 0 || selectedIndex >= items.length) return;
    // A gesture that just settled on this index is already there: leave it.
    if (Math.abs(offsetRef.current - selectedIndex * tick) < 1) return;
    scrollTo(selectedIndex, !reduceMotion);
  }, [items.length, reduceMotion, scrollTo, selectedIndex, tick]);

  // Padding changes with the measured width; re-seat the list without animating.
  useEffect(() => {
    scrollTo(selectedIndex, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentPadding]);

  const step = useCallback(
    (delta: number) => {
      const next = Math.min(items.length - 1, Math.max(0, selectedIndex + delta));
      if (next !== selectedIndex) onSelectIndex(next);
    },
    [items.length, onSelectIndex, selectedIndex],
  );

  const onAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'increment') step(1);
      if (event.nativeEvent.actionName === 'decrement') step(-1);
    },
    [step],
  );

  const settle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset } = event.nativeEvent;
      const offset = horizontal ? contentOffset.x : contentOffset.y;
      offsetRef.current = offset;
      const index = Math.min(items.length - 1, Math.max(0, Math.round(offset / tick)));
      if (index !== selectedIndex) onSelectIndex(index);
    },
    [horizontal, items.length, onSelectIndex, selectedIndex, tick],
  );

  return (
    <View
      style={[styles.frame, horizontal ? { height: TICK_HORIZONTAL } : { height: extent }, style]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: [selected?.spoken ?? selected?.label, rangeHint].filter(Boolean).join('. ') }}
      accessibilityActions={ADJUST_ACTIONS}
      onAccessibilityAction={onAction}
    >
      <View pointerEvents="none" style={[styles.caret, horizontal ? styles.caretHorizontal : styles.caretVertical]} />
      <ScrollView
        ref={scrollRef}
        horizontal={horizontal}
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        snapToInterval={tick}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={(event) => {
          const { contentOffset } = event.nativeEvent;
          offsetRef.current = horizontal ? contentOffset.x : contentOffset.y;
        }}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={(event) => {
          // A slow release can land on a tick with no momentum phase at all.
          const { velocity } = event.nativeEvent;
          const speed = velocity ? Math.abs(horizontal ? velocity.x : velocity.y) : 0;
          if (speed < 0.05) settle(event);
        }}
        importantForAccessibility="no-hide-descendants"
        contentContainerStyle={
          horizontal
            ? { paddingHorizontal: contentPadding }
            : { paddingVertical: contentPadding }
        }
      >
        {items.map((item, index) => (
          <Pressable
            key={item.key}
            onPress={() => onSelectIndex(index)}
            style={({ pressed }) => [
              horizontal ? { width: tick, height: TICK_HORIZONTAL } : { width: '100%', height: tick },
              styles.tick,
              pressed && { opacity: opacity.pressed },
            ]}
          >
            {index === selectedIndex ? (
              <Body>{item.label}</Body>
            ) : (
              <Caption muted>{item.label}</Caption>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const ADJUST_ACTIONS = [
  { name: 'increment' as const, label: 'Increase' },
  { name: 'decrement' as const, label: 'Decrease' },
];

const styles = StyleSheet.create({
  frame: {
    justifyContent: 'center',
    borderRadius: radius.input,
    backgroundColor: color.surface,
    overflow: 'hidden',
  },
  tick: { alignItems: 'center', justifyContent: 'center' },
  caret: { position: 'absolute', backgroundColor: color.action, opacity: opacity.over },
  caretHorizontal: { top: 0, bottom: 0, left: '50%', width: 2 },
  // A band behind the selected row rather than a line through its text.
  caretVertical: { left: 0, right: 0, top: '50%', height: TICK_VERTICAL, marginTop: -TICK_VERTICAL / 2, opacity: 0.12 },
});
