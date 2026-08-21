import { useCallback, useEffect, useRef } from 'react';
import {
  FlatList,
  Pressable,
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
  const listRef = useRef<FlatList<ScrollerItem>>(null);
  const reduceMotion = useReducedMotion();
  const horizontal = orientation === 'horizontal';
  const tick = horizontal ? TICK_HORIZONTAL : TICK_VERTICAL;
  const extent = tick * (visibleTicks * 2 + 1);
  const selected = items[selectedIndex];

  /** Keeps the list under the caret when the value changes from elsewhere. */
  useEffect(() => {
    if (selectedIndex < 0 || selectedIndex >= items.length) return;
    listRef.current?.scrollToIndex({
      index: selectedIndex,
      animated: !reduceMotion,
      viewPosition: 0.5,
    });
  }, [items.length, reduceMotion, selectedIndex]);

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

  const onSettled = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = horizontal
        ? event.nativeEvent.contentOffset.x
        : event.nativeEvent.contentOffset.y;
      const index = Math.round(offset / tick);
      if (index >= 0 && index < items.length && index !== selectedIndex) onSelectIndex(index);
    },
    [horizontal, items.length, onSelectIndex, selectedIndex, tick],
  );

  return (
    <View
      style={[styles.frame, horizontal ? { height: TICK_HORIZONTAL } : { height: extent }, style]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: [selected?.spoken ?? selected?.label, rangeHint].filter(Boolean).join('. ') }}
      accessibilityActions={ADJUST_ACTIONS}
      onAccessibilityAction={onAction}
    >
      <View pointerEvents="none" style={[styles.caret, horizontal ? styles.caretHorizontal : styles.caretVertical]} />
      <FlatList
        ref={listRef}
        data={items}
        horizontal={horizontal}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        snapToInterval={tick}
        decelerationRate="fast"
        disableIntervalMomentum
        initialScrollIndex={Math.max(0, selectedIndex)}
        getItemLayout={(_, index) => ({ length: tick, offset: tick * index, index })}
        onMomentumScrollEnd={onSettled}
        onScrollToIndexFailed={() => undefined}
        importantForAccessibility="no-hide-descendants"
        contentContainerStyle={
          horizontal
            ? { paddingHorizontal: tick * visibleTicks }
            : { paddingVertical: tick * visibleTicks }
        }
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => onSelectIndex(index)}
            style={({ pressed }) => [
              horizontal ? { width: tick } : { height: tick },
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
        )}
      />
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
  caretVertical: { left: 0, right: 0, top: '50%', height: 2 },
});
