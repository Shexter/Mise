import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Body, Caption, RowTitle } from '@/components/Type';
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

/**
 * A settings row that carries the setting itself rather than opening
 * something. The explanation sits under the label, because a preference
 * about what leaves the device is not one anyone should have to guess at.
 */
export function SettingsToggleRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.row, disabled && { opacity: opacity.disabled }]}>
      <View style={styles.toggleText}>
        <RowTitle>{label}</RowTitle>
        {description ? <Caption muted>{description}</Caption> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityLabel={description ? `${label}. ${description}` : label}
        trackColor={{ false: color.line, true: color.action }}
        thumbColor={color.onAction}
        ios_backgroundColor={color.line}
      />
    </View>
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
  toggleText: { flex: 1, gap: space.xs, paddingRight: space.sm },
  right: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
});
