import { StyleSheet, View } from 'react-native';

import { color, radius, space } from '@/constants/theme';

interface Props {
  /** Describes the state conveyed by the artwork, not its decorative shapes. */
  accessibilityLabel: string;
}

/**
 * The approved empty-Pantry illustration: one half-empty shelf, an ink
 * outline, one olive accent, and generous negative space. It is intentionally
 * static and token-driven, so reduced motion needs no alternate rendering.
 */
export function EmptyPantryIllustration({ accessibilityLabel }: Props) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={styles.frame}
    >
      <View importantForAccessibility="no-hide-descendants" style={styles.shelfUnit}>
        <View style={styles.topShelf} />
        <View style={styles.items}>
          <View style={styles.jar} />
          <View style={styles.bottle}>
            <View style={styles.bottleNeck} />
          </View>
          <View style={styles.bowl} />
        </View>
        <View style={styles.bottomShelf} />
        <View style={styles.supports}>
          <View style={styles.support} />
          <View style={styles.support} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    minHeight: space.xxxl * 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.ground,
    borderRadius: radius.card,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
  },
  shelfUnit: {
    width: '100%',
    maxWidth: space.xxxl * 3,
  },
  topShelf: {
    height: space.xs,
    backgroundColor: color.ink,
    borderRadius: radius.full,
  },
  items: {
    minHeight: space.xxxl,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: space.base,
    paddingTop: space.lg,
  },
  jar: {
    width: space.xl,
    height: space.xl,
    borderWidth: 2,
    borderColor: color.ink,
    borderRadius: radius.input,
    backgroundColor: color.surface,
  },
  bottle: {
    width: space.lg,
    height: space.xxl,
    borderWidth: 2,
    borderColor: color.ink,
    borderRadius: radius.input,
    backgroundColor: color.olive,
    alignItems: 'center',
  },
  bottleNeck: {
    width: space.md,
    height: space.sm,
    marginTop: -space.sm,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: color.ink,
    borderTopLeftRadius: radius.input,
    borderTopRightRadius: radius.input,
    backgroundColor: color.olive,
  },
  bowl: {
    width: space.xxl,
    height: space.lg,
    borderWidth: 2,
    borderTopWidth: space.xs,
    borderColor: color.ink,
    borderBottomLeftRadius: radius.full,
    borderBottomRightRadius: radius.full,
    backgroundColor: color.surface,
  },
  bottomShelf: {
    height: space.sm,
    backgroundColor: color.ink,
    borderRadius: radius.full,
  },
  supports: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.base,
  },
  support: {
    width: space.sm,
    height: space.base,
    backgroundColor: color.ink,
    borderBottomLeftRadius: radius.input,
    borderBottomRightRadius: radius.input,
  },
});
