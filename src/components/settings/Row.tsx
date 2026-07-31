import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Body, RowTitle } from '@/components/Type';
import { color, layout, opacity, space } from '@/constants/theme';

interface Props {
  label: string;
  /** Right-aligned current value. */
  value?: string;
  onPress?: () => void;
  /** Renders the label and chevron in paprika. */
  destructive?: boolean;
  /** Hides the chevron for rows that only display. */
  showChevron?: boolean;
}

export function SettingsRow({
  label,
  value,
  onPress,
  destructive = false,
  showChevron = true,
}: Props) {
  const tint = destructive ? color.paprika : color.ink;

  const content = (
    <View style={styles.row}>
      <RowTitle style={{ color: tint }}>{label}</RowTitle>
      <View style={styles.right}>
        {value ? (
          <Body muted numberOfLines={1}>
            {value}
          </Body>
        ) : null}
        {onPress && showChevron ? (
          <Feather name="chevron-right" size={18} color={color.muted} />
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => [pressed && { opacity: opacity.pressed }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.minRowHeight,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  right: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
});
