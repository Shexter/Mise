import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import type { CardTint } from '@/components/Card';
import { RowTitle } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';

export interface PillProps {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  selected?: boolean;
  /** The wash this pill carries when it is not the selected one. */
  tint?: CardTint;
  onPress: () => void;
  style?: ViewStyle;
}

/**
 * A compact selectable control — storage locations, and filters shaped like
 * them. Selection is carried by border weight and colour together, never by
 * colour alone, so it survives both a monochrome rendering and a palette whose
 * action colour sits close to its ink.
 */
export function Pill({
  label,
  icon,
  selected = false,
  tint,
  onPress,
  style,
}: PillProps) {
  const foreground = selected ? color.action : color.ink;

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.pill,
        selected
          ? styles.selected
          : { backgroundColor: tint ? color[tint] : color.surface },
        pressed && { opacity: opacity.pressed },
        style,
      ]}
    >
      {icon ? <Feather name={icon} size={16} color={foreground} /> : null}
      <RowTitle style={{ color: foreground }}>{label}</RowTitle>
    </Pressable>
  );
}

/** Horizontal rail of pills. Wraps rather than scrolling, so none is hidden. */
export function PillRow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  pill: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.base,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  selected: {
    backgroundColor: color.ground,
    // Weight, not only colour: the selected pill is legible as selected with
    // every hue stripped out.
    borderWidth: 2,
    borderColor: color.action,
  },
});
