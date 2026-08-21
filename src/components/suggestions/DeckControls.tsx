import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Body, Caption, RowTitle, ScreenTitle } from '@/components/Type';
import { color, opacity, radius, space, swipeTokens } from '@/constants/theme';
import { remainingLabel } from '@/logic/mealCard';

/**
 * Everything the deck shows around the card stack: the tap controls that are
 * the accessible equal of a swipe, the count, and the empty state.
 *
 * These live beside the deck rather than inside it so the gesture container
 * stays about gestures, and so the visual layer can be reasoned about — and
 * reviewed — on its own.
 */

const TOUCH = swipeTokens.a11y.minTouchTargetDp;

interface ActionProps {
  label: string;
  /** Decorative — the meaning is in `label`, which is what is announced. */
  glyph: string;
  onPress: () => void;
  /** Reduced-motion users tap rather than swipe, so the targets grow. */
  tall?: boolean;
  tone?: 'cook' | 'pass' | 'neutral';
}

export function DeckAction({ label, glyph, onPress, tall = false, tone = 'neutral' }: ActionProps) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={space.sm}
      style={({ pressed }) => [
        styles.action,
        tall && styles.actionTall,
        focused && styles.focusRing,
        pressed && { opacity: opacity.pressed },
      ]}
    >
      <RowTitle
        importantForAccessibility="no"
        style={tone === 'cook' ? styles.cookGlyph : tone === 'pass' ? styles.passGlyph : undefined}
      >
        {glyph}
      </RowTitle>
      <Caption muted importantForAccessibility="no">
        {label}
      </Caption>
    </Pressable>
  );
}

interface BarProps {
  onPass: () => void;
  onDetails: () => void;
  onCook: () => void;
  onUndo: () => void;
  /** Undo is hidden, never disabled, when there is nothing to bring back. */
  canUndo: boolean;
  /** True when Reduce Motion is on and these buttons are the primary path. */
  reduceMotion?: boolean;
}

export function SwipeActionBar({
  onPass,
  onDetails,
  onCook,
  onUndo,
  canUndo,
  reduceMotion = false,
}: BarProps) {
  return (
    <View style={styles.bar}>
      <DeckAction label="Pass" glyph="✕" tone="pass" onPress={onPass} tall={reduceMotion} />
      <DeckAction label="Details" glyph="ⓘ" onPress={onDetails} tall={reduceMotion} />
      <DeckAction label="Cook" glyph="✓" tone="cook" onPress={onCook} tall={reduceMotion} />
      {canUndo ? (
        <DeckAction label="Undo last pass" glyph="↶" onPress={onUndo} tall={reduceMotion} />
      ) : null}
    </View>
  );
}

/** Informational only — quiet enough that it never competes with the card. */
export function DeckCountIndicator({ remaining }: { remaining: number }) {
  return (
    <Caption muted style={styles.count}>
      {remainingLabel(remaining)}
    </Caption>
  );
}

interface EmptyProps {
  onRefresh?: () => void;
  onManual?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

/**
 * No ghost card outline: an empty deck is a finished task, not a hole where a
 * card should be. The space belongs to the recovery actions.
 */
export function EmptyDeck({ onRefresh, onManual, onUndo, canUndo = false }: EmptyProps) {
  return (
    <View style={styles.empty}>
      <Body
        style={styles.emptyMark}
        accessibilityRole="image"
        accessibilityLabel="An empty plate"
      >
        🍽
      </Body>
      <ScreenTitle>All caught up</ScreenTitle>
      <Caption muted style={styles.emptyDetail}>
        We will refresh when you come back.
      </Caption>
      <View style={styles.emptyActions}>
        {onRefresh ? <Button label="Refresh" onPress={onRefresh} /> : null}
        {onManual ? <Button label="Log manually" variant="ghost" onPress={onManual} /> : null}
        {canUndo && onUndo ? (
          <Button label="Undo last pass" variant="ghost" onPress={onUndo} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  action: {
    minWidth: TOUCH,
    minHeight: TOUCH,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    gap: space.xs,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 48dp on the reduced-motion path, where tapping replaces the gesture.
  actionTall: { minHeight: TOUCH + space.xs, paddingHorizontal: space.base },
  focusRing: {
    borderWidth: swipeTokens.a11y.focusRingWidth,
    borderColor: swipeTokens.a11y.focusRingColor,
  },
  cookGlyph: { color: swipeTokens.overlay.cookColor },
  passGlyph: { color: swipeTokens.overlay.passColor },
  count: { textAlign: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', gap: space.md, paddingVertical: space.xxl },
  emptyMark: { fontSize: space.xxxl, lineHeight: space.xxxl + space.md },
  emptyDetail: { textAlign: 'center' },
  emptyActions: { alignSelf: 'stretch', gap: space.sm, paddingTop: space.sm },
});
