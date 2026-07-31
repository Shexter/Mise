import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { ButtonLabel } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Fills the available width. Primary actions usually do. */
  block?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  block = true,
  style,
  accessibilityHint,
}: Props) {
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        block && styles.block,
        pressed && !inactive && { opacity: opacity.pressed },
        inactive && { opacity: opacity.disabled },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor[variant]} />
      ) : (
        <ButtonLabel style={{ color: labelColor[variant] }}>{label}</ButtonLabel>
      )}
      {/* Keeps the row height stable between the label and spinner states. */}
      <View style={styles.spacer} />
    </Pressable>
  );
}

const labelColor: Record<ButtonVariant, string> = {
  primary: color.surface,
  secondary: color.ink,
  ghost: color.ink,
  destructive: color.paprika,
};

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  block: { alignSelf: 'stretch' },
  spacer: { width: 0 },
});

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: color.ink },
  secondary: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  ghost: { backgroundColor: 'transparent' },
  destructive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: color.line,
  },
};
